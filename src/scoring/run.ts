import { reviewItems, AI_VERSION, type AiConfig } from "../ai/openai";
import { parseAnswers, type Answer } from "../domain/media";
import { sha256 } from "../dh3g/parse";
import type { Env } from "../env";
import { SCORING } from "./config";
import { aiTasks, scoreSubmission, type AiVerdict, type Override } from "./rules";
import { buildDailySpec, buildWeeklySpec, type AssignmentSpec } from "./spec";

// Chạy theo cron mỗi 5 phút, sau khi lấy dữ liệu dh3g:
//  1. Dựng cấu trúc câu hỏi cho bài mới / bài đổi đề.
//  2. Gửi AI đọc vài bài nộp chưa được chấm (nếu có khóa OpenAI).
//  3. Tính lại điểm cho các bài nộp có thay đổi.
// Mỗi bước có giới hạn số lượng để một lượt chạy không quá nặng.

/** Tối đa số bài nộp gửi AI mỗi lượt 5 phút, và số lời gọi chạy song song. */
export const AI_PER_TICK = 40;
export const AI_CONCURRENCY = 5;
export const SCORES_PER_TICK = 400;
const AI_MAX_ATTEMPTS = 3;

export function nowVN(now: Date): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 19);
}

type SubRow = {
  learner_id: number;
  assignment_id: number;
  status: string | null;
  submitted_at: string | null;
  answers_json: string | null;
  answers_hash: string | null;
};

export async function refreshSpecs(db: D1Database, now: Date): Promise<number> {
  const assignments = (
    await db
      .prepare(
        `SELECT a.id, a.type, sp.questions_hash FROM assignments a LEFT JOIN assignment_specs sp ON sp.assignment_id = a.id
         WHERE a.type IN ('NORMAL','WEEK') AND a.due_at >= ?
           AND EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.submission_id IS NOT NULL
                       AND (sp.checked_at IS NULL OR s.changed_at > sp.checked_at))`,
      )
      .bind(SCORING.startDate)
      .all<{ id: number; type: "NORMAL" | "WEEK"; questions_hash: string | null }>()
  ).results;
  let changed = 0;
  for (const a of assignments) {
    const subs = (
      await db
        .prepare("SELECT answers_json FROM submissions WHERE assignment_id = ? AND submission_id IS NOT NULL")
        .bind(a.id)
        .all<{ answers_json: string | null }>()
    ).results.map((r) => parseAnswers(r.answers_json));
    // Đề bài lấy theo bài nộp có nhiều câu nhất (học viên nào cũng thấy cùng đề).
    const longest = subs.reduce<Answer[]>((best, s) => (s.length > best.length ? s : best), []);
    if (longest.length === 0) continue;
    const questions = longest.map((x) => x.question ?? "");
    const spec = a.type === "NORMAL" ? buildDailySpec(questions) : buildWeeklySpec(questions, subs);
    const hash = await sha256(JSON.stringify(spec));
    const iso = now.toISOString();
    if (hash === a.questions_hash) {
      await db.prepare("UPDATE assignment_specs SET checked_at = ? WHERE assignment_id = ?").bind(iso, a.id).run();
      continue;
    }
    await db
      .prepare(
        `INSERT INTO assignment_specs (assignment_id, questions_hash, spec_json, updated_at, checked_at) VALUES (?,?,?,?,?)
         ON CONFLICT(assignment_id) DO UPDATE SET questions_hash=excluded.questions_hash, spec_json=excluded.spec_json,
           updated_at=excluded.updated_at, checked_at=excluded.checked_at`,
      )
      .bind(a.id, hash, JSON.stringify(spec), iso, iso)
      .run();
    changed++;
  }
  return changed;
}

function aiConfig(env: Env, fetchImpl?: typeof fetch): AiConfig | null {
  if (!env.OPENAI_API_KEY) return null;
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL || "gpt-5-nano",
    reasoningEffort: env.OPENAI_REASONING_EFFORT || undefined,
    baseUrl: env.OPENAI_BASE_URL || undefined,
    fetchImpl,
  };
}

export type AiTick = { status: "no-key" | "ran"; reviewed: number; failed: number };

export async function aiTick(env: Env, now: Date, fetchImpl?: typeof fetch): Promise<AiTick> {
  const cfg = aiConfig(env, fetchImpl);
  if (!cfg) return { status: "no-key", reviewed: 0, failed: 0 };
  const db = env.DB;
  // Bài nộp chưa có kết quả AI cho đúng nội dung hiện tại. Bài mới nộp trước.
  const rows = (
    await db
      .prepare(
        `SELECT s.learner_id, s.assignment_id, s.status, s.submitted_at, s.answers_json, s.answers_hash, sp.spec_json
         FROM submissions s JOIN assignment_specs sp ON sp.assignment_id = s.assignment_id
         LEFT JOIN ai_reviews r ON r.learner_id = s.learner_id AND r.assignment_id = s.assignment_id
         WHERE s.submission_id IS NOT NULL
           AND (r.learner_id IS NULL OR r.answers_hash != s.answers_hash OR r.version != ?
                OR (r.status = 'loi' AND r.attempts < ?))
         ORDER BY s.submitted_at DESC LIMIT ?`,
      )
      .bind(AI_VERSION, AI_MAX_ATTEMPTS, AI_PER_TICK * 3)
      .all<SubRow & { spec_json: string }>()
  ).results;

  let reviewed = 0;
  let failed = 0;
  const save = (r: SubRow, status: "ok" | "loi", result: AiVerdict[] | null, error: string | null) =>
    db
      .prepare(
        `INSERT INTO ai_reviews (learner_id, assignment_id, answers_hash, version, status, result_json, model, error, attempts, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,1,?9)
         ON CONFLICT(learner_id, assignment_id) DO UPDATE SET
           attempts = CASE WHEN ai_reviews.answers_hash = excluded.answers_hash AND ai_reviews.version = excluded.version
                           AND ai_reviews.status = 'loi' THEN ai_reviews.attempts + 1 ELSE 1 END,
           answers_hash=excluded.answers_hash, version=excluded.version, status=excluded.status,
           result_json=excluded.result_json, model=excluded.model, error=excluded.error, created_at=excluded.created_at`,
      )
      .bind(r.learner_id, r.assignment_id, r.answers_hash ?? "", AI_VERSION, status, result ? JSON.stringify(result) : null, cfg.model, error, now.toISOString())
      .run();

  // Bài không có câu nào cần AI: ghi lại ngay để khỏi xét lại. Bài còn lại gửi AI theo nhóm chạy song song.
  const work: { r: SubRow; items: ReturnType<typeof aiTasks> }[] = [];
  for (const r of rows) {
    const items = aiTasks(JSON.parse(r.spec_json) as AssignmentSpec, parseAnswers(r.answers_json));
    if (items.length === 0) await save(r, "ok", [], null);
    else if (work.length < AI_PER_TICK) work.push({ r, items });
  }
  for (let i = 0; i < work.length; i += AI_CONCURRENCY) {
    const group = work.slice(i, i + AI_CONCURRENCY);
    const outs = await Promise.all(group.map((w) => reviewItems(cfg, w.items)));
    let stop = false;
    for (const [k, out] of outs.entries()) {
      const r = group[k]!.r;
      if (out.ok) {
        reviewed++;
        await save(r, "ok", out.verdicts, null);
      } else {
        failed++;
        await save(r, "loi", null, out.error);
        stop ||= out.stop; // khóa sai / hết hạn mức: dừng cả lượt, không gọi dồn
      }
    }
    if (stop) break;
  }
  return { status: "ran", reviewed, failed };
}

/** `only`: tính lại ngay đúng một bài nộp (ví dụ sau khi BTC sửa tay), bỏ qua điều kiện "có thay đổi". */
export async function recomputeScores(
  db: D1Database,
  now: Date,
  only?: { learnerId: number; assignmentId: number },
): Promise<number> {
  const today = nowVN(now);
  // Bài đã tới hạn, chưa có điểm hoặc có thay đổi sau lần tính trước (bài nộp, đề, kết quả AI).
  const rows = (
    await db
      .prepare(
        `SELECT s.learner_id, s.assignment_id, s.status, s.submitted_at, s.answers_json, s.answers_hash,
                a.due_at, sp.spec_json, r.result_json AS ai_json, r.answers_hash AS ai_hash, r.status AS ai_status
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN assignment_specs sp ON sp.assignment_id = s.assignment_id
         LEFT JOIN ai_reviews r ON r.learner_id = s.learner_id AND r.assignment_id = s.assignment_id
         LEFT JOIN scores sc ON sc.learner_id = s.learner_id AND sc.assignment_id = s.assignment_id
         WHERE a.due_at >= ?1 AND a.due_at <= ?2
           AND (?4 IS NULL OR (s.learner_id = ?4 AND s.assignment_id = ?5))
           AND (?4 IS NOT NULL OR sc.learner_id IS NULL OR sc.computed_at < s.changed_at OR sc.computed_at < sp.updated_at
                OR (r.created_at IS NOT NULL AND sc.computed_at < r.created_at)
                OR EXISTS (SELECT 1 FROM score_overrides o WHERE o.learner_id = s.learner_id
                           AND o.assignment_id = s.assignment_id AND o.at > sc.computed_at))
         LIMIT ?3`,
      )
      .bind(SCORING.startDate, today, SCORES_PER_TICK, only?.learnerId ?? null, only?.assignmentId ?? null)
      .all<SubRow & { due_at: string; spec_json: string; ai_json: string | null; ai_hash: string | null; ai_status: string | null }>()
  ).results;
  if (rows.length === 0) return 0;

  const ids = [...new Set(rows.map((r) => r.assignment_id))];
  const ovRows = (
    await db
      .prepare(`SELECT learner_id, assignment_id, question_index, earned, note, by_email FROM score_overrides
                WHERE assignment_id IN (SELECT value FROM json_each(?))`)
      .bind(JSON.stringify(ids))
      .all<{ learner_id: number; assignment_id: number; question_index: number; earned: number; note: string | null; by_email: string }>()
  ).results;
  const ov = new Map<string, Override[]>();
  for (const o of ovRows) {
    const k = `${o.learner_id}:${o.assignment_id}`;
    ov.set(k, [...(ov.get(k) ?? []), { index: o.question_index, earned: o.earned, note: o.note, by: o.by_email }]);
  }

  const iso = now.toISOString();
  const stmts = rows.map((r) => {
    const ai = r.ai_status === "ok" && r.ai_hash === r.answers_hash && r.ai_json ? (JSON.parse(r.ai_json) as AiVerdict[]) : null;
    const s = scoreSubmission({
      spec: JSON.parse(r.spec_json) as AssignmentSpec,
      answers: parseAnswers(r.answers_json),
      status: r.status,
      submittedAt: r.submitted_at,
      dueAt: r.due_at,
      ai,
      overrides: ov.get(`${r.learner_id}:${r.assignment_id}`) ?? null,
    });
    return db
      .prepare(
        `INSERT INTO scores (learner_id, assignment_id, due_at, earned, max, on_time_videos, hours_early, provisional, flags_json, detail_json, computed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(learner_id, assignment_id) DO UPDATE SET due_at=excluded.due_at, earned=excluded.earned, max=excluded.max,
           on_time_videos=excluded.on_time_videos, hours_early=excluded.hours_early, provisional=excluded.provisional,
           flags_json=excluded.flags_json, detail_json=excluded.detail_json, computed_at=excluded.computed_at`,
      )
      .bind(
        r.learner_id, r.assignment_id, r.due_at, s.earned, s.max, s.onTimeVideos, s.hoursEarly, s.provisional ? 1 : 0,
        JSON.stringify(s.flags), JSON.stringify(s.detail), iso,
      );
  });
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return rows.length;
}

export async function scoringTick(env: Env, now: Date, fetchImpl?: typeof fetch) {
  const specs = await refreshSpecs(env.DB, now);
  const ai = await aiTick(env, now, fetchImpl);
  const scored = await recomputeScores(env.DB, now);
  return { specs, ai, scored };
}
