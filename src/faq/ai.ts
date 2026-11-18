// AI gộp các câu học viên gửi BTC thành câu hỏi kiểu FAQ, kèm mức độ cấp bách. Gợi ý cho BTC, không công khai.
// Không gửi họ tên học viên cho AI: mỗi câu chỉ có số thứ tự, nguồn (câu hỏi / góp ý cải thiện) và nội dung.

import type { AiConfig } from "../ai/openai";
import type { FaqItem } from "./collect";

export type Urgency = "cap-bach" | "quan-trong" | "thuong";
export type FaqGroupOut = { question: string; summary: string; topic: string; urgency: Urgency; ids: number[] };
export type FaqAiResult = { ok: true; groups: FaqGroupOut[] } | { ok: false; error: string };

const MAX_TEXT = 600;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["groups"],
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "summary", "topic", "urgency", "ids"],
        properties: {
          question: { type: "string" },
          summary: { type: "string" },
          topic: { type: "string" },
          urgency: { type: "string", enum: ["cap-bach", "quan-trong", "thuong"] },
          ids: { type: "array", items: { type: "integer" } },
        },
      },
    },
  },
} as const;

const SYSTEM = `Bạn giúp Ban tổ chức (BTC) một khóa học đọc các câu học viên gửi BTC trong bài tập tuần và biên tập thành danh sách câu hỏi thường gặp (FAQ).
Mỗi mục có số thứ tự (id), nguồn ("câu hỏi" = khó khăn & câu hỏi gửi BTC/Thầy; "cải thiện" = điểm học viên muốn lớp cải thiện) và nội dung.
Yêu cầu:
- Gộp các mục cùng một vấn đề vào một nhóm. Mỗi id chỉ thuộc tối đa một nhóm. Bỏ qua mục không có nội dung (chỉ cảm ơn, khen chung chung, "không có").
- question: viết lại thành một câu hỏi FAQ ngắn gọn, rõ ràng, bằng tiếng Việt, như học viên hỏi BTC (vd. "Nộp bài trễ thì có được tính điểm không?"). Không ghi tên người.
- summary: 1–2 câu tóm tắt học viên đang gặp gì / muốn gì, nêu ý khác nhau nếu có.
- topic: chủ đề ngắn (vd. "Bài tập", "Kỹ thuật – web/app", "Lịch học", "Nội dung bài giảng", "Đội nhóm", "Sức khỏe – cá nhân", "Vận hành").
- urgency: "cap-bach" nếu cần BTC xử lý ngay (lỗi kỹ thuật chặn việc học/nộp bài, hiểu sai hạn nộp hay quy định, học viên đang gặp khó khăn nghiêm trọng hoặc có ý bỏ học, bức xúc rõ); "quan-trong" nếu nhiều người cùng hỏi hoặc ảnh hưởng chất lượng học; còn lại "thuong".
- Sắp xếp nhóm: cấp bách trước, rồi theo số người hỏi giảm dần.
Chỉ trả về JSON đúng cấu trúc yêu cầu.`;

export async function groupFaq(cfg: AiConfig, items: FaqItem[], sourceLabel: (k: string) => string): Promise<FaqAiResult> {
  if (items.length === 0) return { ok: true, groups: [] };
  const lines = items.map((it, i) => JSON.stringify({ id: i + 1, nguon: sourceLabel(it.source), noi_dung: it.text.slice(0, MAX_TEXT) }));
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Có ${items.length} mục:\n${lines.join("\n")}` },
    ],
    response_format: { type: "json_schema", json_schema: { name: "faq", strict: true, schema: SCHEMA } },
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;
  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(`${cfg.baseUrl ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600_000),
    });
  } catch {
    return { ok: false, error: "không kết nối được OpenAI (hoặc quá thời gian chờ)" };
  }
  if (res.status !== 200) {
    let detail = "";
    try {
      detail = (((await res.json()) as { error?: { message?: string } }).error?.message ?? "").slice(0, 200);
    } catch {}
    return { ok: false, error: `OpenAI trả về mã ${res.status}${detail ? `: ${detail}` : ""}` };
  }
  try {
    const j = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] };
    const msg = j.choices?.[0]?.message;
    if (!msg?.content) return { ok: false, error: msg?.refusal ? "OpenAI từ chối" : "OpenAI không trả nội dung" };
    const parsed = JSON.parse(msg.content) as { groups?: FaqGroupOut[] };
    const used = new Set<number>();
    const groups = (parsed.groups ?? [])
      .map((g) => ({
        question: String(g.question ?? "").trim().slice(0, 300),
        summary: String(g.summary ?? "").trim().slice(0, 600),
        topic: String(g.topic ?? "").trim().slice(0, 60),
        urgency: (["cap-bach", "quan-trong", "thuong"].includes(g.urgency) ? g.urgency : "thuong") as Urgency,
        // Chỉ giữ id hợp lệ, mỗi id một nhóm.
        ids: (g.ids ?? []).filter((id) => Number.isInteger(id) && id >= 1 && id <= items.length && !used.has(id) && (used.add(id), true)),
      }))
      .filter((g) => g.question && g.ids.length > 0);
    return { ok: true, groups };
  } catch {
    return { ok: false, error: "OpenAI trả về JSON không đọc được" };
  }
}
