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

export type Ranked = {
  rank: number;
  learnerId: number;
  name: string;
  team: string;
  percent: number; // 0–100, làm tròn 1 chữ số
  color: Color;
  colorLabel: string;
  onTimeVideos: number;
  avgHoursEarly: number;
};

export function weight(dueAt: string, todayVN: string, halfLifeWeeks: number = SCORING.halfLifeWeeks): number {
  const days = Math.floor((Date.parse(`${todayVN.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dueAt.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
  const weeks = Math.max(0, Math.floor(days / 7));
  return Math.pow(0.5, weeks / halfLifeWeeks);
}

export function rank(rows: ScoreRow[], todayVN: string): { ranked: Ranked[]; provisional: boolean } {
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
  const list = [...by.entries()].map(([learnerId, e]) => {
    const percent = e.den > 0 ? Math.round((1000 * e.num) / e.den) / 10 : 0;
    const color = colorOf(percent);
    return {
      rank: 0,
      learnerId,
      name: e.name,
      team: e.team,
      percent,
      color,
      colorLabel: COLOR_LABEL[color],
      onTimeVideos: e.vids,
      avgHoursEarly: e.earlyN ? Math.round((10 * e.early) / e.earlyN) / 10 : 0,
    };
  });
  const cmp = (a: Ranked, b: Ranked) =>
    b.percent - a.percent || b.onTimeVideos - a.onTimeVideos || b.avgHoursEarly - a.avgHoursEarly;
  list.sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name, "vi"));
  list.forEach((x, i) => {
    const prev = list[i - 1];
    x.rank = prev && cmp(prev, x) === 0 ? prev.rank : i + 1;
  });
  return { ranked: list, provisional };
}

export async function loadLeaderboard(db: D1Database, todayVN: string) {
  const rows = (
    await db
      .prepare(
        `SELECT sc.learner_id, l.full_name, t.name AS team_name, sc.due_at, sc.earned, sc.max,
                sc.on_time_videos, sc.hours_early, sc.provisional
         FROM scores sc JOIN learners l ON l.id = sc.learner_id LEFT JOIN teams t ON t.id = l.team_id
         WHERE sc.due_at >= ?`,
      )
      .bind(SCORING.startDate)
      .all<ScoreRow>()
  ).results;
  const updated = await db.prepare("SELECT MAX(computed_at) AS at FROM scores").first<{ at: string | null }>();
  return { ...rank(rows, todayVN), updatedAt: updated?.at ?? null };
}
