import { addDays, vietnamDay, windows } from "../dates";
import { fetchReport, type Dh3gConfig, type ReportKind } from "../dh3g/client";
import { ParseError, parseAttendance, parseSubmissions, sha256 } from "../dh3g/parse";
import { storeAttendance, storeRaw, storeSubmissions } from "../dh3g/store";
import type { Env } from "../env";

// Cách đồng bộ:
// - Mỗi ngày lên kế hoạch một lần: thêm vào hàng đợi các khoảng ngày cần gọi dh3g.
// - Cứ 5 phút xử lý vài khoảng trong hàng đợi. Hàng đợi trống thì không làm gì.
// dh3g lọc bài nộp theo HẠN NỘP của bài tập, và điểm danh theo ngày bắt đầu buổi học.

/** Phải khớp với wrangler.jsonc. 00:15 UTC = 07:15 giờ Việt Nam. */
export const DAILY_CRON = "15 0 * * *";
export const SUBMISSION_WINDOW_DAYS = 1;
export const ATTENDANCE_WINDOW_DAYS = 7;
/** Mỗi ngày làm mới các bài có hạn nộp từ 14 ngày trước đến 7 ngày tới. */
export const RECENT_DAYS_BACK = 14;
export const DAYS_AHEAD = 7;
export const JOBS_PER_TICK = 3;
export const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 10 * 60_000;

export type Reason = "daily" | "full" | "manual";

export type Job = {
  id: number;
  report: ReportKind;
  from_date: string;
  to_date: string;
  attempts: number;
};

/** Thêm các khoảng ngày vào hàng đợi. Khoảng đang chờ sẵn thì bỏ qua. */
export async function enqueueRange(
  db: D1Database,
  from: string,
  to: string,
  reason: Reason,
  now: Date,
): Promise<number> {
  if (from > to) return 0;
  const iso = now.toISOString();
  const sql = `INSERT OR IGNORE INTO sync_jobs (report, from_date, to_date, reason, enqueued_at) VALUES (?,?,?,?,?)`;
  const stmts = [
    ...windows(from, to, SUBMISSION_WINDOW_DAYS).map((w) => db.prepare(sql).bind("submissions", w.from, w.to, reason, iso)),
    ...windows(from, to, ATTENDANCE_WINDOW_DAYS).map((w) => db.prepare(sql).bind("attendance", w.from, w.to, reason, iso)),
  ];
  let added = 0;
  for (let i = 0; i < stmts.length; i += 50) {
    const results = await db.batch(stmts.slice(i, i + 50));
    for (const r of results) added += r.meta.changes ?? 0;
  }
  return added;
}

/** Kế hoạch hàng ngày. Lần đầu tiên (chưa có gì) hoặc thứ Hai: tải lại toàn bộ từ ngày bắt đầu. */
export async function planDaily(env: Env, now: Date): Promise<{ added: number; full: boolean }> {
  const today = vietnamDay(now);
  const any = await env.DB.prepare("SELECT 1 AS x FROM sync_jobs LIMIT 1").first();
  const monday = new Date(`${today}T00:00:00Z`).getUTCDay() === 1;
  const full = !any || monday;
  const recentFrom = addDays(today, -RECENT_DAYS_BACK);
  const from = full || recentFrom < env.SYNC_START_DATE ? env.SYNC_START_DATE : recentFrom;
  const added = await enqueueRange(env.DB, from, addDays(today, DAYS_AHEAD), full ? "full" : "daily", now);
  return { added, full };
}

export async function planFull(env: Env, now: Date): Promise<number> {
  return enqueueRange(env.DB, env.SYNC_START_DATE, addDays(vietnamDay(now), DAYS_AHEAD), "manual", now);
}

async function claim(db: D1Database, now: Date): Promise<Job | null> {
  return db
    .prepare(
      `UPDATE sync_jobs SET status='running', started_at=?1, attempts=attempts+1
       WHERE id=(SELECT id FROM sync_jobs WHERE status='pending' ORDER BY from_date DESC, id LIMIT 1)
       RETURNING id, report, from_date, to_date, attempts`,
    )
    .bind(now.toISOString())
    .first<Job>();
}

type Outcome =
  | { ok: true; httpStatus: number; bytes: number; summary: Record<string, number> }
  | { ok: false; httpStatus: number | null; error: string; retry: boolean; stop: boolean };

async function runJob(db: D1Database, cfg: Dh3gConfig, job: Job, now: Date): Promise<Outcome> {
  const res = await fetchReport(cfg, job.report, job.from_date, job.to_date);
  if (!res.ok) {
    const s = res.status;
    const denied = s === 401 || s === 403;
    // Khóa bị từ chối hoặc bị giới hạn: dừng cả lượt, không gọi dồn dập.
    // Riêng điểm danh bị từ chối/không có thì chỉ đánh dấu lỗi, bài nộp vẫn chạy tiếp.
    const attendanceUnavailable = job.report === "attendance" && (denied || s === 404);
    return {
      ok: false,
      httpStatus: s,
      error: res.error,
      retry: !attendanceUnavailable && !(s !== null && s >= 400 && s < 500 && !denied && s !== 429),
      stop: (denied && !attendanceUnavailable) || s === 429,
    };
  }
  try {
    const iso = now.toISOString();
    const key = { report: job.report, from: job.from_date, to: job.to_date };
    const hash = await sha256(res.text);
    let summary: Record<string, number>;
    if (job.report === "submissions") {
      const parsed = await parseSubmissions(res.text);
      await storeRaw(db, key, res.text, { sha256: hash, bytes: res.bytes, generatedAt: parsed.generatedAt, now: iso });
      summary = await storeSubmissions(db, parsed, iso);
    } else {
      const parsed = parseAttendance(res.text);
      await storeRaw(db, key, res.text, { sha256: hash, bytes: res.bytes, generatedAt: parsed.generatedAt, now: iso });
      summary = await storeAttendance(db, parsed, iso);
    }
    return { ok: true, httpStatus: 200, bytes: res.bytes, summary };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, httpStatus: 200, error: e.message, retry: false, stop: false };
    }
    console.error("sync: lỗi ghi dữ liệu", e instanceof Error ? e.message : "");
    return { ok: false, httpStatus: 200, error: "lỗi khi ghi vào cơ sở dữ liệu", retry: true, stop: false };
  }
}

export type TickResult = { status: "no-key" | "ran"; done: number; failed: number };

/** Xử lý vài việc trong hàng đợi. Gọi bởi cron mỗi 5 phút. */
export async function workQueue(env: Env, now: Date, fetchImpl?: typeof fetch): Promise<TickResult> {
  const db = env.DB;
  if (!env.DH3G_API_KEY) return { status: "no-key", done: 0, failed: 0 };
  const cfg: Dh3gConfig = {
    baseUrl: env.DH3G_BASE_URL,
    communityId: env.DH3G_COMMUNITY_ID,
    apiKey: env.DH3G_API_KEY,
    fetchImpl,
  };

  // Việc bị treo (worker dừng giữa chừng) được trả lại hàng đợi.
  await db
    .prepare("UPDATE sync_jobs SET status='pending' WHERE status='running' AND started_at < ?")
    .bind(new Date(now.getTime() - STUCK_AFTER_MS).toISOString())
    .run();

  let done = 0;
  let failed = 0;
  for (let i = 0; i < JOBS_PER_TICK; i++) {
    const job = await claim(db, now);
    if (!job) break;
    const out = await runJob(db, cfg, job, now);
    const finished = new Date().toISOString();
    if (out.ok) {
      done++;
      await db
        .prepare("UPDATE sync_jobs SET status='done', finished_at=?, http_status=?, bytes=?, summary=?, error=NULL WHERE id=?")
        .bind(finished, out.httpStatus, out.bytes, JSON.stringify(out.summary), job.id)
        .run();
      continue;
    }
    failed++;
    if (out.stop) {
      // Lỗi do khóa hoặc giới hạn gọi: giữ việc trong hàng đợi, không tính là một lần thử.
      await db
        .prepare("UPDATE sync_jobs SET status='pending', attempts=attempts-1, http_status=?, error=? WHERE id=?")
        .bind(out.httpStatus, out.error, job.id)
        .run();
      break;
    }
    const again = out.retry && job.attempts < MAX_ATTEMPTS;
    await db
      .prepare("UPDATE sync_jobs SET status=?, finished_at=?, http_status=?, error=? WHERE id=?")
      .bind(again ? "pending" : "failed", again ? null : finished, out.httpStatus, out.error, job.id)
      .run();
  }
  return { status: "ran", done, failed };
}
