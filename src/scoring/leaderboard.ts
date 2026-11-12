import { addDays } from "../dates";
import { isLearnerTeam, teamCode } from "../domain/teams";
import { COLOR_LABEL, SCORING, colorOf, type Color } from "./config";

// Bảng xếp hạng: % điểm đạt / tối đa, trong đó bài càng cũ càng "mờ" (trọng số giảm một nửa
// sau mỗi `halfLifeWeeks` tuần). Đồng điểm: nhiều video đúng hạn hơn xếp trên, rồi ai nộp
// video sớm hơn hạn nhiều hơn xếp trên.

export type ScoreRow = {
  learner_id: number;
  full_name: string | null;
  team_name: string | null;
  due_at: string;
  earned: number;
  max: number;
  on_time_videos: number;
  hours_early: number | null;
  provisional: number;
};

export type AttRow = { learner_id: number; session_day: string; code: string };

export type Ranked = {
  rank: number;
  learnerId: number;
  name: string;
  team: string;
  percent: number; // 0–100, làm tròn 1 chữ số: điểm xếp hạng
  studyPercent: number; // điểm bài tập
  attendancePercent: number | null; // điểm đi học offline; null = chưa có buổi nào
  color: Color;
  colorLabel: string;
  onTimeSessions: number; // số buổi có mặt đúng giờ, đúng chỗ
  onTimeVideos: number;
  avgHoursEarly: number;
};

export function weight(dueAt: string, todayVN: string, halfLifeWeeks: number = SCORING.halfLifeWeeks): number {
  const days = Math.floor((Date.parse(`${todayVN.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dueAt.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const weeks = Math.max(0, Math.floor(days / 7));
  return Math.pow(0.5, weeks / halfLifeWeeks);
}

/** Điểm một buổi offline (0…1); null = không tính buổi đó (PD, ký hiệu lạ). */
export function sessionPoints(code: string): number | null {
  const p = SCORING.attendance.points[code];
  return p === undefined ? null : p;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function rank(rows: ScoreRow[], todayVN: string, att: AttRow[] = []): { ranked: Ranked[]; provisional: boolean } {
  const by = new Map<number, { name: string; team: string; num: number; den: number; vids: number; early: number; earlyN: number }>();
  let provisional = false;
  for (const r of rows) {
    const team = teamCode(r.team_name);
    if (!isLearnerTeam(team)) continue;
    if (r.provisional) provisional = true;
    const w = weight(r.due_at, todayVN);
    const e = by.get(r.learner_id) ?? { name: r.full_name ?? `#${r.learner_id}`, team, num: 0, den: 0, vids: 0, early: 0, earlyN: 0 };
    e.num += r.earned * w;
    e.den += r.max * w;
    e.vids += r.on_time_videos;
    if (r.hours_early !== null && r.on_time_videos > 0) {
      e.early += r.hours_early;
      e.earlyN++;
    }
    by.set(r.learner_id, e);
  }
  const attBy = new Map<number, { num: number; den: number; ok: number }>();
  for (const a of att) {
    const p = sessionPoints(a.code);
    if (p === null || a.session_day > todayVN.slice(0, 10)) continue;
    const w = weight(a.session_day, todayVN, SCORING.attendance.halfLifeWeeks);
    const e = attBy.get(a.learner_id) ?? { num: 0, den: 0, ok: 0 };
    e.num += p * w;
    e.den += w;
    if (a.code === "OK") e.ok++;
    attBy.set(a.learner_id, e);
  }
  const share = SCORING.attendance.share;
  const list = [...by.entries()].map(([learnerId, e]) => {
    const study = e.den > 0 ? (100 * e.num) / e.den : 0;
    const a = attBy.get(learnerId);
    const attendance = a && a.den > 0 ? (100 * a.num) / a.den : null;
    const percent = round1(attendance === null ? study : (1 - share) * study + share * attendance);
    const color = colorOf(percent);
    return {
      rank: 0,
      learnerId,
      name: e.name,
      team: e.team,
      percent,
      studyPercent: round1(study),
      attendancePercent: attendance === null ? null : round1(attendance),
      color,
      colorLabel: COLOR_LABEL[color],
      onTimeSessions: a?.ok ?? 0,
      onTimeVideos: e.vids,
      avgHoursEarly: e.earlyN ? Math.round((10 * e.early) / e.earlyN) / 10 : 0,
    };
  });
  const cmp = (a: Ranked, b: Ranked) =>
    b.percent - a.percent || b.onTimeSessions - a.onTimeSessions || b.onTimeVideos - a.onTimeVideos || b.avgHoursEarly - a.avgHoursEarly;
  list.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, "vi"));
  list.forEach((x, i) => {
    const prev = list[i - 1];
    x.rank = prev && cmp(prev, x) === 0 ? prev.rank : i + 1;
  });
  return { ranked: list, provisional };
}

const ROWS_SQL = `SELECT sc.learner_id, l.full_name, t.name AS team_name, sc.due_at, sc.earned, sc.max,
                sc.on_time_videos, sc.hours_early, sc.provisional
         FROM scores sc JOIN learners l ON l.id = sc.learner_id LEFT JOIN teams t ON t.id = l.team_id
         WHERE sc.due_at >= ?`;

async function loadRows(db: D1Database): Promise<ScoreRow[]> {
  return (await db.prepare(ROWS_SQL).bind(SCORING.startDate).all<ScoreRow>()).results;
}

async function loadAtt(db: D1Database): Promise<AttRow[]> {
  return (
    await db.prepare("SELECT learner_id, session_day, code FROM offline_attendance WHERE session_day >= ?").bind(SCORING.startDate).all<AttRow>()
  ).results;
}

export async function loadLeaderboard(db: D1Database, todayVN: string) {
  const [rows, att] = await Promise.all([loadRows(db), loadAtt(db)]);
  const updated = await db.prepare("SELECT MAX(computed_at) AS at FROM scores").first<{ at: string | null }>();
  return { ...rank(rows, todayVN, att), hasAttendance: att.length > 0, updatedAt: updated?.at ?? null };
}

// ---- Chi tiết một học viên (mở khi bấm vào tên trên bảng xếp hạng) ----

export type Snapshot = { day: string; weeksAgo: number; rank: number | null; total: number; percent: number | null };

/** Thứ hạng của học viên ở hôm nay và 1…`weeks` tuần trước: chỉ tính các bài đã tới hạn ở thời điểm đó. */
export function rankHistory(rows: ScoreRow[], learnerId: number, todayVN: string, weeks = 3, att: AttRow[] = []): Snapshot[] {
  const today = todayVN.slice(0, 10);
  const out: Snapshot[] = [];
  for (let k = weeks; k >= 0; k--) {
    const day = addDays(today, -7 * k);
    const ranked = rank(
      k === 0 ? rows : rows.filter((r) => r.due_at.slice(0, 10) <= day),
      day,
      att.filter((a) => a.session_day <= day),
    ).ranked;
    const me = ranked.find((r) => r.learnerId === learnerId);
    out.push({ day, weeksAgo: k, rank: me?.rank ?? null, total: ranked.length, percent: me?.percent ?? null });
  }
  return out;
}

export type WeekScore = { from: string; to: string; earned: number; max: number; percent: number; weightPct: number; videos: number };

export type LearnerDetail = {
  me: Ranked;
  total: number;
  teamRank: number;
  teamTotal: number;
  history: Snapshot[];
  weeks: WeekScore[]; // mới nhất trước
  byType: { label: string; earned: number; max: number }[];
  due: number; // số bài đã tới hạn
  onTime: number;
  late: number;
  missing: number;
  videos: number; // video đúng hạn
  provisional: boolean;
  /** Đi học offline: chỉ số tổng, không liệt kê từng buổi (trang công khai). */
  attendance: { sessions: number; present: number; onTime: number; late: number; excused: number; absent: number } | null;
};

type DetailRow = { type: string | null; due_at: string; earned: number; max: number; on_time_videos: number; provisional: number; status: string | null };

function mondayOf(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Chủ nhật
  return addDays(day, -((dow + 6) % 7));
}

const TYPE_LABEL: Record<string, string> = { NORMAL: "Bài ngày", WEEK: "Bài tuần", EXAM: "Bài thi" };

export function summarize(items: DetailRow[], todayVN: string) {
  const weeks = new Map<string, { earned: number; max: number; wmax: number; videos: number }>();
  const types = new Map<string, { earned: number; max: number }>();
  let onTime = 0, late = 0, missing = 0, videos = 0, provisional = false;
  for (const r of items) {
    const day = r.due_at.slice(0, 10);
    const wk = mondayOf(day);
    const w = weeks.get(wk) ?? { earned: 0, max: 0, wmax: 0, videos: 0 };
    w.earned += r.earned;
    w.max += r.max;
    w.wmax += r.max * weight(r.due_at, todayVN);
    w.videos += r.on_time_videos;
    weeks.set(wk, w);
    const label = TYPE_LABEL[r.type ?? ""] ?? "Bài khác";
    const t = types.get(label) ?? { earned: 0, max: 0 };
    t.earned += r.earned;
    t.max += r.max;
    types.set(label, t);
    if (r.status === "DONE") onTime++;
    else if (r.status === "OVERDUE" || r.status === "LATE") late++;
    else missing++;
    videos += r.on_time_videos;
    if (r.provisional) provisional = true;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    weeks: [...weeks.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([from, w]) => ({
        from,
        to: addDays(from, 6),
        earned: round1(w.earned),
        max: round1(w.max),
        percent: w.max > 0 ? Math.round((100 * w.earned) / w.max) : 0,
        weightPct: w.max > 0 ? Math.round((100 * w.wmax) / w.max) : 100,
        videos: w.videos,
      })),
    byType: [...types.entries()].map(([label, t]) => ({ label, earned: round1(t.earned), max: round1(t.max) })),
    due: items.length,
    onTime,
    late,
    missing,
    videos,
    provisional,
  };
}

export async function loadLearnerDetail(db: D1Database, learnerId: number, todayVN: string): Promise<LearnerDetail | null> {
  const [rows, att] = await Promise.all([loadRows(db), loadAtt(db)]);
  const { ranked } = rank(rows, todayVN, att);
  const me = ranked.find((r) => r.learnerId === learnerId);
  if (!me) return null; // chỉ học viên thuộc 12 đội
  const team = ranked.filter((r) => r.team === me.team);
  const items = (
    await db
      .prepare(
        `SELECT a.type, sc.due_at, sc.earned, sc.max, sc.on_time_videos, sc.provisional, s.status
         FROM scores sc JOIN assignments a ON a.id = sc.assignment_id
         LEFT JOIN submissions s ON s.learner_id = sc.learner_id AND s.assignment_id = sc.assignment_id
         WHERE sc.learner_id = ? AND sc.due_at >= ?`,
      )
      .bind(learnerId, SCORING.startDate)
      .all<DetailRow>()
  ).results;
  return {
    me,
    total: ranked.length,
    teamRank: 1 + team.filter((r) => r.rank < me.rank).length,
    teamTotal: team.length,
    history: rankHistory(rows, learnerId, todayVN, 3, att),
    ...summarize(items, todayVN),
    attendance: summarizeAttendance(att.filter((a) => a.learner_id === learnerId && a.session_day <= todayVN.slice(0, 10))),
  };
}

export function summarizeAttendance(mine: AttRow[]): LearnerDetail["attendance"] {
  const counted = mine.filter((a) => sessionPoints(a.code) !== null);
  if (counted.length === 0) return null;
  const n = (...codes: string[]) => counted.filter((a) => codes.includes(a.code)).length;
  return {
    sessions: counted.length,
    present: n("OK", "M", "X", "M1", "CANH_BAO"),
    onTime: n("OK"),
    late: n("M", "M1"),
    excused: n("P"),
    absent: n("VANG"),
  };
}
