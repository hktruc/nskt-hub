// AI gộp các câu học viên gửi BTC thành câu hỏi kiểu FAQ, kèm mức độ cấp bách. Gợi ý cho BTC, không công khai.
// Không gửi họ tên học viên cho AI: mỗi câu chỉ có số thứ tự, nguồn (câu hỏi / góp ý cải thiện) và nội dung.
//
// Hai bước, vì gửi cả nghìn câu một lần thì mô hình rẻ gộp quá thô (thực tế: 947 câu → 2 nhóm):
//   1. Chia thành từng phần ~80 câu, AI gộp từng phần thành các nhóm NHỎ, mỗi nhóm một vấn đề cụ thể.
//   2. AI đọc tên các nhóm nhỏ của mọi phần và nối những nhóm cùng một vấn đề (suy nghĩ kỹ hơn: reasoning "low").

import type { AiConfig } from "../ai/openai";
import type { FaqItem } from "./collect";

export type Urgency = "cap-bach" | "quan-trong" | "thuong";
export type FaqGroupOut = { question: string; summary: string; topic: string; urgency: Urgency; ids: number[] };
export type FaqAiResult = { ok: true; groups: FaqGroupOut[] } | { ok: false; error: string };

const MAX_TEXT = 600;
export const CHUNK = 80;
const PARALLEL = 4;
const URG: Urgency[] = ["cap-bach", "quan-trong", "thuong"];

const groupSchema = (idsKey: string) =>
  ({
    type: "object",
    additionalProperties: false,
    required: ["groups"],
    properties: {
      groups: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "summary", "topic", "urgency", idsKey],
          properties: {
            question: { type: "string" },
            summary: { type: "string" },
            topic: { type: "string" },
            urgency: { type: "string", enum: URG },
            [idsKey]: { type: "array", items: { type: "integer" } },
          },
        },
      },
    },
  }) as const;

const RULES = `- question: viết lại thành một câu hỏi FAQ ngắn gọn, rõ ràng, bằng tiếng Việt, như học viên hỏi BTC (vd. "Nộp bài trễ thì có được tính điểm không?"). Không ghi tên người.
- summary: 1–2 câu tóm tắt học viên đang gặp gì / muốn gì, nêu ý khác nhau nếu có.
- topic: chủ đề ngắn (vd. "Bài tập", "Kỹ thuật – web/app", "Lịch học", "Nội dung bài giảng", "Đội nhóm", "Sức khỏe – cá nhân", "Vận hành").
- urgency: "cap-bach" nếu cần BTC xử lý ngay (lỗi kỹ thuật chặn việc học/nộp bài, hiểu sai hạn nộp hay quy định, học viên đang gặp khó khăn nghiêm trọng hoặc có ý bỏ học, bức xúc rõ); "quan-trong" nếu nhiều người cùng hỏi hoặc ảnh hưởng chất lượng học; còn lại "thuong".`;

export const SYSTEM_ITEMS = `Bạn giúp Ban tổ chức (BTC) một khóa học đọc các câu học viên gửi BTC trong bài tập tuần và biên tập thành câu hỏi thường gặp (FAQ).
Mỗi mục có số thứ tự (id), nguồn ("câu hỏi" = khó khăn & câu hỏi gửi BTC/Thầy; "cải thiện" = điểm học viên muốn lớp cải thiện) và nội dung.
Yêu cầu:
- Gộp vào một nhóm CHỈ những mục nói về CÙNG MỘT vấn đề cụ thể (vd. "không tải được ảnh khi nộp bài", "muốn có lịch học sớm hơn"). KHÔNG gộp theo chủ đề rộng như "góp ý chung" hay "khó khăn học tập".
- Một mục có nhiều ý: xếp theo ý chính. Mỗi id chỉ thuộc tối đa một nhóm. Thường sẽ có nhiều nhóm nhỏ (1–10 mục); nhóm lớn hơn chỉ khi thật sự cùng một ý.
- Bỏ qua (không đưa vào nhóm nào) mục không có nội dung cụ thể: chỉ cảm ơn, khen chung chung, "không có", "chưa có".
${RULES}
Chỉ trả về JSON đúng cấu trúc yêu cầu.`;

export const SYSTEM_MERGE = `Bạn giúp Ban tổ chức (BTC) một khóa học hoàn thiện danh sách câu hỏi thường gặp (FAQ) từ câu học viên gửi BTC.
Bạn nhận các nhóm đã gộp sơ bộ ở nhiều phần khác nhau; mỗi nhóm có id, câu hỏi, tóm tắt, mức độ và số mục.
Yêu cầu:
- Nối các nhóm nói về CÙNG MỘT vấn đề cụ thể thành một nhóm (parts = danh sách id nhóm được nối). Không nối các vấn đề khác nhau chỉ vì cùng chủ đề rộng.
- Mỗi id nhóm chỉ nằm trong một nhóm kết quả; nhóm không cần nối thì để riêng (parts chỉ có id của nó). Không bỏ sót nhóm nào.
- Viết lại question / summary cho nhóm đã nối; mức độ lấy mức cao nhất hợp lý.
${RULES}
- Sắp xếp: cấp bách trước, rồi theo tổng số mục giảm dần.
Chỉ trả về JSON đúng cấu trúc yêu cầu.`;

type Raw = { question?: unknown; summary?: unknown; topic?: unknown; urgency?: unknown };
const clean = (g: Raw) => ({
  question: String(g.question ?? "").trim().slice(0, 300),
  summary: String(g.summary ?? "").trim().slice(0, 600),
  topic: String(g.topic ?? "").trim().slice(0, 60),
  urgency: (URG.includes(g.urgency as Urgency) ? g.urgency : "thuong") as Urgency,
});
const rank = (u: Urgency) => URG.indexOf(u);

async function callJson(cfg: AiConfig, system: string, user: string, schemaName: string, schema: unknown, effort?: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
  };
  const re = effort ?? cfg.reasoningEffort;
  if (re) body.reasoning_effort = re;
  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(`${cfg.baseUrl ?? "https://api.openai.com"}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300_000),
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
    return { ok: true, data: JSON.parse(msg.content) };
  } catch {
    return { ok: false, error: "OpenAI trả về JSON không đọc được" };
  }
}

/** Bước 1: gộp một phần (≤ CHUNK câu). ids trả về là số thứ tự toàn cục (1…tổng số câu). */
async function groupChunk(cfg: AiConfig, items: FaqItem[], offset: number, sourceLabel: (k: string) => string): Promise<{ ok: true; groups: FaqGroupOut[] } | { ok: false; error: string }> {
  const lines = items.map((it, i) => JSON.stringify({ id: i + 1, nguon: sourceLabel(it.source), noi_dung: it.text.slice(0, MAX_TEXT) }));
  const r = await callJson(cfg, SYSTEM_ITEMS, `Có ${items.length} mục:\n${lines.join("\n")}`, "faq", groupSchema("ids"));
  if (!r.ok) return r;
  const used = new Set<number>();
  const groups = (((r.data as { groups?: (Raw & { ids?: number[] })[] }).groups ?? []) as (Raw & { ids?: number[] })[])
    .map((g) => ({
      ...clean(g),
      ids: (g.ids ?? []).filter((id) => Number.isInteger(id) && id >= 1 && id <= items.length && !used.has(id) && (used.add(id), true)).map((id) => id + offset),
    }))
    .filter((g) => g.question && g.ids.length > 0);
  return { ok: true, groups };
}

export async function groupFaq(cfg: AiConfig, items: FaqItem[], sourceLabel: (k: string) => string): Promise<FaqAiResult> {
  if (items.length === 0) return { ok: true, groups: [] };
  // Bước 1: từng phần, chạy song song vài phần một lúc.
  const chunks: { offset: number; items: FaqItem[] }[] = [];
  for (let i = 0; i < items.length; i += CHUNK) chunks.push({ offset: i, items: items.slice(i, i + CHUNK) });
  const parts: FaqGroupOut[] = [];
  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const rs = await Promise.all(chunks.slice(i, i + PARALLEL).map((c) => groupChunk(cfg, c.items, c.offset, sourceLabel)));
    for (const r of rs) {
      if (!r.ok) return r;
      parts.push(...r.groups);
    }
  }
  const sorted = (gs: FaqGroupOut[]) => [...gs].sort((a, b) => rank(a.urgency) - rank(b.urgency) || b.ids.length - a.ids.length);
  if (chunks.length === 1 || parts.length <= 1) return { ok: true, groups: sorted(parts) };

  // Bước 2: nối các nhóm nhỏ trùng vấn đề giữa các phần.
  const lines = parts.map((g, i) => JSON.stringify({ id: i + 1, cau_hoi: g.question, tom_tat: g.summary.slice(0, 200), muc_do: g.urgency, so_muc: g.ids.length }));
  const r = await callJson(cfg, SYSTEM_MERGE, `Có ${parts.length} nhóm:\n${lines.join("\n")}`, "faq_noi", groupSchema("parts"), "low");
  if (!r.ok) return { ok: true, groups: sorted(parts) }; // nối lỗi: vẫn dùng kết quả bước 1
  const used = new Set<number>();
  const merged: FaqGroupOut[] = [];
  for (const g of ((r.data as { groups?: (Raw & { parts?: number[] })[] }).groups ?? []) as (Raw & { parts?: number[] })[]) {
    const ps = (g.parts ?? []).filter((p) => Number.isInteger(p) && p >= 1 && p <= parts.length && !used.has(p) && (used.add(p), true));
    if (!ps.length) continue;
    const c = clean(g);
    const best = ps.map((p) => parts[p - 1]!.urgency).sort((a, b) => rank(a) - rank(b))[0]!;
    merged.push({ ...c, question: c.question || parts[ps[0]! - 1]!.question, urgency: rank(c.urgency) <= rank(best) ? c.urgency : best, ids: ps.flatMap((p) => parts[p - 1]!.ids) });
  }
  // Nhóm AI quên đưa vào: giữ nguyên.
  parts.forEach((g, i) => {
    if (!used.has(i + 1)) merged.push(g);
  });
  return { ok: true, groups: sorted(merged) };
}
