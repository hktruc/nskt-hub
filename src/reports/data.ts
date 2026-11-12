// Số liệu cho các báo cáo thống kê. Chỉ học viên thuộc 12 đội.

import { addDays, vietnamDay } from "../dates";
import { isLearnerTeam, teamCode } from "../domain/teams";
import { mediaOfAnswers } from "../domain/media";
import { SCORING } from "../scoring/config";

export type Learner = { id: number; name: string; team: string };

export async function loadRoster(db: D1Database): Promise<Learner[]> {
  const rows = (
    await db.prepare("SELECT l.id, l.full_name, t.name AS team_name FROM learners l LEFT JOIN teams t ON t.id = l.team_id").all<{ id: number; full_name: string | null; team_name: string | null }>()
  ).results;
  return rows
    .map((r) => ({ id: r.id, name: r.full_name ?? `#${r.id}`, team: teamCode(r.team_name) }))
    .filter((l) => isLearnerTeam(l.team))
    .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name, "vi"));
}

const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
export const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

// ---------------- Buổi học offline ----------------

export type AttCounts = { total: number; present: number; onTime: number; late: number; wrongPlace: number; noLoc: number; excused: number; absent: number; pd: number };
const emptyAtt = (): AttCounts => ({ total: 0, present: 0, onTime: 0, late: 0, wrongPlace: 0, noLoc: 0, excused: 0, absent: 0, pd: 0 });
function addAtt(c: AttCounts, code: string) {
  c.total++;
  if (code === "PD" || code === "KHAC") {
    c.pd++;
    return;
  }
  if (["OK", "M", "X", "M1", "CANH_BAO"].includes(code)) c.present++;
  if (code === "OK") c.onTime++;
  if (code === "M" || code === "M1") c.late++;
  if (code === "X" || code === "M1") c.wrongPlace++;
  if (code === "CANH_BAO") c.noLoc++;
  if (code === "P") c.excused++;
  if (code === "VANG") c.absent++;
}

export type SessionReport = {
  sessions: string[];
  day: string | null;
  all: AttCounts;
  byRegion: { region: "HN" | "SG"; c: AttCounts }[];
  byTeam: { team: string; c: AttCounts }[];
  absent: { name: string; team: string; region: string }[];
  excused: { name: string; team: string; region: string }[];
  late: { name: string; team: string; region: string }[];
  trend: { day: string; hn: number; sg: number; all: number }[];
};

export async function sessionReport(db: D1Database, wanted?: string): Promise<SessionReport> {
  const roster = new Map((await loadRoster(db)).map((l) => [l.id, l]));
  const rows = (await db.prepare("SELECT learner_id, session_day, code, region FROM offline_attendance ORDER BY session_day").all<{ learner_id: number; session_day: string; code: string; region: string | null }>()).results.filter((r) =>
    roster.has(r.learner_id),
  );
  const sessions = [...new Set(rows.map((r) => r.session_day))].sort().reverse();
  const day = sessions.includes(wanted ?? "") ? wanted! : (sessions[0] ?? null);
  const all = emptyAtt();
  const reg = { HN: emptyAtt(), SG: emptyAtt() };
  const teams = new Map<string, AttCounts>();
  const absent: SessionReport["absent"] = [], excused: SessionReport["excused"] = [], late: SessionReport["late"] = [];
  for (const r of rows.filter((x) => x.session_day === day)) {
    const l = roster.get(r.learner_id)!;
    addAtt(all, r.code);
    if (r.region === "HN" || r.region === "SG") addAtt(reg[r.region], r.code);
    const t = teams.get(l.team) ?? emptyAtt();
    addAtt(t, r.code);
    teams.set(l.team, t);
    const who = { name: l.name, team: l.team, region: r.region === "SG" ? "SG" : r.region === "HN" ? "HN" : "—" };
    if (r.code === "VANG") absent.push(who);
    if (r.code === "P") excused.push(who);
    if (r.code === "M" || r.code === "M1") late.push(who);
  }
  const trend = sessions
    .slice()
    .reverse()
    .map((d) => {
      const c = { all: emptyAtt(), HN: emptyAtt(), SG: emptyAtt() };
      for (const r of rows.filter((x) => x.session_day === d)) {
        addAtt(c.all, r.code);
        if (r.region === "HN" || r.region === "SG") addAtt(c[r.region], r.code);
      }
      const rate = (x: AttCounts) => pct(x.present, x.total - x.pd);
      return { day: d, hn: rate(c.HN), sg: rate(c.SG), all: rate(c.all) };
    });
  return {
    sessions,
    day,
    all,
    byRegion: [
      { region: "HN", c: reg.HN },
      { region: "SG", c: reg.SG },
    ],
    byTeam: [...teams.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([team, c]) => ({ team, c })),
    absent,
    excused,
    late,
    trend,
  };
}

// ---------------- Bài tập (ngày / tuần / thi) ----------------

type Sub = { learner_id: number; assignment_id: number; status: string | null; answers_json: string | null; feedback_count: number | null };
export type AssignmentLine = {
  id: number;
  title: string;
  due: string;
  open: boolean;
  onTime: number;
  late: number;
  missing: number;
  total: number;
  videos: number;
  images: number;
  feedbacks: number;
  graded?: number;
  quality?: number | null;
  byTeam: { team: string; onTime: number; late: number; missing: number; total: number }[];
};

export async function assignmentReport(db: D1Database, type: "NORMAL" | "WEEK" | "EXAM", range: { from?: string; to?: string } = {}, nowVN = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 19)) {
  const roster = new Map((await loadRoster(db)).map((l) => [l.id, l]));
  const from = range.from ?? (type === "EXAM" ? "2000-01-01" : SCORING.startDate);
  const to = range.to ?? "2999-12-31";
  const as = (
    await db
      .prepare("SELECT id, title, due_at FROM assignments WHERE type = ? AND substr(due_at,1,10) >= ? AND substr(due_at,1,10) <= ? ORDER BY due_at DESC")
      .bind(type, from, to)
      .all<{ id: number; title: string | null; due_at: string }>()
  ).results;
  if (as.length === 0) return { lines: [] as AssignmentLine[], perLearner: new Map<number, { onTime: number; late: number; missing: number }>() };
  const ids = JSON.stringify(as.map((a) => a.id));
  const [subs, reviews] = await db.batch([
    db.prepare(`SELECT learner_id, assignment_id, status, ${type === "EXAM" ? "NULL AS answers_json" : "answers_json"}, feedback_count FROM submissions WHERE assignment_id IN (SELECT value FROM json_each(?))`).bind(ids),
    db.prepare("SELECT assignment_id, score, spirit FROM week_reviews WHERE assignment_id IN (SELECT value FROM json_each(?))").bind(ids),
  ]);
  const perLearner = new Map<number, { onTime: number; late: number; missing: number }>();
  const lines: AssignmentLine[] = as.map((a) => {
    const open = a.due_at.slice(0, 19) > nowVN;
    const L: AssignmentLine = { id: a.id, title: (a.title ?? "").trim(), due: a.due_at, open, onTime: 0, late: 0, missing: 0, total: 0, videos: 0, images: 0, feedbacks: 0, byTeam: [] };
    const teams = new Map<string, { onTime: number; late: number; missing: number; total: number }>();
    for (const s of ((subs?.results ?? []) as Sub[]).filter((x) => x.assignment_id === a.id)) {
      const l = roster.get(s.learner_id);
      if (!l) continue;
      const t = teams.get(l.team) ?? { onTime: 0, late: 0, missing: 0, total: 0 };
      const p = perLearner.get(l.id) ?? { onTime: 0, late: 0, missing: 0 };
      L.total++;
      t.total++;
      if (s.status === "DONE") (L.onTime++, t.onTime++, open || p.onTime++);
      else if (s.status === "OVERDUE" || s.status === "LATE") (L.late++, t.late++, open || p.late++);
      else if (!open) (L.missing++, t.missing++, p.missing++);
      if (!open) perLearner.set(l.id, p);
      teams.set(l.team, t);
      if (s.answers_json) {
        const m = mediaOfAnswers(s.answers_json);
        L.videos += m.videos;
        L.images += m.images;
      }
      L.feedbacks += s.feedback_count ?? 0;
    }
    L.byTeam = [...teams.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([team, c]) => ({ team, ...c }));
    if (type === "WEEK") {
      const rv = ((reviews?.results ?? []) as { assignment_id: number; score: number | null; spirit: string | null }[]).filter((r) => r.assignment_id === a.id);
      L.graded = rv.length;
      const sc = rv.map((r) => r.score).filter((x): x is number => x !== null);
      L.quality = sc.length ? Math.round((10 * sc.reduce((p, q) => p + q, 0)) / sc.length) / 10 : null;
    }
    return L;
  });
  return { lines, perLearner };
}

// ---------------- Toàn khóa theo tuần ----------------

export type WeekRow = { from: string; attendance: number | null; dailyOnTime: number | null; dailyDone: number | null; weeklyDone: number | null; feedbacks: number };

export async function courseByWeek(db: D1Database, now = new Date()): Promise<WeekRow[]> {
  const today = vietnamDay(now);
  const roster = new Set((await loadRoster(db)).map((l) => l.id));
  const [att, subs, fb] = await db.batch([
    db.prepare("SELECT learner_id, session_day, code FROM offline_attendance"),
    db.prepare(
      `SELECT s.learner_id, s.status, a.type, substr(a.due_at,1,10) AS day FROM submissions s JOIN assignments a ON a.id = s.assignment_id
       WHERE a.type IN ('NORMAL','WEEK') AND substr(a.due_at,1,10) >= ? AND a.due_at <= ?`,
    ).bind(SCORING.startDate, `${today}T23:59:59`),
    db.prepare("SELECT substr(json_extract(value,'$.createdAt'),1,10) AS day FROM submissions s, json_each(s.feedbacks_json) WHERE s.feedback_count > 0"),
  ]);
  const weeks = new Map<string, { attN: number; attP: number; dN: number; dOn: number; dDone: number; wN: number; wDone: number; fb: number }>();
  const w = (day: string) => {
    const k = mondayOf(day);
    const e = weeks.get(k) ?? { attN: 0, attP: 0, dN: 0, dOn: 0, dDone: 0, wN: 0, wDone: 0, fb: 0 };
    weeks.set(k, e);
    return e;
  };
  for (const r of (att?.results ?? []) as { learner_id: number; session_day: string; code: string }[]) {
    if (!roster.has(r.learner_id) || r.code === "PD" || r.code === "KHAC") continue;
    const e = w(r.session_day);
    e.attN++;
    if (["OK", "M", "X", "M1", "CANH_BAO"].includes(r.code)) e.attP++;
  }
  for (const r of (subs?.results ?? []) as { learner_id: number; status: string | null; type: string; day: string }[]) {
    if (!roster.has(r.learner_id)) continue;
    const e = w(r.day);
    const done = r.status === "DONE" || r.status === "OVERDUE" || r.status === "LATE";
    if (r.type === "NORMAL") {
      e.dN++;
      if (r.status === "DONE") e.dOn++;
      if (done) e.dDone++;
    } else {
      e.wN++;
      if (done) e.wDone++;
    }
  }
  for (const r of (fb?.results ?? []) as { day: string | null }[]) if (r.day && r.day >= SCORING.startDate) w(r.day).fb++;
  return [...weeks.entries()]
    .filter(([k]) => k >= mondayOf(SCORING.startDate) && k <= today)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([from, e]) => ({
      from,
      attendance: e.attN ? pct(e.attP, e.attN) : null,
      dailyOnTime: e.dN ? pct(e.dOn, e.dN) : null,
      dailyDone: e.dN ? pct(e.dDone, e.dN) : null,
      weeklyDone: e.wN ? pct(e.wDone, e.wN) : null,
      feedbacks: e.fb,
    }));
}
