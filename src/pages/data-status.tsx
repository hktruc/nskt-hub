import { formatVN } from "../dates";
import type { Env } from "../env";
import { Layout } from "../layout";

type JobRow = {
  id: number;
  report: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  attempts: number;
  finished_at: string | null;
  http_status: number | null;
  bytes: number | null;
  summary: string | null;
  error: string | null;
};

export type DataStatus = {
  hasKey: boolean;
  counts: { label: string; value: number }[];
  byStatus: { status: string; n: number }[];
  queue: { pending: number; running: number; failed: number };
  lastSuccess: string | null;
  lastError: JobRow | null;
  recent: JobRow[];
};

const STATUS_VI: Record<string, string> = {
  // Nhãn theo đúng cách dh3g gọi (đã đối chiếu dữ liệu thật 2026-11-11).
  DONE: "Đúng hạn",
  OVERDUE: "Nộp trễ (sau hạn)",
  LATE: "Nộp muộn",
  NOT_SUBMITTED: "Chưa nộp (kể cả bài chưa tới hạn)",
};
const JOB_VI: Record<string, string> = {
  pending: "Đang chờ",
  running: "Đang chạy",
  done: "Xong",
  failed: "Lỗi",
};
const REPORT_VI: Record<string, string> = { submissions: "Bài nộp", attendance: "Điểm danh" };
const REASON_VI: Record<string, string> = { daily: "Hàng ngày", full: "Toàn bộ (tự động)", manual: "Bấm tay" };

export async function loadDataStatus(env: Env): Promise<DataStatus> {
  const db = env.DB;
  const count = (t: string) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`);
  const [learners, teams, assignments, submissions, sessions, attendances, byStatus, queue, last, lastError, recent] =
    await db.batch([
      count("learners"),
      count("teams"),
      count("assignments"),
      count("submissions"),
      count("sessions"),
      count("attendances"),
      db.prepare("SELECT COALESCE(status, '?') AS status, COUNT(*) AS n FROM submissions GROUP BY status ORDER BY n DESC"),
      db.prepare("SELECT status, COUNT(*) AS n FROM sync_jobs WHERE status != 'done' GROUP BY status"),
      db.prepare("SELECT MAX(finished_at) AS at FROM sync_jobs WHERE status='done'"),
      db.prepare("SELECT * FROM sync_jobs WHERE error IS NOT NULL ORDER BY id DESC LIMIT 1"),
      db.prepare("SELECT * FROM sync_jobs WHERE status IN ('done','failed') ORDER BY finished_at DESC, id DESC LIMIT 20"),
    ]);
  const n = (r: D1Result | undefined) => Number((r?.results[0] as { n?: number } | undefined)?.n ?? 0);
  const q = Object.fromEntries(((queue?.results ?? []) as { status: string; n: number }[]).map((r) => [r.status, r.n]));
  return {
    hasKey: Boolean(env.DH3G_API_KEY),
    counts: [
      { label: "Học viên", value: n(learners) },
      { label: "Đội", value: n(teams) },
      { label: "Bài tập", value: n(assignments) },
      { label: "Bài nộp (kể cả chưa nộp)", value: n(submissions) },
      { label: "Buổi học", value: n(sessions) },
      { label: "Lượt điểm danh", value: n(attendances) },
    ],
    byStatus: (byStatus?.results ?? []) as { status: string; n: number }[],
    queue: { pending: q.pending ?? 0, running: q.running ?? 0, failed: q.failed ?? 0 },
    lastSuccess: ((last?.results[0] as { at?: string | null } | undefined)?.at ?? null) as string | null,
    lastError: ((lastError?.results[0] as JobRow | undefined) ?? null),
    recent: (recent?.results ?? []) as JobRow[],
  };
}

function summaryText(s: string | null): string {
  if (!s) return "";
  try {
    const o = JSON.parse(s) as Record<string, number>;
    const names: Record<string, string> = {
      hoc_vien: "học viên",
      bai_tap: "bài tập",
      bai_nop: "bài nộp",
      buoi_hoc: "buổi học",
      diem_danh: "điểm danh",
    };
    return Object.entries(o)
      .map(([k, v]) => `${v} ${names[k] ?? k}`)
      .join(", ");
  } catch {
    return "";
  }
}

export function DataStatusPage(props: { status: DataStatus; notice?: string }) {
  const s = props.status;
  const waiting = s.queue.pending + s.queue.running;
  return (
    <Layout title="Tình trạng dữ liệu">
      <h1>Tình trạng dữ liệu</h1>
      {props.notice ? <p class="notice">{props.notice}</p> : null}

      {!s.hasKey ? (
        <p class="warn">
          Chưa nhập khóa dh3g cho ứng dụng này, nên chưa lấy được dữ liệu. Khóa được nhập trên Cloudflare dưới dạng secret
          tên <code>DH3G_API_KEY</code>.
        </p>
      ) : null}

      <p>
        Lần lấy dữ liệu thành công gần nhất: <strong>{formatVN(s.lastSuccess)}</strong> (giờ Việt Nam).{" "}
        {waiting > 0 ? `Còn ${waiting} khoảng ngày đang chờ xử lý, mỗi 5 phút xử lý vài khoảng.` : "Không còn việc nào đang chờ."}{" "}
        {s.queue.failed > 0 ? `Có ${s.queue.failed} khoảng ngày bị lỗi.` : ""}
      </p>
      {s.lastError ? (
        <p class="warn">
          Lỗi gần nhất: {s.lastError.error} ({REPORT_VI[s.lastError.report] ?? s.lastError.report}, {s.lastError.from_date}
          {s.lastError.to_date !== s.lastError.from_date ? ` đến ${s.lastError.to_date}` : ""}).
        </p>
      ) : null}

      <div class="tiles">
        {s.counts.map((c) => (
          <div class="tile">
            <div class="num">{c.value.toLocaleString("vi-VN")}</div>
            <div class="lbl">{c.label}</div>
          </div>
        ))}
      </div>

      {s.byStatus.length > 0 ? (
        <>
          <h2>Bài nộp theo trạng thái</h2>
          <table>
            <tbody>
              {s.byStatus.map((r) => (
                <tr>
                  <td>{STATUS_VI[r.status] ?? r.status}</td>
                  <td class="r">{r.n.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      <h2>Lấy dữ liệu ngay</h2>
      <p class="muted">
        Ứng dụng tự lấy dữ liệu mỗi sáng lúc 07:15. Hai nút dưới đây chỉ xếp việc vào hàng đợi; dữ liệu sẽ về dần trong
        vài phút đến vài chục phút.
      </p>
      <form method="post" action="/du-lieu/dong-bo" class="actions">
        <button name="pham-vi" value="gan-day">Làm mới 2 tuần gần đây</button>
        <button name="pham-vi" value="toan-bo" class="secondary">
          Tải lại toàn bộ từ đầu khóa
        </button>
      </form>

      <h2>20 lần gọi dh3g gần nhất</h2>
      {s.recent.length === 0 ? (
        <p class="muted">Chưa có lần nào.</p>
      ) : (
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Lúc</th>
                <th>Loại</th>
                <th>Khoảng ngày</th>
                <th>Lý do</th>
                <th>Kết quả</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((j) => (
                <tr>
                  <td>{formatVN(j.finished_at)}</td>
                  <td>{REPORT_VI[j.report] ?? j.report}</td>
                  <td>{j.from_date === j.to_date ? j.from_date : `${j.from_date} → ${j.to_date}`}</td>
                  <td>{REASON_VI[j.reason] ?? j.reason}</td>
                  <td>{JOB_VI[j.status] ?? j.status}</td>
                  <td>{j.status === "done" ? summaryText(j.summary) : j.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
