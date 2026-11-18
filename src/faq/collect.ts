// Lấy các câu học viên gửi BTC từ câu góp ý không bắt buộc của bài tập tuần (nguồn khai báo ở hồ sơ khóa: COURSE.faq.sources).
// Bỏ câu trả lời không có nội dung ("không", "chưa có", ".", …).

import { COURSE } from "../course";
import { isLearnerTeam, teamCode } from "../domain/teams";

export type FaqItem = {
  key: string; // "mãHọcViên:mãBài:sốCâu"
  learnerId: number;
  name: string;
  team: string;
  assignmentId: number;
  assignmentTitle: string;
  dueAt: string;
  source: string; // khóa nguồn (vd. "cau-hoi")
  text: string;
};

const EMPTY_RE = /^(?:không|khong|ko|k|chưa|chua|không có|khong co|chưa có|chua co|không có gì|chưa có gì|không ạ|chưa ạ|ok|oke|none|no|n\/a|có|co)[\s.!,…:-]*$/i;

// Câu trả lời "cho có": chưa trả lời, "hiện chưa có", "không có góp ý gì", chỉ cảm ơn hoặc khen chung ("tốt", "mọi thứ đều ổn"…).
// Đây là câu hỏi không bắt buộc nên bỏ hẳn, không đếm, không liệt kê.
const NO_ANSWER_RE = /^\(?\s*(?:chưa|chua)\s+(?:có\s+)?trả\s+lời\s*\)?[\s.!,…:-]*$/i;
const NOTHING_RE = /^(?:(?:hiện\s+(?:tại|nay)|hiện|tạm\s+thời|lúc\s+này|đến\s+nay)\s+)?(?:(?:mình|em|con|tôi)\s+)?(?:chưa|không|ko|khong|chua|k)\s+(?:có|co)?\s*(?:(?:gì|j|vấn\s+đề|khó\s+khăn|câu\s+hỏi|góp\s+ý|ý\s+kiến|đề\s+xuất|đóng\s+góp|thắc\s+mắc|điều\s+gì|thêm|khác|nào|đặc\s+biệt)\s*)*\s*(?:ạ|à|ah|nhé|nha|cả|hết)?[\s.!,…:-]*$/i;
const GENERIC_RE = /^(?:(?:xin\s+)?(?:cảm\s+ơn|c[aả]m\s+on)(?:\s+(?:thầy|cô|btc|ban\s+tổ\s+chức|anh|chị|các\s+thầy|mọi\s+người))*|(?:mọi\s+thứ|tất\s+cả|mọi\s+việc|khóa\s+học|chương\s+trình)?\s*(?:đều\s+|đang\s+|đã\s+)?(?:rất\s+)?(?:tốt|ổn|ok|oke|hay|tuyệt\s+vời|bình\s+thường|tạm\s+ổn|hài\s+lòng))(?:\s+(?:rồi|ạ|nhé|nha|lắm|thầy|cô))*[\s.!,…:-]*$/i;

/** Câu trả lời có nội dung đáng đọc. */
export function meaningful(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 6) return false;
  if (EMPTY_RE.test(t) || NO_ANSWER_RE.test(t) || NOTHING_RE.test(t) || GENERIC_RE.test(t)) return false;
  if (!/\p{L}{2,}/u.test(t)) return false;
  return true;
}

/** Nguồn của một câu hỏi trong đề (theo hồ sơ khóa), hoặc null nếu không phải câu góp ý gửi BTC. */
export function sourceOf(question: string): string | null {
  for (const s of COURSE.faq.sources) if (s.re.test(question)) return s.key;
  return null;
}

export async function collectFaqItems(db: D1Database, opts: { assignmentId?: number } = {}): Promise<FaqItem[]> {
  const rows = (
    await db
      .prepare(
        `SELECT s.learner_id, s.assignment_id, s.answers_json, a.title, a.due_at, l.full_name, t.name AS team_name
         FROM submissions s JOIN assignments a ON a.id = s.assignment_id
         JOIN learners l ON l.id = s.learner_id LEFT JOIN teams t ON t.id = l.team_id
         WHERE a.type = 'WEEK' AND s.answers_json IS NOT NULL AND (?1 IS NULL OR a.id = ?1)
         ORDER BY a.due_at, s.learner_id`,
      )
      .bind(opts.assignmentId ?? null)
      .all<{ learner_id: number; assignment_id: number; answers_json: string; title: string | null; due_at: string; full_name: string | null; team_name: string | null }>()
  ).results;
  const out: FaqItem[] = [];
  for (const r of rows) {
    const team = teamCode(r.team_name);
    if (!isLearnerTeam(team)) continue;
    let answers: { question?: string | null; answer?: string | null }[];
    try {
      answers = JSON.parse(r.answers_json) as typeof answers;
    } catch {
      continue;
    }
    answers.forEach((a, i) => {
      const source = sourceOf(a.question ?? "");
      const text = String(a.answer ?? "").trim();
      if (!source || !meaningful(text)) return;
      out.push({
        key: `${r.learner_id}:${r.assignment_id}:${i}`,
        learnerId: r.learner_id,
        name: r.full_name ?? `#${r.learner_id}`,
        team,
        assignmentId: r.assignment_id,
        assignmentTitle: (r.title ?? `Bài #${r.assignment_id}`).replace(/\s*\(X10\)\s*/i, "").trim(),
        dueAt: r.due_at,
        source,
        text,
      });
    });
  }
  return out;
}

/** Dấu vân tay của tập câu hỏi: đổi khi có câu mới hoặc câu bị sửa. */
export async function itemsHash(items: FaqItem[]): Promise<string> {
  const data = new TextEncoder().encode(items.map((i) => `${i.key}\u0001${i.text}`).join("\u0002"));
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
