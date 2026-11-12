import { findMedia, isVideo, parseAnswers, type MediaItem } from "../domain/media";
import { teamCode, teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import type { QuestionScore, SubmissionScore } from "../scoring/rules";
import { BUCKET_LABEL, bucketOf, nowVietnam, shortVN } from "./submissions";

// Trang đọc một bài nộp: câu hỏi, câu trả lời, video/ảnh mở ngay, điểm từng câu (AI / quy tắc / sửa tay),
// cảnh báo trả lời đối phó, và ô sửa điểm cho BTC / coach.

type Row = {
  learner_id: number;
  full_name: string | null;
  team_name: string | null;
  assignment_id: number;
  title: string | null;
  type: string | null;
  due_at: string | null;
  status: string | null;
  submitted_at: string | null;
  answers_json: string | null;
  earned: number | null;
  max: number | null;
  provisional: number | null;
  flags_json: string | null;
  detail_json: string | null;
};

export type DetailData = {
  row: Row;
  bucket: keyof typeof BUCKET_LABEL;
  answers: ReturnType<typeof parseAnswers>;
  detail: QuestionScore[];
  flags: SubmissionScore["flags"];
  scored: boolean;
};

export async function loadDetail(db: D1Database, learnerId: number, assignmentId: number, now = new Date()): Promise<DetailData | null> {
  const row = await db
    .prepare(
      `SELECT s.learner_id, l.full_name, t.name AS team_name, a.id AS assignment_id, a.title, a.type, a.due_at,
              s.status, s.submitted_at, s.answers_json, sc.earned, sc.max, sc.provisional, sc.flags_json, sc.detail_json
       FROM submissions s JOIN learners l ON l.id = s.learner_id JOIN assignments a ON a.id = s.assignment_id
       LEFT JOIN teams t ON t.id = l.team_id
       LEFT JOIN scores sc ON sc.learner_id = s.learner_id AND sc.assignment_id = s.assignment_id
       WHERE s.learner_id = ? AND s.assignment_id = ?`,
    )
    .bind(learnerId, assignmentId)
    .first<Row>();
  if (!row) return null;
  return {
    row,
    bucket: bucketOf(row.status, row.due_at, nowVietnam(now)),
    answers: parseAnswers(row.answers_json),
    detail: row.detail_json ? (JSON.parse(row.detail_json) as QuestionScore[]) : [],
    flags: row.flags_json ? (JSON.parse(row.flags_json) as SubmissionScore["flags"]) : [],
    scored: row.detail_json !== null,
  };
}

const SOURCE_LABEL: Record<QuestionScore["source"], string> = {
  "quy-tac": "Tự động",
  ai: "AI chấm",
  tam: "Tạm (chờ AI)",
  "sua-tay": "Sửa tay",
};
const KIND_LABEL: Record<QuestionScore["kind"], string> = {
  "bat-buoc": "Câu bắt buộc",
  "khuyen-khich": "Câu khuyến khích",
  video: "Câu video",
  "gop-y": "Góp ý BTC",
};

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/\/(shorts|embed|live|video)\/([\w-]{6,})/);
    return m ? m[2]! : null;
  } catch {
    return null;
  }
}

const KIND_BUTTON: Record<string, string> = {
  youtube: "Mở YouTube",
  facebook: "Mở Facebook",
  tiktok: "Mở TikTok",
  "video-file": "Mở video",
  drive: "Mở Google Drive",
  file: "Mở tệp",
  link: "Mở link",
};

function MediaBlock(props: { items: MediaItem[] }) {
  if (props.items.length === 0) return null;
  const images = props.items.filter((m) => m.kind === "image");
  const others = props.items.filter((m) => m.kind !== "image");
  return (
    <div class="media">
      {others.map((m) => {
        const yt = m.kind === "youtube" ? youtubeId(m.url) : null;
        return yt ? (
          <a class="yt" href={m.url} target="_blank" rel="noopener noreferrer">
            <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="Ảnh bìa video YouTube" loading="lazy" />
            <span class="play" aria-hidden="true" />
          </a>
        ) : (
          <a class={`btn-media ${isVideo(m.kind) ? "v" : ""}`} href={m.url} target="_blank" rel="noopener noreferrer">
            {KIND_BUTTON[m.kind] ?? "Mở"}
          </a>
        );
      })}
      {images.length ? (
        <div class="thumbs">
          {images.map((m) => (
            <a href={m.url} target="_blank" rel="noopener noreferrer">
              <img src={m.url} alt="Ảnh học viên nộp" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
}

export function SubmissionDetailPage(props: { data: DetailData; notice?: string }) {
  const { row, answers, detail, flags } = props.data;
  const team = teamCode(row.team_name);
  const flagOf = new Map(flags.map((f) => [f.index, f.reason]));
  const back = `/nop-bai?bt=${row.assignment_id}${team ? `&doi=${team}` : ""}`;
  return (
    <Layout title={row.full_name ?? "Bài nộp"}>
      <p class="small">
        <a href={back}>← Danh sách nộp bài</a>
      </p>
      <h1>{row.full_name}</h1>
      <p class="muted small">
        {teamLabel(team)} · {row.title} · hạn {shortVN(row.due_at)}
        {row.submitted_at ? ` · nộp ${shortVN(row.submitted_at)}` : ""}
      </p>
      {props.notice ? <p class="notice toast" role="status">✓ {props.notice}</p> : null}

      <div class="tiles">
        <div class="tile">
          <div class="num">{BUCKET_LABEL[props.data.bucket]}</div>
          <div class="lbl">Tình trạng</div>
        </div>
        <div class="tile">
          <div class="num">
            {props.data.scored ? `${fmt(row.earned ?? 0)}/${fmt(row.max ?? 0)}` : "—"}
          </div>
          <div class="lbl">{props.data.scored ? (row.provisional ? "Điểm (có câu chờ AI)" : "Điểm") : "Chưa tính điểm"}</div>
        </div>
      </div>
      {flags.length ? <p class="warn">Có {flags.length} câu bị gắn cảnh báo trả lời đối phó (xem bên dưới).</p> : null}

      {answers.length === 0 ? (
        <p class="muted">Học viên chưa nộp bài này.</p>
      ) : (
        <ol class="qa">
          {answers.map((a, i) => {
            const d = detail.find((x) => x.index === i);
            return (
              <li class={flagOf.has(i) ? "flagged" : ""}>
                <details class="q">
                  <summary>
                    <span class="muted small">{d ? KIND_LABEL[d.kind] : `Câu ${i + 1}`}</span>
                    <span class="qtext">{(a.question ?? "").slice(0, 140)}</span>
                  </summary>
                  <p class="qfull">{a.question}</p>
                </details>
                {(() => {
                  // Link đã hiện thành nút / ảnh bên dưới, nên bỏ khỏi phần chữ cho dễ đọc.
                  const text = (a.answer ?? "").replace(/https?:\/\/\S+/g, "").replace(/[ \t]+\n/g, "\n").trim();
                  const hasMedia = findMedia(a.answer).length > 0;
                  return text ? <div class="answer">{text}</div> : hasMedia ? null : <div class="answer muted">(để trống)</div>;
                })()}
                <MediaBlock items={findMedia(a.answer)} />
                {flagOf.has(i) ? <p class="badge bad">Cảnh báo: {flagOf.get(i)}</p> : null}
                {d ? (
                  <form method="post" action="/bai/sua" class="score-row">
                    <input type="hidden" name="hv" value={String(row.learner_id)} />
                    <input type="hidden" name="bt" value={String(row.assignment_id)} />
                    <input type="hidden" name="cau" value={String(i)} />
                    <span class="pts">
                      <strong>{fmt(d.earned)}</strong>/{fmt(d.max)} điểm
                      <span class="muted small"> · {SOURCE_LABEL[d.source]}</span>
                      {d.note ? <span class="muted small"> · {d.note}</span> : null}
                    </span>
                    <span class="edit">
                      <label class="sr" for={`p${i}`}>Sửa điểm câu {i + 1}</label>
                      <input id={`p${i}`} name="diem" inputmode="decimal" placeholder="Sửa" />
                      <button>Lưu</button>
                    </span>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {detail.some((d) => d.source === "sua-tay") ? (
        <p class="muted small">Muốn bỏ điểm sửa tay của một câu: gõ chữ "bo" vào ô Sửa rồi bấm Lưu.</p>
      ) : null}
    </Layout>
  );
}
