import { isLearnerTeam, teamCode, teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import { SCORING } from "../scoring/config";
import { shortVN } from "./submissions";

// Trang "Cảnh báo": các câu trả lời bị gắn cờ đối phó (chỉ BTC thấy), mới nhất trước, lọc theo đội.

type Row = {
  learner_id: number;
  full_name: string | null;
  team_name: string | null;
  assignment_id: number;
  title: string | null;
  due_at: string;
  flags_json: string;
};

export type FlagLine = { learnerId: number; name: string; team: string; assignmentId: number; title: string; due: string; reasons: string[] };

export async function loadFlags(db: D1Database, team: string): Promise<{ lines: FlagLine[]; teams: string[] }> {
  const rows = (
    await db
      .prepare(
        `SELECT sc.learner_id, l.full_name, t.name AS team_name, sc.assignment_id, a.title, sc.due_at, sc.flags_json
         FROM scores sc JOIN learners l ON l.id = sc.learner_id JOIN assignments a ON a.id = sc.assignment_id
         LEFT JOIN teams t ON t.id = l.team_id
         WHERE sc.flags_json != '[]' AND sc.due_at >= ?
         ORDER BY sc.due_at DESC LIMIT 2000`,
      )
      .bind(SCORING.startDate)
      .all<Row>()
  ).results;
  const all = rows
    .map((r) => ({
      learnerId: r.learner_id,
      name: r.full_name ?? `#${r.learner_id}`,
      team: teamCode(r.team_name),
      assignmentId: r.assignment_id,
      title: r.title ?? "",
      due: r.due_at,
      reasons: (JSON.parse(r.flags_json) as { index: number; reason: string }[]).map((f) => `Câu ${f.index + 1}: ${f.reason}`),
    }))
    .filter((l) => isLearnerTeam(l.team));
  const teams = [...new Set(all.map((l) => l.team))].sort();
  return { lines: all.filter((l) => !team || l.team === team).slice(0, 300), teams };
}

export function FlagsPage(props: { lines: FlagLine[]; teams: string[]; team: string }) {
  return (
    <Layout title="Cảnh báo">
      <h1>Cảnh báo trả lời đối phó</h1>
      <p class="muted small">
        Các câu trả lời quá ngắn, chỉ có ký hiệu, gõ đại hoặc bị AI đánh giá là đối phó. Chỉ BTC thấy trang này. Bấm vào
        một dòng để đọc bài và sửa điểm nếu cần.
      </p>
      <nav class="chips" aria-label="Lọc theo đội">
        <a class={`chip${props.team ? "" : " on"}`} href="/canh-bao">
          Tất cả
        </a>
        {props.teams.map((c) => (
          <a class={`chip${props.team === c ? " on" : ""}`} href={`/canh-bao?doi=${c}`}>
            {teamLabel(c)}
          </a>
        ))}
      </nav>
      {props.lines.length === 0 ? (
        <p class="muted">Không có cảnh báo nào.</p>
      ) : (
        <ul class="list">
          {props.lines.map((l) => (
            <li>
              <a class="row-link" href={`/bai?hv=${l.learnerId}&bt=${l.assignmentId}`}>
                <div class="row-top">
                  <strong>{l.name}</strong>
                  <span class="muted small">{teamLabel(l.team)}</span>
                </div>
                <div class="muted small">
                  {shortVN(l.due).slice(0, 5)} · {l.title}
                </div>
                <div class="small">{l.reasons.join(" · ")}</div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
