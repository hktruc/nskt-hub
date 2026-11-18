// Câu hỏi học viên gửi BTC (chỉ BTC / coach / admin): AI gộp thành FAQ, xem từ đầu khóa hoặc theo tuần,
// bấm vào câu hỏi để xem câu gốc. Trang đăng câu trả lời công khai (hiện cuối bảng xếp hạng).

import { formatVN } from "../dates";
import { teamLabel } from "../domain/teams";
import type { FaqItem } from "../faq/collect";
import { sourceLabel, type FaqPost, type FaqView } from "../faq/store";
import { Layout } from "../layout";

const URGENCY: Record<string, [string, string]> = {
  "cap-bach": ["Cấp bách", "bad"],
  "quan-trong": ["Quan trọng", "warn"],
  thuong: ["Thường", ""],
  "chua-xep": ["Chưa xếp nhóm", ""],
};
const weekOf = (title: string) => title.match(/tuần\s*(\d+)/i)?.[1]?.padStart(2, "0") ?? title;

export type WeekOption = { id: number; title: string; dueAt: string; count: number };

function FaqShell(props: { tab: "tong-hop" | "dang"; children?: unknown; notice?: string; postCount: number }) {
  return (
    <Layout title="Câu hỏi học viên">
      <h1>Câu hỏi học viên gửi BTC</h1>
      <nav class="chips" aria-label="Chọn trang">
        <a class={`chip${props.tab === "tong-hop" ? " on" : ""}`} href="/faq">
          Tổng hợp câu hỏi
        </a>
        <a class={`chip${props.tab === "dang" ? " on" : ""}`} href="/faq/dang">
          Câu trả lời công khai ({props.postCount})
        </a>
      </nav>
      {props.notice ? (
        <p class="notice toast" role="status">
          ✓ {props.notice}
        </p>
      ) : null}
      {props.children as never}
    </Layout>
  );
}

/** Dòng chữ nhỏ: ai hỏi, đội nào, tuần nào. */
function WhoLine(props: { items: FaqItem[] }) {
  const teams = [...new Set(props.items.map((i) => i.team))].sort();
  const weeks = [...new Set(props.items.map((i) => weekOf(i.assignmentTitle)))].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
  return (
    <span class="faq-who">
      {props.items.length} lượt · {new Set(props.items.map((i) => i.learnerId)).size} học viên · {teams.map(teamLabel).join(", ")} · tuần {weeks.join(", ")}
      <br />
      {props.items.map((i) => `${i.name} (${teamLabel(i.team)}, tuần ${weekOf(i.assignmentTitle)})`).join(" · ")}
    </span>
  );
}

export function FaqPage(props: { view: FaqView; weekId: number | null; weeks: WeekOption[]; postCount: number; notice?: string; error?: string }) {
  const v = props.view;
  const byKey = new Map(v.items.map((i) => [i.key, i]));
  const count = (u: string) => v.groups.filter((g) => g.urgency === u).length;
  const scopeLabel = props.weekId ? `tuần ${weekOf(props.weeks.find((w) => w.id === props.weekId)?.title ?? "")}` : "từ đầu khóa";
  return (
    <FaqShell tab="tong-hop" notice={props.notice} postCount={props.postCount}>
      <p class="muted small">
        Lấy từ các câu không bắt buộc của bài tập tuần: {COURSE_SOURCES}. AI gộp câu trùng ý thành câu hỏi kiểu FAQ và đánh mức độ; đây là gợi ý cho BTC, học viên không thấy trang này.
      </p>

      <h2 class="chips-label">Phạm vi</h2>
      <nav class="chips" aria-label="Chọn phạm vi">
        <a class={`chip${props.weekId === null ? " on" : ""}`} href="/faq">
          Từ đầu khóa
        </a>
        {[...props.weeks].reverse().map((w) => (
          <a class={`chip${props.weekId === w.id ? " on" : ""}`} href={`/faq?tuan=${w.id}`}>
            Tuần {weekOf(w.title)} ({w.count})
          </a>
        ))}
      </nav>
      {props.error ? <p class="warn">{props.error}</p> : null}

      <div class="card-item">
        {v.busy ? (
          <p style="margin:0">
            ⏳ <b>Đang biên tập {scopeLabel}</b> (yêu cầu lúc {formatVN(v.busy.requestedAt)}). AI chạy nền, tải lại trang sau khoảng 5 phút.
          </p>
        ) : null}
        {v.run ? (
          <p class="small" style="margin:4px 0">
            AI biên tập {scopeLabel} lúc <b>{formatVN(v.run.finishedAt)}</b> từ {v.run.itemCount} câu{v.run.requestedBy ? ` · yêu cầu bởi ${v.run.requestedBy}` : ""}.
            {v.changed ? <span class="badge warn">Đã có câu mới từ lần biên tập này</span> : null}
          </p>
        ) : (
          <p class="small" style="margin:4px 0">Chưa có bản biên tập AI cho {scopeLabel}. Bên dưới là toàn bộ câu gốc ({v.items.length}).</p>
        )}
        {v.lastFailed ? <p class="warn small">Lần biên tập gần nhất lỗi: {v.lastFailed.error}</p> : null}
        {v.busy ? null : (
          <form method="post" action="/faq/bien-tap" style="margin-top:6px">
            <input type="hidden" name="tuan" value={props.weekId ? String(props.weekId) : ""} />
            <button class="secondary">✨ Biên tập lại bằng AI ({scopeLabel})</button>
          </form>
        )}
      </div>

      {v.run ? (
        <>
          <div class="tiles">
            {(["cap-bach", "quan-trong", "thuong"] as const).map((u) => (
              <div class="tile">
                <div class="lbl">{URGENCY[u]![0]}</div>
                <div class="num" style={u === "cap-bach" && count(u) ? "color:var(--bad-fg)" : ""}>
                  {count(u)}
                </div>
              </div>
            ))}
          </div>
          {v.groups.map((g) => {
            const items = g.keys.map((k) => byKey.get(k)).filter((i): i is FaqItem => !!i);
            const gone = g.keys.length - items.length;
            const [ulabel, ucls] = URGENCY[g.urgency] ?? URGENCY.thuong!;
            return (
              <details class={`card-item faq-g u-${g.urgency}`}>
                <summary>
                  <span class={`badge ${ucls}`}>{ulabel}</span>
                  {g.topic ? <span class="badge">{g.topic}</span> : null} <b class="faq-q">{g.question}</b>
                  <WhoLine items={items} />
                </summary>
                {g.summary ? <p class="small">{g.summary}</p> : null}
                <ol class="faq-src">
                  {items.map((i) => (
                    <li>
                      <div class="faq-who">
                        {i.name} · {teamLabel(i.team)} · <a href={`/bai?hv=${i.learnerId}&bt=${i.assignmentId}`}>{i.assignmentTitle} →</a> · {sourceLabel(i.source)}
                      </div>
                      <div class="faq-text">{i.text}</div>
                    </li>
                  ))}
                </ol>
                {gone ? <p class="muted small">{gone} câu gốc đã bị học viên sửa hoặc xóa sau lần biên tập.</p> : null}
                {g.urgency === "chua-xep" ? null : (
                  <p>
                    <a class="btn secondary" href={`/faq/dang?cauhoi=${encodeURIComponent(g.question)}#soan`}>
                      ✍️ Soạn câu trả lời công khai
                    </a>
                  </p>
                )}
              </details>
            );
          })}
        </>
      ) : (
        <RawList items={v.items} />
      )}
    </FaqShell>
  );
}

const COURSE_SOURCES = "“Khó khăn & câu hỏi gửi BTC/Thầy” và “Điểm cần cải thiện”";

function RawList(props: { items: FaqItem[] }) {
  if (!props.items.length) return <p class="muted">Chưa có câu nào.</p>;
  return (
    <ol class="faq-src">
      {[...props.items].reverse().map((i) => (
        <li>
          <div class="faq-who">
            {i.name} · {teamLabel(i.team)} · <a href={`/bai?hv=${i.learnerId}&bt=${i.assignmentId}`}>{i.assignmentTitle} →</a> · {sourceLabel(i.source)}
          </div>
          <div class="faq-text">{i.text}</div>
        </li>
      ))}
    </ol>
  );
}

function PostForm(props: { post?: FaqPost; question?: string }) {
  const p = props.post;
  return (
    <form method="post" action="/faq/dang" class="auth-form faq-form">
      {p ? <input type="hidden" name="id" value={String(p.id)} /> : null}
      <label>Câu hỏi (học viên sẽ thấy)</label>
      <input name="cauhoi" required maxlength={500} value={p?.question ?? props.question ?? ""} />
      <label>Câu trả lời của BTC</label>
      <textarea name="traloi" required rows={6} maxlength={8000}>
        {p?.answer ?? ""}
      </textarea>
      <label>Thứ tự hiển thị (số nhỏ đứng trước)</label>
      <input name="thutu" type="number" value={String(p?.sortOrder ?? 0)} />
      <label class="tchk">
        <input type="checkbox" name="cong_khai" value="1" checked={p ? p.published : true} /> Đăng công khai (hiện cuối bảng xếp hạng)
      </label>
      <button>{p ? "Lưu thay đổi" : "Đăng câu trả lời"}</button>
    </form>
  );
}

export function FaqPostsPage(props: { posts: FaqPost[]; question?: string; notice?: string; error?: string }) {
  return (
    <FaqShell tab="dang" notice={props.notice} postCount={props.posts.length}>
      <p class="muted small">
        Câu trả lời BTC tự soạn (thường là những câu đã trả lời trên lớp). Câu được đánh dấu "đăng công khai" hiện ở mục <b>Câu hỏi thường gặp</b> cuối{" "}
        <a href="/bang-xep-hang#faq">bảng xếp hạng công khai</a>.
      </p>
      {props.error ? <p class="warn">{props.error}</p> : null}
      <h2 id="soan">Soạn câu trả lời mới</h2>
      <PostForm question={props.question} />
      <h2>Đã soạn ({props.posts.length})</h2>
      {props.posts.length === 0 ? <p class="muted">Chưa có câu trả lời nào.</p> : null}
      {props.posts.map((p) => (
        <details class="card-item">
          <summary>
            {p.published ? <span class="badge ok">Đang công khai</span> : <span class="badge">Nháp</span>} <b>{p.question}</b>
            <span class="faq-who">
              {p.updatedBy ?? p.createdBy} · {formatVN(p.updatedAt ?? p.createdAt)} · thứ tự {p.sortOrder}
            </span>
          </summary>
          <PostForm post={p} />
          <form method="post" action="/faq/xoa" style="margin-top:8px">
            <input type="hidden" name="id" value={String(p.id)} />
            <button class="link small">Xóa câu này</button>
          </form>
        </details>
      ))}
    </FaqShell>
  );
}

/** Mục "Câu hỏi thường gặp" cuối bảng xếp hạng công khai. */
export function FaqPublic(props: { posts: FaqPost[] }) {
  if (!props.posts.length) return null;
  return (
    <section id="faq" class="faq-public">
      <h2>Câu hỏi thường gặp</h2>
      {props.posts.map((p) => (
        <details class="card-item">
          <summary>
            <b>{p.question}</b>
          </summary>
          <div class="faq-answer">{p.answer}</div>
        </details>
      ))}
    </section>
  );
}
