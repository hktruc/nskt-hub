import type { AiTask, AiVerdict } from "../scoring/rules";

// Gọi OpenAI (API của chủ dự án) để đọc câu hỏi và câu trả lời, trả về đạt / không đạt / đối phó.
// Dùng mô hình rẻ nhất vừa đủ (mặc định gpt-5-nano, đổi bằng biến OPENAI_MODEL).
// Khóa chỉ đi trong tiêu đề Authorization; không bao giờ ghi vào nhật ký hay cơ sở dữ liệu.

export const AI_VERSION = "cham-1";
const MAX_ANSWER_CHARS = 4000;

export type AiConfig = {
  apiKey: string;
  model: string;
  reasoningEffort?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type AiItem = { index: number; task: AiTask; question: string; answer: string };

const TASK_TEXT: Record<AiTask, string> = {
  "sau-sac": "Câu khuyến khích của bài tập ngày, học viên trả lời bằng chữ. ĐẠT nếu có đúc kết sâu sắc, chân thành, gắn với trải nghiệm của bản thân (không chỉ chép lại đề hay vài câu chung chung).",
  "dat-yeu-cau": "Câu bắt buộc của bài tập tuần. ĐẠT nếu trả lời đúng ý câu hỏi, có trách nhiệm, có nội dung thật (có thể ngắn nhưng phải có ý).",
  "gop-y": "Câu góp ý cho ban tổ chức (không bắt buộc). ĐẠT nếu có một ý góp ý / câu hỏi thật, dù ngắn.",
};

const SYSTEM = `Bạn là trợ lý chấm bài cho khóa học NSKT2026 (kể chuyện, rèn tâm trí). Với mỗi mục, đọc câu hỏi và câu trả lời của học viên, rồi quyết định:
- ok: true nếu câu trả lời ĐẠT theo tiêu chí của mục, false nếu không.
- nonsense: true nếu câu trả lời là đối phó: vài chữ cái hay ký hiệu vô nghĩa, gõ đại, chép lại đề, nội dung không liên quan. Khi nonsense là true thì ok phải là false.
- note: một câu ngắn tiếng Việt (tối đa 15 từ) nêu lý do.
Đường link trong câu trả lời là video/ảnh đã được hệ thống đếm riêng; chỉ đánh giá phần chữ. Không chấm khắt khe chính tả. Chỉ trả về JSON đúng mẫu.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "ok", "nonsense", "note"],
        properties: {
          index: { type: "integer" },
          ok: { type: "boolean" },
          nonsense: { type: "boolean" },
          note: { type: "string" },
        },
      },
    },
  },
} as const;

export function buildMessages(items: AiItem[]): { role: "system" | "user"; content: string }[] {
  const body = items
    .map((it) => {
      const answer = it.answer.length > MAX_ANSWER_CHARS ? `${it.answer.slice(0, MAX_ANSWER_CHARS)} […]` : it.answer;
      return `### Mục ${it.index}\nTiêu chí: ${TASK_TEXT[it.task]}\nCâu hỏi: ${it.question}\nCâu trả lời: ${answer}`;
    })
    .join("\n\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: body },
  ];
}

export type AiResult = { ok: true; verdicts: AiVerdict[] } | { ok: false; error: string; retry: boolean; stop: boolean };

export async function reviewItems(cfg: AiConfig, items: AiItem[]): Promise<AiResult> {
  if (items.length === 0) return { ok: true, verdicts: [] };
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: buildMessages(items),
    response_format: { type: "json_schema", json_schema: { name: "ket_qua_cham", strict: true, schema: SCHEMA } },
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;

  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(`${cfg.baseUrl ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return { ok: false, error: "không kết nối được OpenAI", retry: true, stop: true };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, error: `OpenAI từ chối khóa (mã ${res.status})`, retry: true, stop: true };
  if (res.status === 429) return { ok: false, error: "OpenAI báo gọi quá nhiều hoặc hết hạn mức (mã 429)", retry: true, stop: true };
  if (res.status >= 500) return { ok: false, error: `OpenAI đang lỗi (mã ${res.status})`, retry: true, stop: true };
  if (res.status !== 200) {
    // 400: thường do tên mô hình hoặc tham số không hợp lệ — sửa cấu hình rồi chấm lại.
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = (j.error?.message ?? "").slice(0, 200);
    } catch {}
    return { ok: false, error: `OpenAI trả về mã ${res.status}${detail ? `: ${detail}` : ""}`, retry: false, stop: true };
  }

  try {
    const j = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
    const msg = j.choices?.[0]?.message;
    if (!msg?.content) return { ok: false, error: msg?.refusal ? "OpenAI từ chối chấm" : "OpenAI không trả nội dung", retry: false, stop: false };
    const parsed = JSON.parse(msg.content) as { items?: AiVerdict[] };
    const wanted = new Set(items.map((i) => i.index));
    const verdicts = (parsed.items ?? [])
      .filter((v) => wanted.has(v.index) && typeof v.ok === "boolean" && typeof v.nonsense === "boolean")
      .map((v) => ({ index: v.index, ok: v.ok && !v.nonsense, nonsense: v.nonsense, note: String(v.note ?? "").slice(0, 200) }));
    if (verdicts.length !== wanted.size) return { ok: false, error: "OpenAI trả thiếu mục", retry: true, stop: false };
    return { ok: true, verdicts };
  } catch {
    return { ok: false, error: "OpenAI trả về JSON không đọc được", retry: true, stop: false };
  }
}
