import { formatVN } from "../dates";
import { isLearnerTeam, teamCode, teamLabel } from "../domain/teams";
import type { Env } from "../env";
import { Layout } from "../layout";
import { SCORING } from "../scoring/config";
import { gradableAssignments, loadQueue } from "../grading/store";
import { loadColorTrend, loadLeaderboard } from "../scoring/leaderboard";
import { bucketOf, nowVietnam, shortVN, type Bucket } from "./submissions";

// Trang chủ cho BTC: nhìn một lần thấy tình hình cả khóa, rồi bấm đi tiếp vào trang chi tiết.

type Assignment = { id: number; title: string | null; type: string | null; due_at: string };
type TeamRow = {
  team: string;
  learners: number;
  avg: number;
  xanh: number;
  vang: number;
  do: number;
  lastSubmitted: number; // nộp bài gần nhất (đúng hạn + trễ)
  lastPresent: number | null; // có mặt buổi offline gần nhất
  lastCounted: number | null;
};

export type Overview = {
  learners: number;
  colors: { xanh: number; vang: number; do: number };
  colorsWeekAgo: { xanh: number; vang: number; do: number } | null;
  avg: number;
  provisional: boolean;
  hasAttendance: boolean;
  last: { a: Assignment; counts: Record<Bucket, number> } | null;
  next: { a: Assignment; submitted: number } | null;
  session: { day: string; present: number; late: number; excused: number; absent: number; counted: number } | null;
  flags: { total: number; week: number };
  aiPending: number;
  dh3gAt: string | null;
  sheet: { at: string; status: string } | null;
  teams: TeamRow[];
  grading: { week: { id: number; title: string | null }; todo: number; overdue: number; done: number; submitted: number } | null;
};

const PRESENT = new Set(["OK", "M", "X", "M1", "CANH_BAO"]);

export async function loadOverview(env: Env, now = new Date()): Promise<Overview> {
  const db = env.DB;
  const nowVN = nowVietnam(now);
  const [lb, trend] = await Promise.all([loadLeaderboard(db, nowVN), loadColorTrend(db, nowVN)]);
  const ranked = lb.ranked;
  const [lastA, nextA, flags, ai, dh3g, sheet, lastDay] = await db.batch([
    db.prepare("SELECT id, title, type, due_at FROM assignments WHERE due_at <= ? AND due_at >= ? ORDER BY due_at DESC, id DESC LIMIT 1").bind(nowVN, SCORING.startDate),
    db.prepare("SELECT id, title, type, due_at FROM assignments WHERE due_at > ? ORDER BY due_at ASC, id ASC LIMIT 1").bind(nowVN),
    db.prepare("SELECT COUNT(*) AS n, SUM(due_at >= ?) AS w FROM scores WHERE flags_json != '[]' AND due_at >= ?").bind(
      `${new Date(now.getTime() + 7 * 3_600_000 - 7 * 86_400_000).toISOString().slice(0, 10)}`,
      SCORING.startDate,
    ),
    db.prepare("SELECT COUNT(*) AS n FROM scores WHERE provisional = 1 AND due_at >= ?").bind(SCORING.startDate),
    db.prepare("SELECT MAX(finished_at) AS at FROM sync_jobs WHERE status = 'done'"),
    db.prepare("SELECT at, status FROM sheet_syncs ORDER BY id DESC LIMIT 1"),
    db.prepare("SELECT MAX(session_day) AS d FROM offline_attendance"),
  ]);
  const first = <T,>(r: D1Result | undefined) => (r?.results[0] as T | undefined) ?? null;
  const la = first<Assignment>(lastA);
  const na = first<Assignment>(nextA);
  const day = first<{ d: string | null }>(lastDay)?.d ?? null;
  const subsOf = async (id: number) =>
    (
      await db
        .prepare(
          `SELECT s.learner_id, s.status, t.name AS team_name FROM submissions s JOIN learners l ON l.id = s.learner_id
           LEFT JOIN teams t ON t.id = l.team_id WHERE s.assignment_id = ?`,
        )
        .bind(id)
        .all<{ learner_id: number; status: string | null; team_name: string | null }>()
    ).results.filter((r) => isLearnerTeam(teamCode(r.team_name)));
  const lastSubs = la ? await subsOf(la.id) : [];
  const nextSubs = na ? await subsOf(na.id) : [];
  const sessionRows = day
    ? (await db.prepare("SELECT learner_id, code FROM offline_attendance WHERE session_day = ?").bind(day).all<{ learner_id: number; code: string }>()).results
    : [];

  const counts: Record<Bucket, number> = { "dung-han": 0, tre: 0, "chua-nop": 0, "chua-toi-han": 0 };
  const submittedBy = new Set<number>();
  for (const s of lastSubs) {
    const b = bucketOf(s.status, la!.due_at, nowVN);
    counts[b]++;
    if (b === "dung-han" || b === "tre") submittedBy.add(s.learner_id);
  }
  const att = new Map(sessionRows.map((r) => [r.learner_id, r.code]));
  const counted = sessionRows.filter((r) => r.code !== "PD" && r.code !== "KHAC");

  const teamCodes = [...new Set(ranked.map((r) => r.team))].sort();
  const teams: TeamRow[] = teamCodes.map((team) => {
    const m = ranked.filter((r) => r.team === team);
    const ids = new Set(m.map((r) => r.learnerId));
    const inSession = [...ids].filter((id) => att.has(id) && att.get(id) !== "PD" && att.get(id) !== "KHAC");
    return {
      team,
      learners: m.length,
      avg: m.length ? Math.round((10 * m.reduce((a, r) => a + r.percent, 0)) / m.length) / 10 : 0,
      xanh: m.filter((r) => r.color === "xanh").length,
      vang: m.filter((r) => r.color === "vang").length,
      do: m.filter((r) => r.color === "do").length,
      lastSubmitted: [...ids].filter((id) => submittedBy.has(id)).length,
      lastPresent: day ? inSession.filter((id) => PRESENT.has(att.get(id)!)).length : null,
      lastCounted: day ? inSession.length : null,
    };
  });

  const week = (await gradableAssignments(db, nowVN))[0];
  const queue = week ? await loadQueue(db, week, null, nowVN) : [];
  const sub = queue.filter((l) => l.status !== "chua-nop");
  const todoL = sub.filter((l) => l.status !== "da-cham");
  const f = first<{ n: number; w: number | null }>(flags);
  return {
    learners: ranked.length,
    colors: {
      xanh: ranked.filter((r) => r.color === "xanh").length,
      vang: ranked.filter((r) => r.color === "vang").length,
      do: ranked.filter((r) => r.color === "do").length,
    },
    colorsWeekAgo: trend.weekAgo.xanh + trend.weekAgo.vang + trend.weekAgo.do ? trend.weekAgo : null,
    avg: ranked.length ? Math.round((10 * ranked.reduce((a, r) => a + r.percent, 0)) / ranked.length) / 10 : 0,
    provisional: lb.provisional,
    hasAttendance: lb.hasAttendance,
    last: la ? { a: la, counts } : null,
    next: na ? { a: na, submitted: nextSubs.filter((s) => s.status === "DONE" || s.status === "OVERDUE" || s.status === "LATE").length } : null,
    session: day
      ? {
          day,
          present: counted.filter((r) => PRESENT.has(r.code)).length,
          late: counted.filter((r) => r.code === "M" || r.code === "M1").length,
          excused: counted.filter((r) => r.code === "P").length,
          absent: counted.filter((r) => r.code === "VANG").length,
          counted: counted.length,
        }
      : null,
    flags: { total: Number(f?.n ?? 0), week: Number(f?.w ?? 0) },
    aiPending: Number(first<{ n: number }>(ai)?.n ?? 0),
    dh3gAt: first<{ at: string | null }>(dh3g)?.at ?? null,
    sheet: first<{ at: string; status: string }>(sheet),
    teams,
    grading: week ? { week: { id: week.id, title: week.title }, todo: todoL.length, overdue: todoL.filter((l) => l.overdue).length, done: sub.length - todoL.length, submitted: sub.length } : null,
  };
}

const TYPE_VI: Record<string, string> = { NORMAL: "Bài ngày", WEEK: "Bài tuần", EXAM: "Bài thi" };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export function OverviewPage(props: { o: Overview }) {
  const { o } = props;
  const last = o.last;
  const lastTotal = last ? last.counts["dung-han"] + last.counts.tre + last.counts["chua-nop"] + last.counts["chua-toi-han"] : 0;
  return (
    <Layout title="Tổng quan">
      <h1>Tổng quan NSKT2026</h1>
      <p class="muted small">
        {o.learners} học viên · {o.teams.length} đội · dữ liệu dh3g lấy lúc {formatVN(o.dh3gAt)}
        {o.sheet ? ` · điểm danh đọc lúc ${formatVN(o.sheet.at)}` : ""}.
      </p>

      <h2>Xếp hạng</h2>
      <a class="ov-colors" href="/bang-xep-hang">
        {(["xanh", "vang", "do"] as const).map((c) => {
          const diff = o.colorsWeekAgo ? o.colors[c] - o.colorsWeekAgo[c] : 0;
          return (
            <span class={`ov-color ${c}`}>
              <strong>{o.colors[c]}</strong> {{ xanh: "Xanh", vang: "Vàng", do: "Đỏ" }[c]}
              {o.colorsWeekAgo && diff !== 0 ? (
                <span class={`trend ${(c === "do" ? diff < 0 : c === "xanh" ? diff > 0 : false) ? "good" : (c === "do" ? diff > 0 : c === "xanh" ? diff < 0 : false) ? "bad" : ""}`}>
                  {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}
                </span>
              ) : null}
            </span>
          );
        })}
        <span class="muted small">Điểm trung bình {o.avg.toLocaleString("vi-VN")}% →</span>
      </a>
      {o.colorsWeekAgo ? <p class="muted small" style="margin:4px 0 0">Mũi tên: thay đổi so với 7 ngày trước.</p> : null}
      {o.provisional ? <p class="muted small">Còn {o.aiPending.toLocaleString("vi-VN")} bài đang chờ AI chấm.</p> : null}

      <div class="ov-grid">
        {last ? (
          <a class="tile" href={`/nop-bai?bt=${last.a.id}`}>
            <div class="lbl">
              Bài vừa hết hạn · {TYPE_VI[last.a.type ?? ""] ?? "Bài"} · hạn {shortVN(last.a.due_at)}
            </div>
            <div class="ov-title">{last.a.title}</div>
            <div class="bar">
              <span style={`width:${pct(last.counts["dung-han"] + last.counts.tre, lastTotal)}%`} />
            </div>
            <div class="small">
              <strong>{last.counts["dung-han"]}</strong> đúng hạn · <strong>{last.counts.tre}</strong> trễ ·{" "}
              <strong>{last.counts["chua-nop"]}</strong> chưa nộp
            </div>
          </a>
        ) : null}
        {o.next ? (
          <a class="tile" href={`/nop-bai?bt=${o.next.a.id}`}>
            <div class="lbl">Bài sắp tới hạn · hạn {shortVN(o.next.a.due_at)}</div>
            <div class="ov-title">{o.next.a.title}</div>
            <div class="bar">
              <span style={`width:${pct(o.next.submitted, o.learners)}%`} />
            </div>
            <div class="small">
              Đã nộp sớm <strong>{o.next.submitted}</strong>/{o.learners}
            </div>
          </a>
        ) : null}
        <a class="tile" href="/du-lieu#diem-danh">
          <div class="lbl">Buổi học offline gần nhất{o.session ? ` · ${ddmm(o.session.day)}` : ""}</div>
          {o.session ? (
            <>
              <div class="num">
                {o.session.present}/{o.session.counted}
              </div>
              <div class="small">
                có mặt · {o.session.late} muộn · {o.session.excused} có phép · <strong>{o.session.absent} vắng</strong>
              </div>
            </>
          ) : (
            <div class="small muted">Chưa có dữ liệu điểm danh.</div>
          )}
        </a>
        {o.grading ? (
          <a class="tile" href={`/cham?bt=${o.grading.week.id}&loc=chua-cham`}>
            <div class="lbl">Chấm bài tuần · {(o.grading.week.title ?? "").replace(/\s*\(X10\)\s*/i, "")}</div>
            <div class="num" style={o.grading.todo ? "color:var(--bad-fg)" : ""}>
              {o.grading.todo}
            </div>
            <div class="small">
              bài chưa chấm{o.grading.overdue ? ` · ${o.grading.overdue} quá hạn` : ""} · đã chấm {o.grading.done}/{o.grading.submitted}
            </div>
          </a>
        ) : null}
        <a class="tile" href="/canh-bao">
          <div class="lbl">Cảnh báo trả lời đối phó</div>
          <div class="num">{o.flags.week.toLocaleString("vi-VN")}</div>
          <div class="small">bài trong 7 ngày qua · tổng {o.flags.total.toLocaleString("vi-VN")}</div>
        </a>
      </div>

      <h2>Theo đội</h2>
      <div class="scroll">
        <table class="ov-teams">
          <thead>
            <tr>
              <th>Đội</th>
              <th class="r">Điểm TB</th>
              <th>Màu</th>
              <th class="r">Nộp bài gần nhất</th>
              <th class="r">Có mặt buổi gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {o.teams.map((t) => (
              <tr>
                <td>
                  <a href={`/bang-xep-hang?doi=${t.team}`}>{teamLabel(t.team)}</a>{" "}
                  <span class="muted small">({t.learners})</span>
                </td>
                <td class="r">
                  <strong>{t.avg.toLocaleString("vi-VN")}%</strong>
                </td>
                <td>
                  <span class="mini xanh">{t.xanh}</span>
                  <span class="mini vang">{t.vang}</span>
                  <span class="mini do">{t.do}</span>
                </td>
                <td class="r">
                  {last ? (
                    <a href={`/nop-bai?bt=${last.a.id}&doi=${t.team}`}>
                      {t.lastSubmitted}/{t.learners}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td class="r">{t.lastCounted ? `${t.lastPresent}/${t.lastCounted}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Đi tới</h2>
      <nav class="ov-links">
        <a href="/nop-bai">Theo dõi nộp bài</a>
        <a href="/cham">Bàn chấm bài tuần</a>
        <a href="/bao-cao">Báo cáo thống kê</a>
        <a href="/bang-xep-hang">Bảng xếp hạng (công khai)</a>
        <a href="/canh-bao">Cảnh báo</a>
        <a href="/du-lieu">Tình trạng dữ liệu</a>
      </nav>
    </Layout>
  );
}
