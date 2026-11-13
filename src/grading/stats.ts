// Thống kê từ kết quả chấm: năng lực người chấm (cho coach / BTC) và chất lượng của một học viên (cửa sổ công khai).

import { GRADING, qualityOf, type Quality } from "./rubric";

const r1 = (x: number) => Math.round(x * 10) / 10;
const vnPlus = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 19);
const addDays = (vn: string, d: number) => new Date(Date.parse(`${vn.slice(0, 19)}Z`) + d * 86_400_000).toISOString().slice(0, 19);

export type GraderStat = {
  graderId: number;
  label: string;
  reviews: number;
  onTime: number; // chấm trong hạn (≤ 3 ngày sau hạn nộp)
  avg: number | null;
  /** Lệch trung bình so với những người khác chấm CÙNG bài (dương = cho cao hơn). null nếu chưa có bài chấm trùng. */
  deviation: number | null;
  overlaps: number;
  lean: "de" | "kho" | null; // dễ / khắt khe hơn người khác
  doiPho: number;
  withComment: number;
  lastAt: string | null;
};

type Row = { learner_id: number; assignment_id: number; grader_id: number; grader_label: string; score: number | null; spirit: string | null; comment: string | null; created_at: string; updated_at: string; due_at: string };

export async function loadGraderStats(db: D1Database): Promise<{ graders: GraderStat[]; overall: number | null }> {
  const rows = (
    await db
      .prepare(
        `SELECT w.learner_id, w.assignment_id, w.grader_id, w.grader_label, w.score, w.spirit, w.comment, w.created_at, w.updated_at, a.due_at
         FROM reviews_week w JOIN assignments a ON a.id = w.assignment_id`,
      )
      .all<Row>()
  ).results;
  const scores = rows.map((r) => r.score).filter((x): x is number => x !== null);
  const overall = scores.length ? r1(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  // Các bản chấm của cùng một bài (học viên + bài tuần), để so người này với người khác.
  const byPair = new Map<string, Row[]>();
  for (const r of rows) byPair.set(`${r.learner_id}:${r.assignment_id}`, [...(byPair.get(`${r.learner_id}:${r.assignment_id}`) ?? []), r]);
  const by = new Map<number, GraderStat & { sum: number; n: number; dev: number; devN: number }>();
  for (const r of rows) {
    const g = by.get(r.grader_id) ?? { graderId: r.grader_id, label: r.grader_label, reviews: 0, onTime: 0, avg: null, deviation: null, overlaps: 0, lean: null, doiPho: 0, withComment: 0, lastAt: null, sum: 0, n: 0, dev: 0, devN: 0 };
    g.label = r.grader_label;
    g.reviews++;
    if (vnPlus(r.created_at) <= addDays(r.due_at, GRADING.dueDays)) g.onTime++;
    if (r.score !== null) {
      g.sum += r.score;
      g.n++;
      const others = (byPair.get(`${r.learner_id}:${r.assignment_id}`) ?? []).filter((o) => o.grader_id !== r.grader_id && o.score !== null);
      if (others.length) {
        g.dev += r.score - others.reduce((p, o) => p + o.score!, 0) / others.length;
        g.devN++;
      }
    }
    if (r.spirit === "doi-pho") g.doiPho++;
    if (r.comment) g.withComment++;
    if (!g.lastAt || r.updated_at > g.lastAt) g.lastAt = r.updated_at;
    by.set(r.grader_id, g);
  }
  const graders = [...by.values()].map(({ sum, n, dev, devN, ...g }) => {
    const avg = n ? r1(sum / n) : null;
    const deviation = devN ? r1(dev / devN) : null;
    // Ưu tiên so với người chấm cùng bài (từ 3 bài trùng); chưa đủ thì so với mặt bằng chung (từ 5 bài).
    const diff = deviation !== null && devN >= 3 ? deviation : avg !== null && overall !== null && n >= 5 ? avg - overall : null;
    const lean = diff === null ? null : diff >= 0.5 ? "de" : diff <= -0.5 ? "kho" : null;
    return { ...g, avg, deviation, overlaps: devN, lean } as GraderStat;
  });
  return { graders: graders.sort((a, b) => b.reviews - a.reviews), overall };
}

export type LearnerQuality = {
  weeks: { title: string; score: number | null; quality: Quality | null }[]; // mới nhất trước, tối đa 6 tuần
  avg: number | null;
  strongest: string | null;
  weakest: string | null;
};

const CRIT_NAME: Record<string, string> = {
  a1: "Đúng ý, đủ ý",
  a2: "Truyền cảm",
  a3: "Mạch lạc",
  a4: "Đúc kết, thông điệp",
  a5: "Sơ đồ",
  b2: "Chiều sâu phần viết",
};

/** Chất lượng bài tuần của một học viên (chỉ điểm sao và năng lực mạnh / yếu; không tên người chấm, không nhận xét). */
export async function loadLearnerQuality(db: D1Database, learnerId: number): Promise<LearnerQuality | null> {
  const [weeks, items] = await db.batch([
    db
      .prepare(
        `SELECT a.title, ROUND(AVG(w.score), 1) AS score, CASE WHEN MAX(w.spirit = 'doi-pho') THEN 'doi-pho' END AS spirit, AVG(w.b2) AS b2
         FROM reviews_week w JOIN assignments a ON a.id = w.assignment_id
         WHERE w.learner_id = ? GROUP BY w.assignment_id ORDER BY a.due_at DESC`,
      )
      .bind(learnerId),
    db.prepare("SELECT a1, a2, a3, a4, a5 FROM reviews_item WHERE learner_id = ? AND flag IS NULL").bind(learnerId),
  ]);
  const w = (weeks?.results ?? []) as { title: string | null; score: number | null; spirit: string | null; b2: number | null }[];
  if (w.length === 0) return null;
  const sums: Record<string, [number, number]> = {};
  const add = (k: string, v: number | null) => {
    if (typeof v !== "number") return;
    const s = (sums[k] ??= [0, 0]);
    s[0] += v;
    s[1]++;
  };
  for (const it of (items?.results ?? []) as Record<string, number | null>[]) for (const k of ["a1", "a2", "a3", "a4", "a5"]) add(k, it[k] ?? null);
  for (const x of w) add("b2", x.b2);
  const avgs = Object.entries(sums)
    .filter(([, [, n]]) => n > 0)
    .map(([k, [s, n]]) => [k, s / n] as const)
    .sort((a, b) => b[1] - a[1]);
  const scores = w.map((x) => x.score).filter((x): x is number => x !== null);
  return {
    weeks: w.slice(0, 6).map((x) => ({ title: (x.title ?? "").replace(/\s*\(X10\)\s*/i, ""), score: x.score, quality: qualityOf(x.score, x.spirit) })),
    avg: scores.length ? r1(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    strongest: avgs.length >= 2 ? CRIT_NAME[avgs[0]![0]]! : null,
    weakest: avgs.length >= 2 && avgs[avgs.length - 1]![1] < avgs[0]![1] ? CRIT_NAME[avgs[avgs.length - 1]![0]]! : null,
  };
}
