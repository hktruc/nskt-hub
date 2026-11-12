import { teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import {
  B2, DIAGRAM_CRITERION, FLAGS, FOCUS_OPTIONS, GRADING, PROGRESS, QUALITY_COLOR, QUALITY_LABEL, QUICK_COMMENTS, SPIRIT, VIDEO_CRITERIA,
  type Criterion,
} from "../grading/rubric";
import type { GradeItem, QueueLine, SheetData, WeekAssignment } from "../grading/store";
import type { User } from "../users/accounts";
import { shortVN } from "./submissions";

// Bàn chấm bài tuần: hàng chờ (ai chưa chấm, ai tốt / cần kèm) và phiếu chấm một học viên.

const STATUS: Record<QueueLine["status"], [string, string]> = {
  "chua-cham": ["Chưa chấm", "bad"],
  "dang-cham": ["Chấm dở", "warn"],
  "da-cham": ["Đã chấm", "ok"],
  "sua-sau-cham": ["Học viên sửa bài sau khi chấm", "warn"],
  "chua-nop": ["Chưa nộp", ""],
};
const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function QueuePage(props: {
  nowVN?: string;
  user: User;
  weeks: WeekAssignment[];
  week: WeekAssignment | null;
  teams: string[];
  team: string;
  filter: string;
  lines: QueueLine[];
  focus: string;
  notice?: string;
}) {
  const { week, lines } = props;
  const grader = props.user.role === "phung_su";
  const submitted = lines.filter((l) => l.status !== "chua-nop");
  const todo = submitted.filter((l) => l.status === "chua-cham" || l.status === "dang-cham" || l.status === "sua-sau-cham");
  const overdue = todo.filter((l) => l.overdue);
  const q = (k: string) => lines.filter((l) => l.quality === k).length;
  const shown = lines.filter((l) => (props.team ? l.team === props.team : true)).filter((l) => {
    switch (props.filter) {
      case "chua-cham":
        return l.status === "chua-cham" || l.status === "dang-cham" || l.status === "sua-sau-cham";
      case "can-kem":
      case "tot":
      case "kha":
        return l.quality === props.filter;
      case "chua-nop":
        return l.status === "chua-nop";
      default:
        return true;
    }
  });
  const sorted = props.filter === "diem" ? [...shown].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)) : shown;
  const link = (o: { bt?: number; doi?: string; loc?: string }) => {
    const p = new URLSearchParams();
    if (o.bt ?? week?.id) p.set("bt", String(o.bt ?? week?.id));
    if ((o.doi ?? props.team)) p.set("doi", o.doi ?? props.team);
    if ((o.loc ?? props.filter)) p.set("loc", o.loc ?? props.filter);
    return `/cham?${p}`;
  };
  return (
    <Layout title="Bàn chấm" nav={grader ? "grader" : "full"}>
      <h1>Bàn chấm bài tuần</h1>
      {props.notice ? <p class="notice">{props.notice}</p> : null}
      {grader && props.teams.length === 0 ? <p class="warn">Bạn chưa được giao đội nào. Nhờ admin giao đội.</p> : null}
      {props.weeks.length === 0 ? <p class="muted">Chưa có bài tuần nào tới hạn.</p> : null}

      <p class="chips-label">Chọn bài tuần</p>
      <nav class="chips" aria-label="Chọn bài tuần">
        {props.weeks.map((w) => (
          <a class={`chip${w.id === week?.id ? " on" : ""}`} href={link({ bt: w.id, loc: "" })}>
            {(w.title ?? "").replace(/\s*\(X10\)\s*/i, "").slice(0, 28) || `Bài ${w.id}`}
            {props.nowVN && w.due_at.slice(0, 19) > props.nowVN ? " · đang mở" : ""}
          </a>
        ))}
      </nav>
      {week ? (
        <>
          <p class="muted small">
            Hạn nộp {shortVN(week.due_at)} · cần chấm xong trong {GRADING.dueDays} ngày sau hạn nộp.
            {props.nowVN && week.due_at.slice(0, 19) > props.nowVN
              ? " Bài đang mở: ai nộp rồi là chấm được ngay; bài nộp mới được lấy về mỗi giờ."
              : ""}
          </p>
          <details class="week-setting">
            <summary>
              Năng lực trọng tâm của tuần này: <span style="color:var(--accent)">{props.focus}</span>
            </summary>
            <p class="small muted" style="margin:6px 0">
              Mỗi bài tuần rèn một năng lực chính theo giai đoạn của hành trình (kể chuyện, soạn bài, đặt câu hỏi…). Người chấm sẽ chấm tiêu chí{" "}
              <strong>B1</strong> theo đúng năng lực này. Mặc định là "Truyền cảm hứng theo chiều sâu"; khi lớp chuyển sang giai đoạn mới, coach / BTC
              chọn lại ở đây cho bài tuần tương ứng.
            </p>
            {!grader ? (
              <form method="post" action="/cham/trong-tam" class="pick-row focus-form">
                <input type="hidden" name="bt" value={String(week.id)} />
                <select name="tt" aria-label="Chọn năng lực trọng tâm">
                  {FOCUS_OPTIONS.map((f) => (
                    <option value={f} selected={f === props.focus}>
                      {f}
                    </option>
                  ))}
                </select>
                <button class="secondary">Lưu</button>
              </form>
            ) : null}
          </details>
          {!grader ? (
            <p class="small">
              <a href="/cham/nguoi-cham">→ Năng lực người chấm (ai chấm bao nhiêu, đúng hạn, dễ hay khắt khe)</a>
            </p>
          ) : null}

          <div class="tiles">
            <a class={`tile${props.filter === "chua-cham" ? " on" : ""}`} href={link({ loc: "chua-cham" })}>
              <div class="num" style={todo.length ? "color:var(--bad-fg)" : ""}>{todo.length}</div>
              <div class="lbl">Chưa chấm{overdue.length ? ` · ${overdue.length} quá hạn` : ""}</div>
            </a>
            <a class={`tile${props.filter === "" ? " on" : ""}`} href={link({ loc: "" })}>
              <div class="num">
                {submitted.length - todo.length}/{submitted.length}
              </div>
              <div class="lbl">Đã chấm / đã nộp</div>
            </a>
            <a class={`tile${props.filter === "tot" ? " on" : ""}`} href={link({ loc: "tot" })}>
              <div class="num">{q("tot")}</div>
              <div class="lbl">Tốt (≥ {GRADING.goodFrom}★)</div>
            </a>
            <a class={`tile${props.filter === "can-kem" ? " on" : ""}`} href={link({ loc: "can-kem" })}>
              <div class="num">{q("can-kem")}</div>
              <div class="lbl">Cần kèm</div>
            </a>
          </div>

          {props.teams.length > 1 ? (
            <>
            <p class="chips-label">Lọc theo đội (số đỏ = chưa chấm)</p>
            <nav class="chips" aria-label="Lọc theo đội">
              <a class={`chip${props.team ? "" : " on"}`} href={link({ doi: "" })}>
                Tất cả đội
              </a>
              {props.teams.map((t) => {
                const n = todo.filter((l) => l.team === t).length;
                return (
                  <a class={`chip${props.team === t ? " on" : ""}`} href={link({ doi: t })}>
                    {teamLabel(t)}
                    {n ? <span class="cnt">{n}</span> : null}
                  </a>
                );
              })}
            </nav>
            </>
          ) : null}
          <p class="small">
            Sắp xếp: <a href={link({ loc: "" })}>theo đội</a> · <a href={link({ loc: "diem" })}>điểm cao → thấp</a> ·{" "}
            <a href={link({ loc: "kha" })}>Khá</a> · <a href={link({ loc: "chua-nop" })}>chưa nộp</a>
          </p>

          {sorted.length === 0 ? <p class="muted">Không có ai trong mục này.</p> : null}
          <ol class="rank-list">
            {sorted.map((l) => {
              const [label, badge] = STATUS[l.status];
              const color = l.quality ? QUALITY_COLOR[l.quality] : "";
              const inner = (
                <>
                  <span class="name">{l.name}</span>
                  <span class="team">
                    {teamLabel(l.team)}
                    {l.items ? ` · ${l.items} thẻ` : ""}
                  </span>
                  <span class={`badge ${l.overdue ? "bad" : badge}`}>{l.overdue ? "Quá hạn chấm" : label}</span>
                  <span class="pct">{l.score !== null ? `${fmt(l.score)}★` : ""}</span>
                </>
              );
              return (
                <li>
                  {l.status === "chua-nop" ? (
                    <div class="rank-row q-row">{inner}</div>
                  ) : (
                    <a class={`rank-row q-row ${color}`} href={`/cham/bai?hv=${l.learnerId}&bt=${week.id}`} title={l.grader ? `Người chấm: ${l.grader}` : ""}>
                      {inner}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
          <p class="muted small">
            Màu: <span class="swatch xanh">Tốt ≥ {GRADING.goodFrom}★</span> <span class="swatch vang">Khá {GRADING.okFrom}–{GRADING.goodFrom - 0.1}★</span>{" "}
            <span class="swatch do">Cần kèm &lt; {GRADING.okFrom}★ hoặc đối phó</span>. Tiêu chí đầy đủ: mở phiếu chấm.
          </p>
        </>
      ) : null}
    </Layout>
  );
}

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

function ItemMedia(props: { it: GradeItem }) {
  const { it } = props;
  const yt = it.media === "youtube" ? youtubeId(it.url) : null;
  if (yt)
    return (
      <a class="yt" href={it.url} target="_blank" rel="noopener noreferrer">
        <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="Ảnh bìa video" loading="lazy" />
        <span class="play" aria-hidden="true" />
      </a>
    );
  if (it.media === "image")
    return (
      <a href={it.url} target="_blank" rel="noopener noreferrer" class="sd-img">
        <img src={it.url} alt="Sơ đồ học viên nộp" loading="lazy" />
        <span class="btn-media">Mở ảnh to</span>
      </a>
    );
  const label: Record<string, string> = { facebook: "Mở video Facebook", tiktok: "Mở video TikTok", "video-file": "Mở video", drive: "Mở Google Drive", file: "Mở sơ đồ (PDF / tệp)" };
  return (
    <a class={`btn-media ${it.kind === "video" ? "v" : ""}`} href={it.url} target="_blank" rel="noopener noreferrer">
      {label[it.media] ?? "Mở"}
    </a>
  );
}

function Stars(props: { name: string; c: Criterion; value?: number | null }) {
  return (
    <fieldset class="crit">
      <legend>{props.c.name}</legend>
      <div class="starset">
        {[1, 2, 3, 4, 5].map((n) => (
          <label>
            <input type="radio" name={props.name} value={String(n)} checked={props.value === n} />
            <span>{n}★</span>
          </label>
        ))}
      </div>
      <p class="anchor">
        <b>1:</b> {props.c.one} · <b>3:</b> {props.c.three} · <b>5:</b> {props.c.five}
      </p>
    </fieldset>
  );
}

function Choice(props: { name: string; legend: string; options: Record<string, string>; value?: string | null }) {
  return (
    <fieldset class="crit">
      <legend>{props.legend}</legend>
      <div class="seg">
        {Object.entries(props.options).map(([k, v]) => (
          <label>
            <input type="radio" name={props.name} value={k} checked={props.value === k} />
            <span>{v}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export type SheetDraft = Record<string, string>;

export function SheetPage(props: { user: User; s: SheetData; error?: string; draft?: SheetDraft; notice?: string; back: string }) {
  const { s } = props;
  const grader = props.user.role === "phung_su";
  const d = props.draft;
  const num = (k: string, fallback: number | null | undefined) => (d ? (d[k] ? Number(d[k]) : null) : fallback ?? null);
  const str = (k: string, fallback: string | null | undefined) => (d ? d[k] ?? null : fallback ?? null);
  const writtenAnswers = s.answers
    .map((a, i) => ({ a, i, kind: s.spec?.questions[i]?.kind }))
    .filter((x) => x.kind !== "video" && (x.a.answer ?? "").replace(/https?:\/\/\S+/g, "").trim().length > 0);
  const ideas = writtenAnswers.filter((x) => x.kind === "gop-y");
  const writing = writtenAnswers.filter((x) => x.kind !== "gop-y");
  return (
    <Layout title={`Chấm · ${s.learner.name}`} nav={grader ? "grader" : "full"}>
      <p class="small">
        <a href={props.back}>← Danh sách chấm</a>
      </p>
      <h1>{s.learner.name}</h1>
      <p class="muted small">
        {teamLabel(s.learner.team)} · {s.assignment.title} · nộp {shortVN(s.submittedAt)}
        {s.status === "OVERDUE" || s.status === "LATE" ? " (trễ)" : ""}
      </p>
      {props.notice ? <p class="notice">{props.notice}</p> : null}
      {s.review ? (
        <p class="notice small">
          Đã chấm: <strong>{fmt(s.review.score)}★</strong> · {s.review.grader_label} · {shortVN(s.review.updated_at.slice(0, 19))} (giờ máy chủ). Lưu lại sẽ
          ghi đè.
          {s.review.answers_hash && s.answersHash && s.review.answers_hash !== s.answersHash ? " Học viên đã sửa bài sau lần chấm này." : ""}
        </p>
      ) : null}
      {props.error ? <p class="warn">{props.error}</p> : null}

      <form method="post" action="/cham/luu" class="sheet-form">
        <input type="hidden" name="hv" value={String(s.learner.id)} />
        <input type="hidden" name="bt" value={String(s.assignment.id)} />

        <h2>Phần riêng ({s.items.length} thẻ)</h2>
        {s.items.length === 0 ? <p class="muted small">Bài này không có video hay sơ đồ để chấm riêng; chỉ chấm phần chung.</p> : null}
        {s.items.map((it, i) => {
          const r = s.itemReviews.get(it.key);
          return (
            <section class="card-item">
              <input type="hidden" name={`k${i}`} value={it.key} />
              <input type="hidden" name={`t${i}`} value={it.kind} />
              <div class="row-top">
                <strong>
                  Thẻ {i + 1}: {it.kind === "video" ? "Video" : "Sơ đồ"}
                </strong>
                <span class="muted small">Câu {it.qIndex + 1}</span>
              </div>
              <p class="qline small">{it.question.slice(0, 160)}</p>
              <ItemMedia it={it} />
              {(it.kind === "video" ? VIDEO_CRITERIA : [DIAGRAM_CRITERION]).map((c) => (
                <Stars name={`${c.key}_${i}`} c={c} value={num(`${c.key}_${i}`, (r as Record<string, number | null> | undefined)?.[c.key])} />
              ))}
              <Choice name={`f_${i}`} legend="Không chấm được? Đánh dấu:" options={{ "": "Chấm bình thường", ...FLAGS }} value={str(`f_${i}`, r?.flag ?? "")} />
            </section>
          );
        })}

        <h2>Phần chung cả tuần</h2>
        {writing.length ? (
          <details class="card-item" open>
            <summary>
              <strong>Phần viết của học viên ({writing.length} câu)</strong>
            </summary>
            {writing.map((x) => (
              <div class="written">
                <p class="qline small">
                  Câu {x.i + 1}: {(x.a.question ?? "").slice(0, 200)}
                </p>
                <div class="answer">{(x.a.answer ?? "").replace(/https?:\/\/\S+/g, "").trim()}</div>
              </div>
            ))}
          </details>
        ) : null}
        <section class="card-item">
          <Stars name="b1" c={{ key: "b1", name: `B1. Trọng tâm tuần: ${s.focus}`, one: "Chưa thể hiện", three: "Có thể hiện nhưng chưa rõ", five: "Thể hiện rõ, nổi bật trong cả tuần" }} value={num("b1", s.review?.b1)} />
          <Stars name="b2" c={B2} value={num("b2", s.review?.b2)} />
          <Choice name="spirit" legend="B3. Tinh thần học" options={SPIRIT} value={str("spirit", s.review?.spirit)} />
          <Choice name="progress" legend="B4. So với tuần trước" options={PROGRESS} value={str("progress", s.review?.progress)} />
          <p class="small muted">
            {s.previous
              ? `Tuần trước (${s.previous.title ?? ""}): ${fmt(s.previous.score)}★ · ${SPIRIT[s.previous.spirit ?? ""] ?? "—"} · ${PROGRESS[s.previous.progress ?? ""] ?? "—"}${s.previous.comment ? ` · "${s.previous.comment.slice(0, 160)}"` : ""}`
              : "Tuần trước chưa có bản chấm."}
          </p>
          <fieldset class="crit">
            <legend>B5. Nhận xét</legend>
            <p class="anchor">Bắt buộc khi có tiêu chí ≤ 2★ hoặc chọn "Đối phó". Viết điều cụ thể học viên cần làm.</p>
            <div class="qc">
              {QUICK_COMMENTS.map((q) => (
                <button type="button" class="qc-btn" data-q={q}>
                  + {q}
                </button>
              ))}
            </div>
            <textarea name="comment" rows={3}>
              {str("comment", s.review?.comment) ?? ""}
            </textarea>
          </fieldset>
          {s.items.length ? (
            <fieldset class="crit">
              <legend>B6. Đề cử bài mẫu (không bắt buộc)</legend>
              <select name="featured">
                <option value="">— Không đề cử —</option>
                {s.items.map((it, i) => (
                  <option value={it.key} selected={str("featured", s.review?.featured_key) === it.key}>
                    Thẻ {i + 1}: {it.kind === "video" ? "Video" : "Sơ đồ"}
                  </option>
                ))}
              </select>
            </fieldset>
          ) : null}
        </section>

        {ideas.length ? (
          <details class="card-item">
            <summary class="small">Góp ý cho BTC ({ideas.length} câu, không chấm)</summary>
            {ideas.map((x) => (
              <div class="written">
                <p class="qline small">{(x.a.question ?? "").slice(0, 160)}</p>
                <div class="answer">{x.a.answer}</div>
              </div>
            ))}
          </details>
        ) : null}

        {s.review && s.ai.length ? (
          <details class="card-item">
            <summary class="small">AI gợi ý (chỉ hiện sau khi đã chấm)</summary>
            <ul class="small">
              {s.ai.map((x) => (
                <li>
                  Câu {x.index + 1}: {x.earned}/{x.max} điểm{x.note ? ` · ${x.note}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div class="sheet-bar">
          <a class="btn secondary-btn" href={props.back}>
            Để sau
          </a>
          <button>Lưu & người tiếp theo →</button>
        </div>
      </form>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelectorAll('.qc-btn').forEach(b=>b.addEventListener('click',()=>{const t=document.querySelector('textarea[name=comment]');t.value=(t.value.trim()?t.value.trim()+'. ':'')+b.dataset.q;t.focus();}));`,
        }}
      />
    </Layout>
  );
}
