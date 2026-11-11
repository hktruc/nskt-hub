import type { AttendanceReport, SubmissionsReport } from "./parse";
import type { ReportKind } from "./client";

// Ghi nhiều dòng trong một câu lệnh bằng cách truyền một mảng JSON (json_each),
// nên mỗi khoảng ngày chỉ cần vài câu lệnh dù có hàng trăm học viên.

const CHUNK_BYTES = 400_000;
const RAW_CHUNK_BYTES = 900_000;

/** Chia một danh sách thành các mảng JSON, mỗi mảng khoảng 400 KB. */
function jsonChunks(rows: unknown[]): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let size = 0;
  for (const r of rows) {
    const s = JSON.stringify(r);
    if (cur.length > 0 && size + s.length > CHUNK_BYTES) {
      out.push(`[${cur.join(",")}]`);
      cur = [];
      size = 0;
    }
    cur.push(s);
    size += s.length;
  }
  if (cur.length > 0) out.push(`[${cur.join(",")}]`);
  return out;
}

function x(col: string): string {
  return `json_extract(j.value, '$.${col}')`;
}

/** INSERT ... ON CONFLICT cập nhật mọi cột dữ liệu và last_seen_at. */
function upsertSql(table: string, keys: string[], cols: string[], firstSeen: boolean): string {
  const all = [...keys, ...cols];
  const names = [...all, ...(firstSeen ? ["first_seen_at"] : []), "last_seen_at"];
  const values = [...all.map(x), ...(firstSeen ? ["?2"] : []), "?2"];
  const sets = [...cols.map((c) => `${c}=excluded.${c}`), "last_seen_at=excluded.last_seen_at"];
  return `INSERT INTO ${table} (${names.join(", ")}) SELECT ${values.join(", ")} FROM json_each(?1) AS j WHERE true
    ON CONFLICT(${keys.join(", ")}) DO UPDATE SET ${sets.join(", ")}`;
}

const TEAM_SQL = upsertSql("teams", ["id"], ["name"], true);
const LEARNER_SQL = upsertSql("learners", ["id"], ["full_name", "phone", "email", "cohort", "team_id"], true);
const ASSIGNMENT_SQL = upsertSql(
  "assignments",
  ["id"],
  ["title", "type", "type_label", "due_at", "grace_minutes", "course_id", "course_name"],
  true,
);
const SESSION_SQL = upsertSql("sessions", ["id"], ["title", "start_at", "end_at", "course_id"], true);
const ATTENDANCE_SQL = upsertSql("attendances", ["learner_id", "session_id"], ["attended", "attended_at"], false);

const SUBMISSION_COLS = [
  "submission_id", "status", "status_label", "raw_status", "priority_status", "submitted_at",
  "edit_count", "last_edited_at", "char_count", "media_count", "feedback_count",
  "edits_json", "answers_json", "feedbacks_json", "answers_hash", "content_hash",
];
// changed_at chỉ đổi khi nội dung bài nộp thật sự khác lần trước.
const SUBMISSION_SQL = `INSERT INTO submissions (learner_id, assignment_id, ${SUBMISSION_COLS.join(", ")}, first_seen_at, changed_at, last_seen_at)
  SELECT ${["learner_id", "assignment_id", ...SUBMISSION_COLS].map(x).join(", ")}, ?2, ?2, ?2 FROM json_each(?1) AS j WHERE true
  ON CONFLICT(learner_id, assignment_id) DO UPDATE SET
    ${SUBMISSION_COLS.map((c) => `${c}=excluded.${c}`).join(", ")},
    changed_at=CASE WHEN submissions.content_hash IS excluded.content_hash THEN submissions.changed_at ELSE excluded.changed_at END,
    last_seen_at=excluded.last_seen_at`;

function statements(db: D1Database, sql: string, rows: unknown[], now: string): D1PreparedStatement[] {
  return jsonChunks(rows).map((chunk) => db.prepare(sql).bind(chunk, now));
}

export type Counts = Record<string, number>;

export async function storeSubmissions(db: D1Database, r: SubmissionsReport, now: string): Promise<Counts> {
  const batch = [
    ...statements(db, TEAM_SQL, r.teams, now),
    ...statements(db, LEARNER_SQL, r.learners, now),
    ...statements(db, ASSIGNMENT_SQL, r.assignments, now),
    ...statements(db, SUBMISSION_SQL, r.submissions, now),
  ];
  if (batch.length > 0) await db.batch(batch);
  return {
    hoc_vien: r.learners.length,
    bai_tap: r.assignments.length,
    bai_nop: r.submissions.length,
  };
}

export async function storeAttendance(db: D1Database, r: AttendanceReport, now: string): Promise<Counts> {
  const batch = [
    ...statements(db, TEAM_SQL, r.teams, now),
    ...statements(db, LEARNER_SQL, r.learners, now),
    ...statements(db, SESSION_SQL, r.sessions, now),
    ...statements(db, ATTENDANCE_SQL, r.attendances, now),
  ];
  if (batch.length > 0) await db.batch(batch);
  return {
    hoc_vien: r.learners.length,
    buoi_hoc: r.sessions.length,
    diem_danh: r.attendances.length,
  };
}

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lưu bản gốc mới nhất của một khoảng ngày (thay bản trước đó nếu có). */
export async function storeRaw(
  db: D1Database,
  key: { report: ReportKind; from: string; to: string },
  text: string,
  meta: { sha256: string; bytes: number; generatedAt: string | null; now: string },
): Promise<void> {
  const packed = await gzip(text);
  const k = [key.report, key.from, key.to] as const;
  const batch: D1PreparedStatement[] = [
    db.prepare("DELETE FROM raw_chunks WHERE report=? AND from_date=? AND to_date=?").bind(...k),
    db
      .prepare(
        `INSERT INTO raw_responses (report, from_date, to_date, fetched_at, generated_at, sha256, bytes) VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(report, from_date, to_date) DO UPDATE SET fetched_at=excluded.fetched_at,
           generated_at=excluded.generated_at, sha256=excluded.sha256, bytes=excluded.bytes`,
      )
      .bind(...k, meta.now, meta.generatedAt, meta.sha256, meta.bytes),
  ];
  for (let seq = 0, at = 0; at < packed.length; seq++, at += RAW_CHUNK_BYTES) {
    batch.push(
      db
        .prepare("INSERT INTO raw_chunks (report, from_date, to_date, seq, data) VALUES (?,?,?,?,?)")
        .bind(...k, seq, packed.slice(at, at + RAW_CHUNK_BYTES)),
    );
  }
  await db.batch(batch);
}
