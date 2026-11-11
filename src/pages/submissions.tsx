import { mediaOfAnswers } from "../domain/media";
import { isLearnerTeam, teamCode, teamLabel } from "../domain/teams";
import type { Env } from "../env";
import { Layout } from "../layout";

// Trang "Theo dõi nộp bài": một bài tập, lọc theo đội và tình trạng.

export type Bucket = "dung-han" | "tre" | "chua-nop" | "chua-toi-han";

export const BUCKET_LABEL: Record<Bucket, string> = {
  "dung-han": "Đúng hạn",
  tre: "Nộp trễ",
  "chua-nop": "Chưa nộp",
  "chua-toi-han": "Chưa tới hạn",
};
const BUCKET_BADGE: Record<Bucket, string> = { "dung-han": "ok", tre: "warn", "chua-nop": "bad", "chua-toi-han": "" };

/** dh3g ghi giờ Việt Nam không kèm múi giờ; so sánh trực tiếp chuỗi với giờ VN hiện tại. */
export function bucketOf(status: string | null, dueAt: string | null, nowVN: string): Bucket {
  if (status === "DONE") return "dung-han";
  if (status === "OVERDUE" || status === "LATE") return "tre";
  if (dueAt && dueAt.slice(0, 19) > nowVN) return "chua-toi-han";
  return "chua-nop";
}

export function nowVietnam(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 19);
}

/** "2026-11-07T22:41:05.123" → "07/11 22:41" */
export function shortVN(s: string | null): string {
  if (!s || s.length < 16) return "";
  return `${s.slice(8, 10)}/${s.slice(5, 7)} ${s.slice(11, 16)}`;
}

type AssignmentRow = { id: number; title: string | null; type: string | null; due_at: string | null };
type Row = {
  learner_id: number;
  full_name: string | null;
  team_name: string | null;
  status: string | null;
  submitted_at: string | null;
  answers_json: string | null;
};

export type LearnerLine = {
  id: number;
  name: string;
  team: string;
  bucket: Bucket;
  submittedAt: string;
  videos: number;
  images: number;
  files: number;
};

export type TeamLine = { team: string; total: number; submitted: number; late: number; videos: number; images: number };

export type BoardData = {
  assignments: AssignmentRow[];
  assignment: AssignmentRow | null;
  team: string; // "" = tất cả đội học viên
  bucket: Bucket | "";
  teams: string[];
  totals: Record<Bucket, number> & { videos: number; images: number; files: number; learners: number };
  byTeam: TeamLine[];
  lines: LearnerLine[];
};

const TYPE_VI: Record<string, string> = { NORMAL: "Bài ngày", WEEK: "Bài tuần", EXAM: "Bài thi" };

export async function loadBoard(env: Env, q: { bt?: string; doi?: string; tt?: string }, now = new Date()): Promise<BoardData> {
  const nowVN = nowVietnam(now);
  const assignments = (
    await env.DB.prepare("SELECT id, title, type, due_at FROM assignments ORDER BY due_at DESC, id DESC").all<AssignmentRow>()
  ).results;

  const wanted = Number(q.bt);
  const assignment =
    assignments.find((a) => a.id === wanted) ??
    assignments.find((a) => (a.due_at ?? "") <= nowVN) ??
    assignments[0] ??
    null;

  const empty: BoardData["totals"] = {
    "dung-han": 0, tre: 0, "chua-nop": 0, "chua-toi-han": 0, videos: 0, images: 0, files: 0, learners: 0,
  };
  if (!assignment) {
    return { assignments, assignment, team: "", bucket: "", teams: [], totals: empty, byTeam: [], lines: [] };
  }

  const rows = (
    await env.DB.prepare(
      `SELECT s.learner_id, l.full_name, t.name AS team_name, s.status, s.submitted_at, s.answers_json
       FROM submissions s JOIN learners l ON l.id = s.learner_id LEFT JOIN teams t ON t.id = l.team_id
       WHERE s.assignment_id = ?`,
    )
      .bind(assignment.id)
      .all<Row>()
  ).results;

  const all: LearnerLine[] = rows
    .map((r) => {
      const m = mediaOfAnswers(r.answers_json);
      return {
        id: r.learner_id,
        name: r.full_name ?? `#${r.learner_id}`,
        team: teamCode(r.team_name),
        bucket: bucketOf(r.status, assignment.due_at, nowVN),
        submittedAt: shortVN(r.submitted_at),
        videos: m.videos,
        images: m.images,
        files: m.files,
      };
    })
    .filter((l) => isLearnerTeam(l.team));

  const teams = [...new Set(all.map((l) => l.team))].sort();
  const team = teams.includes(q.doi ?? "") ? (q.doi as string) : "";
  const bucket = (Object.keys(BUCKET_LABEL) as Bucket[]).includes(q.tt as Bucket) ? (q.tt as Bucket) : "";

  const inTeam = all.filter((l) => !team || l.team === team);
  const totals = { ...empty, learners: inTeam.length };
  for (const l of inTeam) {
    totals[l.bucket]++;
    totals.videos += l.videos;
    totals.images += l.images;
    totals.files += l.files;
  }

  const byTeam: TeamLine[] = teams.map((code) => {
    const ls = all.filter((l) => l.team === code);
    return {
      team: code,
      total: ls.length,
      submitted: ls.filter((l) => l.bucket === "dung-han" || l.bucket === "tre").length,
      late: ls.filter((l) => l.bucket === "tre").length,
      videos: ls.reduce((s, l) => s + l.videos, 0),
      images: ls.reduce((s, l) => s + l.images, 0),
    };
  });

  const order: Record<Bucket, number> = { "chua-nop": 0, tre: 1, "chua-toi-han": 2, "dung-han": 3 };
  const lines = inTeam
    .filter((l) => !bucket || l.bucket === bucket)
    .sort((a, b) => a.team.localeCompare(b.team) || order[a.bucket] - order[b.bucket] || a.name.localeCompare(b.name, "vi"));

  return { assignments, assignment, team, bucket, teams, totals, byTeam, lines };
}

function href(d: BoardData, over: { doi?: string; tt?: string }): string {
  const p = new URLSearchParams();
  if (d.assignment) p.set("bt", String(d.assignment.id));
  const doi = over.doi ?? d.team;
  const tt = over.tt ?? d.bucket;
  if (doi) p.set("doi", doi);
  if (tt) p.set("tt", tt);
  return `/nop-bai?${p}`;
}

function assignmentLabel(a: AssignmentRow): string {
  return `${shortVN(a.due_at).slice(0, 5)} · ${TYPE_VI[a.type ?? ""] ?? a.type ?? ""} · ${a.title ?? ""}`;
}

const Icon = {
  video: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  file: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  ),
};

function MediaChips(props: { videos: number; images: number; files: number }) {
  if (!props.videos && !props.images && !props.files) return <span class="muted">Không có video/ảnh</span>;
  return (
    <span class="media-chips">
      {props.videos ? <span class="mc v">{Icon.video}{props.videos} video</span> : null}
      {props.images ? <span class="mc i">{Icon.image}{props.images} ảnh</span> : null}
      {props.files ? <span class="mc f">{Icon.file}{props.files} tệp</span> : null}
    </span>
  );
}

export function SubmissionsPage(props: { data: BoardData }) {
  const d = props.data;
  const t = d.totals;
  if (!d.assignment) {
    return (
      <Layout title="Theo dõi nộp bài">
        <h1>Theo dõi nộp bài</h1>
        <p class="muted">Chưa có bài tập nào. Xem <a href="/du-lieu">Tình trạng dữ liệu</a>.</p>
      </Layout>
    );
  }
  const a = d.assignment;
  return (
    <Layout title="Theo dõi nộp bài">
      <h1>Theo dõi nộp bài</h1>
      <form method="get" action="/nop-bai" class="pick">
        <label for="bt">Bài tập</label>
        <div class="pick-row">
          <select id="bt" name="bt">
            {d.assignments.map((x) => (
              <option value={String(x.id)} selected={x.id === a.id}>
                {assignmentLabel(x)}
              </option>
            ))}
          </select>
          {d.team ? <input type="hidden" name="doi" value={d.team} /> : null}
          <button>Xem</button>
        </div>
        <p class="muted small">Hạn nộp: {shortVN(a.due_at)}</p>
      </form>

      <nav class="chips" aria-label="Lọc theo đội">
        <a class={`chip${d.team ? "" : " on"}`} href={href(d, { doi: "" })}>
          Tất cả
        </a>
        {d.teams.map((code) => (
          <a class={`chip${d.team === code ? " on" : ""}`} href={href(d, { doi: code })}>
            {teamLabel(code)}
          </a>
        ))}
      </nav>

      <div class="tiles">
        {(["dung-han", "tre", "chua-nop", "chua-toi-han"] as Bucket[])
          .filter((b) => b !== "chua-toi-han" || t[b] > 0)
          .map((b) => (
            <a class={`tile link${d.bucket === b ? " on" : ""}`} href={href(d, { tt: d.bucket === b ? "" : b })}>
              <div class="num">{t[b]}</div>
              <div class="lbl">{BUCKET_LABEL[b]}</div>
            </a>
          ))}
        <div class="tile">
          <div class="num">{t.videos}</div>
          <div class="lbl">Video</div>
        </div>
        <div class="tile">
          <div class="num">{t.images}</div>
          <div class="lbl">Ảnh</div>
        </div>
      </div>

      {!d.team ? (
        <>
          <h2>Theo đội</h2>
          <ul class="list">
            {d.byTeam.map((x) => (
              <li>
                <a href={href(d, { doi: x.team })} class="row-link">
                  <div class="row-top">
                    <strong>{teamLabel(x.team)}</strong>
                    <span>
                      {x.submitted}/{x.total} đã nộp{x.late ? ` · ${x.late} trễ` : ""}
                    </span>
                  </div>
                  <div class="bar" aria-hidden="true">
                    <span style={`width:${x.total ? Math.round((100 * x.submitted) / x.total) : 0}%`} />
                  </div>
                  <MediaChips videos={x.videos} images={x.images} files={0} />
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {!d.team && !d.bucket ? (
        <p class="muted">Chọn một đội, hoặc bấm một ô tình trạng ở trên, để xem danh sách học viên.</p>
      ) : (
        <>
          <h2>
            Học viên{d.team ? ` ${teamLabel(d.team)}` : ""}
            {d.bucket ? ` · ${BUCKET_LABEL[d.bucket]}` : ""} ({d.lines.length})
          </h2>
          {d.lines.length === 0 ? (
            <p class="muted">Không có học viên nào.</p>
          ) : (
            <ul class="list">
              {d.lines.map((l) => (
                <li>
                  <div class="row-top">
                    <a href={`/bai?hv=${l.id}&bt=${d.assignment?.id}`}>
                      <strong>{l.name}</strong>
                    </a>
                    <span class={`badge ${BUCKET_BADGE[l.bucket]}`}>{BUCKET_LABEL[l.bucket]}</span>
                  </div>
                  <div class="muted small">
                    {teamLabel(l.team)}
                    {l.submittedAt ? ` · nộp ${l.submittedAt}` : ""}
                  </div>
                  {l.bucket === "dung-han" || l.bucket === "tre" ? (
                    <MediaChips videos={l.videos} images={l.images} files={l.files} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Layout>
  );
}
