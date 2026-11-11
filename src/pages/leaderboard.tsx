import { formatVN } from "../dates";
import { teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import { SCORING } from "../scoring/config";
import type { LearnerDetail, Ranked } from "../scoring/leaderboard";

// Trang công khai, không cần đăng nhập. Chỉ hiện: hạng, họ tên, đội, điểm (%), màu.

export function LeaderboardPage(props: {
  ranked: Ranked[];
  team: string;
  teams: string[];
  provisional: boolean;
  updatedAt: string | null;
}) {
  const filtered = props.team ? props.ranked.filter((r) => r.team === props.team) : props.ranked;
  // Xem một đội: hạng trong đội, kèm hạng toàn khóa. Bằng điểm thì ngang hạng.
  const same = (a: Ranked, b: Ranked) => a.percent === b.percent && a.onTimeVideos === b.onTimeVideos && a.avgHoursEarly === b.avgHoursEarly;
  const list = filtered.map((r) => ({ ...r, shown: 0 }));
  list.forEach((r, i) => {
    const prev = list[i - 1];
    r.shown = props.team ? (prev && same(prev, r) ? prev.shown : i + 1) : r.rank;
  });
  const count = (c: Ranked["color"]) => list.filter((r) => r.color === c).length;
  return (
    <Layout title="Bảng xếp hạng" publicPage>
      <h1>Bảng xếp hạng NSKT2026</h1>
      <p class="muted small">Cập nhật {formatVN(props.updatedAt)} (giờ Việt Nam).</p>
      {props.provisional ? (
        <p class="notice small">Một số bài đang chờ chấm tự động, điểm có thể thay đổi nhẹ.</p>
      ) : null}

      <nav class="chips" aria-label="Lọc theo đội">
        <a class={`chip${props.team ? "" : " on"}`} href="/bang-xep-hang">
          Toàn khóa
        </a>
        {props.teams.map((code) => (
          <a class={`chip${props.team === code ? " on" : ""}`} href={`/bang-xep-hang?doi=${code}`}>
            {teamLabel(code)}
          </a>
        ))}
      </nav>

      <div class="legend" aria-label="Chú thích màu">
        <span class="swatch xanh">≥ {SCORING.greenFrom}% · {count("xanh")} người</span>
        <span class="swatch vang">
          {SCORING.yellowFrom}–{SCORING.greenFrom - 1}% · {count("vang")} người
        </span>
        <span class="swatch do">
          &lt; {SCORING.yellowFrom}% · {count("do")} người
        </span>
      </div>

      {list.length === 0 ? (
        <p class="muted">Chưa có điểm.</p>
      ) : (
        <ol class="rank-list">
          {list.map((r) => (
            <li>
              <a class={`rank-row ${r.color}`} href={`/bang-xep-hang/hv/${r.learnerId}`} data-hv="" title="Bấm để xem chi tiết">
                <span class="rank">{r.shown}</span>
                <span class="name">{r.name}</span>
                <span class="team">{props.team ? `#${r.rank} khóa` : teamLabel(r.team)}</span>
                <span class="pct">{r.percent.toLocaleString("vi-VN")}%</span>
              </a>
            </li>
          ))}
        </ol>
      )}
      <p class="muted small">Bấm vào một tên để xem điểm tích lũy và thứ hạng 3 tuần gần nhất.</p>
      <section class="rules" aria-label="Cách tính điểm">
        <h2>Cách tính điểm</h2>
        <ul>
          <li>
            Điểm = <strong>% điểm đạt được</strong> trên điểm tối đa, tính từ 30/09/2026.
          </li>
          <li>
            <strong>Bài ngày:</strong> câu bắt buộc {SCORING.daily.mandatory}đ · câu khuyến khích có video{" "}
            {SCORING.daily.encouragedVideo}đ, viết đúc kết sâu sắc {SCORING.daily.encouragedDeepText}đ.
          </li>
          <li>
            <strong>Bài tuần:</strong> mỗi video {SCORING.weekly.perVideo}đ · câu bắt buộc {SCORING.weekly.mandatory}đ · góp ý BTC{" "}
            {SCORING.weekly.idea}đ.
          </li>
          <li>
            <strong>Nộp trễ:</strong> video {SCORING.lateVideo}đ, câu viết một nửa. Trả lời cho có: 0đ.
          </li>
          <li>
            <strong>Bài cũ tính ít dần</strong> (sau {SCORING.halfLifeWeeks} tuần còn một nửa): cố gắng từ hôm nay sẽ lên nhanh.
          </li>
          <li>
            <span class="swatch xanh">Xanh</span> ≥ {SCORING.greenFrom}% · <span class="swatch vang">Vàng</span>{" "}
            {SCORING.yellowFrom}–{SCORING.greenFrom - 1}% · <span class="swatch do">Đỏ</span> &lt; {SCORING.yellowFrom}%.
            Bằng điểm: ai nộp video đúng hạn nhiều hơn, sớm hơn xếp trên.
          </li>
        </ul>
      </section>
      <dialog id="hv" class="sheet" aria-label="Chi tiết học viên">
        <div class="sheet-body" />
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: DIALOG_JS }} />
    </Layout>
  );
}

// Bấm tên → mở cửa sổ chi tiết. Không có JavaScript thì link vẫn mở trang chi tiết riêng.
const DIALOG_JS = `(() => {
  const d = document.getElementById("hv"), body = d.querySelector(".sheet-body");
  if (!d.showModal) return;
  document.addEventListener("click", async (e) => {
    const a = e.target.closest("a[data-hv]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    body.innerHTML = '<p class="muted">Đang tải…</p>';
    d.showModal();
    try {
      const r = await fetch(a.href + "?p=1");
      body.innerHTML = r.ok ? await r.text() : '<p class="muted">Không tải được, thử lại sau.</p>';
    } catch { body.innerHTML = '<p class="muted">Không tải được, thử lại sau.</p>'; }
  });
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-close]")) d.close();
  });
})();`;

const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const num = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });

function Move(props: { from: number | null; to: number | null }) {
  if (props.from === null || props.to === null) return null;
  const d = props.from - props.to; // hạng nhỏ hơn = tốt hơn
  if (d > 0) return <span class="mv up">▲ {d}</span>;
  if (d < 0) return <span class="mv down">▼ {-d}</span>;
  return <span class="mv same">=</span>;
}

/** Nội dung chi tiết: dùng cho cả cửa sổ bật lên lẫn trang riêng. */
export function LearnerDetailView(props: { d: LearnerDetail; inDialog?: boolean }) {
  const { d } = props;
  const first = d.history[0];
  const now = d.history[d.history.length - 1];
  return (
    <div class="hv-detail">
      <div class={`hv-head ${d.me.color}`}>
        <div>
          <div class="hv-name">{d.me.name}</div>
          <div class="small">
            {teamLabel(d.me.team)} · hạng {d.me.rank}/{d.total} khóa · {d.teamRank}/{d.teamTotal} trong đội
          </div>
        </div>
        <div class="hv-pct">{d.me.percent.toLocaleString("vi-VN")}%</div>
        {props.inDialog ? (
          <button type="button" class="close" data-close="" aria-label="Đóng">
            ✕
          </button>
        ) : null}
      </div>
      {d.provisional ? <p class="muted small">Có bài đang chờ chấm tự động, điểm có thể thay đổi nhẹ.</p> : null}

      <h2>Thứ hạng 3 tuần gần nhất</h2>
      <ol class="hist">
        {d.history.map((h, i) => (
          <li class={h.weeksAgo === 0 ? "now" : ""}>
            <span class="small muted">{h.weeksAgo === 0 ? "Hôm nay" : `${h.weeksAgo} tuần trước`}</span>
            <span class="small muted">{ddmm(h.day)}</span>
            <strong>{h.rank === null ? "—" : `#${h.rank}`}</strong>
            <span class="small">{h.percent === null ? "chưa có điểm" : `${h.percent.toLocaleString("vi-VN")}%`}</span>
            {i > 0 ? <Move from={d.history[i - 1]!.rank} to={h.rank} /> : null}
          </li>
        ))}
      </ol>
      {first && now && first.rank !== null && now.rank !== null ? (
        <p class="small">
          {first.rank > now.rank
            ? `Tăng ${first.rank - now.rank} bậc so với 3 tuần trước.`
            : first.rank < now.rank
              ? `Giảm ${now.rank - first.rank} bậc so với 3 tuần trước.`
              : "Giữ nguyên thứ hạng so với 3 tuần trước."}
        </p>
      ) : null}

      <h2>Điểm tích lũy</h2>
      <div class="hv-stats">
        <div>
          <strong>{d.onTime}</strong>
          <span class="small muted">đúng hạn</span>
        </div>
        <div>
          <strong>{d.late}</strong>
          <span class="small muted">nộp trễ</span>
        </div>
        <div>
          <strong>{d.missing}</strong>
          <span class="small muted">chưa nộp</span>
        </div>
        <div>
          <strong>{d.videos}</strong>
          <span class="small muted">video đúng hạn</span>
        </div>
      </div>
      <p class="small">
        {d.byType.map((t, i) => (
          <>
            {i ? " · " : ""}
            {t.label}: <strong>{num(t.earned)}</strong>/{num(t.max)}đ
          </>
        ))}
      </p>

      <table class="weeks">
        <thead>
          <tr>
            <th>Tuần</th>
            <th class="r">Điểm</th>
            <th class="r">%</th>
            <th class="r">Đang tính</th>
          </tr>
        </thead>
        <tbody>
          {d.weeks.map((w) => (
            <tr>
              <td>
                {ddmm(w.from)}–{ddmm(w.to)}
              </td>
              <td class="r">
                {num(w.earned)}/{num(w.max)}
              </td>
              <td class="r">{w.percent}%</td>
              <td class="r">{w.weightPct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p class="muted small">
        "Đang tính": bài càng cũ càng tính ít (sau {SCORING.halfLifeWeeks} tuần còn một nửa). Thứ hạng các tuần trước tính theo các bài đã tới hạn lúc đó.
      </p>
    </div>
  );
}

export function LearnerDetailPage(props: { d: LearnerDetail }) {
  return (
    <Layout title={props.d.me.name} publicPage>
      <p class="small">
        <a href="/bang-xep-hang">← Bảng xếp hạng</a>
      </p>
      <LearnerDetailView d={props.d} />
    </Layout>
  );
}
