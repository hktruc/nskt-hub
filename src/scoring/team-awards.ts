// Danh hiệu tuần cho bảng đồng đội (chủ dự án duyệt 13/11/2026, theo tinh thần "cả đội cùng tiến"):
// Dẫn đầu · Tiến bộ nhất · Đồng đều nhất · Chuyên cần · Tương trợ. Không gộp vào điểm đội.

import { addDays } from "../dates";
import { isLearnerTeam, teamCode } from "../domain/teams";
import { SCORING } from "./config";
import { rank, type AttRow, type Ranked, type ScoreRow } from "./leaderboard";

export type AwardKey = "dan-dau" | "tien-bo" | "dong-deu" | "chuyen-can" | "tuong-tro";
export type Award = { key: AwardKey; icon: string; title: string; teams: string[]; metric: string; hint: string };

export const AWARD_INFO: Record<AwardKey, { icon: string; title: string; hint: string }> = {
  "dan-dau": { icon: "🏆", title: "Đội dẫn đầu", hint: "Điểm trung bình thành viên cao nhất" },
  "tien-bo": { icon: "📈", title: "Đội tiến bộ nhất", hint: "Điểm trung bình tăng nhiều nhất so với 7 ngày trước" },
  "dong-deu": { icon: "🤝", title: "Đội đồng đều nhất", hint: "Tỷ lệ thành viên đạt Vàng trở lên cao nhất (không bỏ ai lại phía sau)" },
  "chuyen-can": { icon: "✅", title: "Đội chuyên cần", hint: "Tỷ lệ có mặt buổi học offline gần nhất cao nhất" },
  "tuong-tro": { icon: "💬", title: "Đội tương trợ", hint: "Chấm chéo cho bạn nhiều nhất (trung bình mỗi thành viên, 7 ngày qua)" },
};

const avgBy = (ranked: Ranked[]) => {
  const m = new Map<string, number[]>();
  for (const r of ranked) m.set(r.team, [...(m.get(r.team) ?? []), r.percent]);
  return new Map([...m.entries()].map(([t, xs]) => [t, xs.reduce((a, b) => a + b, 0) / xs.length]));
};
const r1 = (x: number) => Math.round(x * 10) / 10;
const PRESENT = new Set(["OK", "M", "X", "M1", "CANH_BAO"]);

/** Chọn đội có giá trị cao nhất (cùng cao nhất thì cùng nhận). `min` = giá trị tối thiểu để được trao. */
function best(values: Map<string, number>, min = -Infinity): string[] {
  const top = Math.max(...values.values());
  if (!Number.isFinite(top) || top <= min) return [];
  return [...values.entries()].filter(([, v]) => Math.abs(v - top) < 1e-9).map(([t]) => t).sort();
}

export async function teamAwards(db: D1Database, todayVN: string, ranked: Ranked[]): Promise<Award[]> {
  const today = todayVN.slice(0, 10);
  const weekAgo = addDays(today, -7);
  const [rowsR, attR, peerR, rosterR] = await db.batch([
    db
      .prepare(
        `SELECT sc.learner_id, l.full_name, t.name AS team_name, sc.due_at, sc.earned, sc.max, sc.on_time_videos, sc.hours_early, sc.provisional
         FROM scores sc JOIN learners l ON l.id = sc.learner_id LEFT JOIN teams t ON t.id = l.team_id WHERE sc.due_at >= ?`,
      )
      .bind(SCORING.startDate),
    db.prepare("SELECT learner_id, session_day, code FROM offline_attendance"),
    db
      .prepare(
        `SELECT json_extract(value,'$.reviewerId') AS reviewer FROM submissions s, json_each(s.feedbacks_json)
         WHERE s.feedback_count > 0 AND substr(json_extract(value,'$.createdAt'),1,10) > ?`,
      )
      .bind(weekAgo),
    db.prepare("SELECT l.id, t.name AS team_name FROM learners l LEFT JOIN teams t ON t.id = l.team_id"),
  ]);
  const rows = (rowsR?.results ?? []) as ScoreRow[];
  const att = (attR?.results ?? []) as AttRow[];
  const teamOf = new Map(((rosterR?.results ?? []) as { id: number; team_name: string | null }[]).map((r) => [r.id, teamCode(r.team_name)]));
  const members = new Map<string, number>();
  for (const r of ranked) members.set(r.team, (members.get(r.team) ?? 0) + 1);

  const now = avgBy(ranked);
  const awards: Award[] = [];
  const push = (key: AwardKey, teams: string[], metric: (t: string) => string) => {
    if (teams.length) awards.push({ key, ...AWARD_INFO[key], teams, metric: metric(teams[0]!) });
  };

  push("dan-dau", best(now), (t) => `${r1(now.get(t)!).toLocaleString("vi-VN")}%`);

  // Tiến bộ: so với bảng xếp hạng tính tại 7 ngày trước.
  const before = avgBy(rank(rows.filter((r) => r.due_at.slice(0, 10) <= weekAgo), weekAgo, att.filter((a) => a.session_day <= weekAgo)).ranked);
  const gain = new Map([...now.entries()].filter(([t]) => before.has(t)).map(([t, v]) => [t, r1(v - before.get(t)!)]));
  push("tien-bo", best(gain, 0), (t) => `+${gain.get(t)!.toLocaleString("vi-VN")}%`);

  const even = new Map([...members.keys()].map((t) => [t, ranked.filter((r) => r.team === t && r.color !== "do").length / members.get(t)!]));
  push("dong-deu", best(even, 0), (t) => `${Math.round(100 * even.get(t)!)}% thành viên Vàng trở lên`);

  const lastDay = att.filter((a) => a.session_day <= today).map((a) => a.session_day).sort().pop();
  if (lastDay) {
    const c = new Map<string, [number, number]>();
    for (const a of att.filter((x) => x.session_day === lastDay && x.code !== "PD" && x.code !== "KHAC")) {
      const t = teamOf.get(a.learner_id);
      if (!t || !isLearnerTeam(t)) continue;
      const e = c.get(t) ?? [0, 0];
      e[1]++;
      if (PRESENT.has(a.code)) e[0]++;
      c.set(t, e);
    }
    const rate = new Map([...c.entries()].map(([t, [p, n]]) => [t, n ? p / n : 0]));
    push("chuyen-can", best(rate, 0), (t) => `${Math.round(100 * rate.get(t)!)}% có mặt buổi ${lastDay.slice(8, 10)}/${lastDay.slice(5, 7)}`);
  }

  const given = new Map<string, number>();
  for (const r of (peerR?.results ?? []) as { reviewer: number | null }[]) {
    const t = r.reviewer === null ? undefined : teamOf.get(r.reviewer);
    if (t && members.has(t)) given.set(t, (given.get(t) ?? 0) + 1);
  }
  const perMember = new Map([...given.entries()].map(([t, n]) => [t, r1(n / members.get(t)!)]));
  if (perMember.size) push("tuong-tro", best(perMember, 0), (t) => `${perMember.get(t)!.toLocaleString("vi-VN")} lượt chấm chéo / người`);

  return awards;
}
