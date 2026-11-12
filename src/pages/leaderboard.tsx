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
  hasAttendance?: boolean;
  updatedAt: string | null;
  origin?: string;
  /** Người đã đăng nhập (BTC, coach, ban phụng sự): thấy đủ menu và logo về trang chủ. */
  viewerNav?: "full" | "grader";
}) {
  const filtered = props.team ? props.ranked.filter((r) => r.team === props.team) : props.ranked;
  // Xem một đội: hạng trong đội, kèm hạng toàn khóa. Bằng điểm thì ngang hạng.
  const same = (a: Ranked, b: Ranked) => a.rank === b.rank; // hạng toàn khóa bằng nhau = bằng điểm mọi tiêu chí
  const list = filtered.map((r) => ({ ...r, shown: 0 }));
  list.forEach((r, i) => {
    const prev = list[i - 1];
    r.shown = props.team ? (prev && same(prev, r) ? prev.shown : i + 1) : r.rank;
  });
  const count = (c: Ranked["color"]) => list.filter((r) => r.color === c).length;
  return (
    <Layout
      title="Bảng xếp hạng"
      publicPage={!props.viewerNav}
      nav={props.viewerNav}
      og={
        props.origin
          ? {
              title: "Bảng xếp hạng · Nhân Sự Kế Thừa 2026",
              description: "Thứ hạng học viên NSKT 2026 theo 12 đội, cập nhật hằng ngày.",
              url: `${props.origin}/bang-xep-hang${props.team ? `?doi=${props.team}` : ""}`,
              image: `${props.origin}/brand/og-bang-xep-hang.png`,
            }
          : undefined
      }
    >
      <section class="bxh-hero">
        <p class="eyebrow">Cá Chép Vượt Long Môn</p>
        <h1>Bảng xếp hạng</h1>
        <p class="small">
          {props.team ? `${teamLabel(props.team)} · ` : ""}
          {list.length} học viên · cập nhật {formatVN(props.updatedAt)}
        </p>
        {list.length ? (
          <div class="dist" role="img" aria-label={`${count("xanh")} xanh, ${count("vang")} vàng, ${count("do")} đỏ`}>
            {(["xanh", "vang", "do"] as const).map((c) =>
              count(c) ? <span class={`seg-${c}`} style={`flex:${count(c)}`} /> : null,
            )}
          </div>
        ) : null}
        <div class="dist-legend small">
          <span>
            <i class="dot xanh" />≥ {SCORING.greenFrom}%: <strong>{count("xanh")}</strong>
          </span>
          <span>
            <i class="dot vang" />
            {SCORING.yellowFrom}–{SCORING.greenFrom - 1}%: <strong>{count("vang")}</strong>
          </span>
          <span>
            <i class="dot do" />
            &lt; {SCORING.yellowFrom}%: <strong>{count("do")}</strong>
          </span>
        </div>
      </section>
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

      {list.length >= 3 ? (
        <div class="podium" aria-label="Ba người dẫn đầu">
          {[list[1]!, list[0]!, list[2]!].map((r, i) => (
            <a class={`pod pod-${[2, 1, 3][i]} ${r.color}`} href={`/bang-xep-hang/hv/${r.learnerId}`} data-hv="">
              <span class="medal">{r.shown}</span>
              <span class="pname">{r.name}</span>
              <span class="pteam">{props.team ? `#${r.rank} khóa` : teamLabel(r.team)}</span>
              <span class="ppct">{r.percent.toLocaleString("vi-VN")}%</span>
            </a>
          ))}
        </div>
      ) : null}

      {list.length > 8 ? (
        <div class="search">
          <input id="tim" type="search" placeholder="Tìm tên của bạn…" aria-label="Tìm theo tên" autocomplete="off" />
          <span id="tim-kq" class="small muted" />
        </div>
      ) : null}

      {list.length === 0 ? (
        <p class="muted">Chưa có điểm.</p>
      ) : (
        <ol class="rank-list">
          {list.map((r) => (
            <li>
              <a class={`rank-row ${r.color}`} href={`/bang-xep-hang/hv/${r.learnerId}`} data-hv="" data-name={r.name} title="Bấm để xem chi tiết">
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
            Điểm = <strong>{100 - SCORING.attendance.share * 100}% bài tập + {SCORING.attendance.share * 100}% đi học offline</strong>, tính từ 30/09/2026.
            Mỗi phần là % điểm đạt được trên điểm tối đa.
            {props.hasAttendance ? null : " Chưa có dữ liệu điểm danh nên hiện tạm tính theo bài tập."}
          </li>
          <li>
            <strong>Đi học offline (thứ Sáu):</strong> đúng giờ, đúng chỗ đủ điểm · muộn {pct(SCORING.attendance.points.M)} · sai vị trí{" "}
            {pct(SCORING.attendance.points.X)} · muộn và sai vị trí {pct(SCORING.attendance.points.M1)} · không có vị trí{" "}
            {pct(SCORING.attendance.points.CANH_BAO)} · nghỉ có phép {pct(SCORING.attendance.points.P)} ·{" "}
            <strong>vắng hoặc học qua Zoom 0đ</strong>.
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
            <strong>Bài cũ tính ít dần</strong> (sau {SCORING.halfLifeWeeks} tuần còn một nửa; buổi học sau {SCORING.attendance.halfLifeWeeks} tuần):
            cố gắng từ hôm nay sẽ lên nhanh.
          </li>
          <li>
            <span class="swatch xanh">Xanh</span> ≥ {SCORING.greenFrom}% · <span class="swatch vang">Vàng</span>{" "}
            {SCORING.yellowFrom}–{SCORING.greenFrom - 1}% · <span class="swatch do">Đỏ</span> &lt; {SCORING.yellowFrom}%.
            Bằng điểm: ai đi học đúng giờ nhiều buổi hơn, rồi nộp video đúng hạn nhiều hơn, sớm hơn xếp trên.
          </li>
        </ul>
      </section>
      <dialog id="hv" class="sheet" aria-label="Chi tiết học viên">
        <div class="sheet-body" />
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: DIALOG_JS + SEARCH_JS }} />
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

const pct = (p: number | undefined) => `${Math.round((p ?? 0) * 100)}%`;
// Tìm tên: không phân biệt dấu, hoa thường.
const SEARCH_JS = `(() => {
  const q = document.getElementById("tim"); if (!q) return;
  const norm = (s) => s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "d").toLowerCase().trim();
  const rows = [...document.querySelectorAll(".rank-list > li")];
  const pod = document.querySelector(".podium"), kq = document.getElementById("tim-kq");
  q.addEventListener("input", () => {
    const v = norm(q.value); let n = 0;
    rows.forEach((li) => { const a = li.querySelector("[data-name]"); const ok = !v || norm(a.dataset.name).includes(v); li.hidden = !ok; if (ok) n++; });
    if (pod) pod.hidden = !!v;
    kq.textContent = v ? (n ? n + " người" : "Không tìm thấy") : "";
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

/** Đường thứ hạng: hạng 1 ở trên cùng. Vẽ sẵn SVG trên máy chủ, không cần thư viện. */
function RankChart(props: { d: LearnerDetail }) {
  const pts = props.d.history;
  const ranks = pts.map((h) => h.rank).filter((r): r is number => r !== null);
  if (ranks.length < 2) return null;
  const total = Math.max(...pts.map((h) => h.total), ...ranks);
  const W = 300, H = 90, px = 22, py = 14;
  const x = (i: number) => px + (i * (W - 2 * px)) / (pts.length - 1);
  const y = (r: number) => py + ((r - 1) * (H - 2 * py)) / Math.max(1, total - 1);
  const coords = pts.map((h, i) => (h.rank === null ? null : ([x(i), y(h.rank)] as const))).filter((c): c is readonly [number, number] => c !== null);
  const path = coords.map(([cx, cy], i) => `${i ? "L" : "M"}${cx.toFixed(1)},${cy.toFixed(1)}`).join(" ");
  return (
    <svg class="rank-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ thứ hạng 3 tuần gần nhất (càng cao càng tốt)">
      <line x1={px} y1={py} x2={W - px} y2={py} class="grid" />
      <line x1={px} y1={H - py} x2={W - px} y2={H - py} class="grid" />
      <text x="2" y={py + 4} class="lbl">#1</text>
      <text x="2" y={H - py + 4} class="lbl">#{total}</text>
      <path d={path} class="line" />
      {coords.map(([cx, cy], i) => (
        <circle cx={cx} cy={cy} r={i === coords.length - 1 ? 5 : 3.5} class={i === coords.length - 1 ? "pt now" : "pt"} />
      ))}
    </svg>
  );
}

/** Cột % điểm từng tuần (8 tuần gần nhất, cũ → mới). */
function WeekBars(props: { weeks: LearnerDetail["weeks"] }) {
  const ws = props.weeks.slice(0, 8).reverse();
  if (ws.length === 0) return null;
  return (
    <div class="wbars" role="img" aria-label="Điểm bài tập theo tuần">
      {ws.map((w) => (
        <div class="wbar" title={`${ddmm(w.from)}–${ddmm(w.to)}: ${w.percent}%`}>
          <span class="wv">{w.percent}%</span>
          <span class={`wb ${w.percent >= SCORING.greenFrom ? "xanh" : w.percent >= SCORING.yellowFrom ? "vang" : "do"}`} style={`height:${Math.max(4, w.percent)}%`} />
          <span class="wl">{ddmm(w.from)}</span>
        </div>
      ))}
    </div>
  );
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
      <div class="hv-parts">
        <div>
          <span class="small muted">Bài tập</span>
          <strong>{d.me.studyPercent.toLocaleString("vi-VN")}%</strong>
        </div>
        <div>
          <span class="small muted">Đi học offline</span>
          <strong>{d.me.attendancePercent === null ? "—" : `${d.me.attendancePercent.toLocaleString("vi-VN")}%`}</strong>
        </div>
      </div>
      {d.provisional ? <p class="muted small">Có bài đang chờ chấm tự động, điểm có thể thay đổi nhẹ.</p> : null}

      <h2>Thứ hạng 3 tuần gần nhất</h2>
      <RankChart d={d} />
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

      <h2>Đi học offline</h2>
      {d.attendance ? (
        <>
          <div class="hv-stats">
            <div>
              <strong>
                {d.attendance.present}/{d.attendance.sessions}
              </strong>
              <span class="small muted">buổi có mặt</span>
            </div>
            <div>
              <strong>{d.attendance.onTime}</strong>
              <span class="small muted">đúng giờ</span>
            </div>
            <div>
              <strong>{d.attendance.excused}</strong>
              <span class="small muted">nghỉ có phép</span>
            </div>
            <div>
              <strong>{d.attendance.absent}</strong>
              <span class="small muted">vắng</span>
            </div>
          </div>
        </>
      ) : (
        <p class="muted small">Chưa có dữ liệu điểm danh offline.</p>
      )}

      <h2>Chất lượng bài tuần</h2>
      {d.quality ? (
        <>
          <p class="small">
            Coach và ban phụng sự chấm (thang 5★, không tính vào xếp hạng): trung bình <strong>{d.quality.avg === null ? "—" : `${d.quality.avg.toLocaleString("vi-VN")}★`}</strong>
            {d.quality.strongest ? (
              <>
                {" "}
                · mạnh nhất: <strong>{d.quality.strongest}</strong>
              </>
            ) : null}
            {d.quality.weakest ? (
              <>
                {" "}
                · cần cải thiện: <strong>{d.quality.weakest}</strong>
              </>
            ) : null}
            .
          </p>
          <div class="qweeks">
            {d.quality.weeks.map((w) => (
              <span class={`mini ${w.quality ? { tot: "xanh", kha: "vang", "can-kem": "do" }[w.quality] : ""}`} title={w.title}>
                {w.score === null ? "—" : `${w.score.toLocaleString("vi-VN")}★`}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p class="muted small">Chưa có bài tuần nào được chấm.</p>
      )}

      <h2>Bài tập tích lũy</h2>
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

      <WeekBars weeks={d.weeks} />
      <details class="weeks-table">
        <summary class="small">Xem bảng số theo tuần</summary>
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
        <p class="muted small">"Đang tính": bài càng cũ càng tính ít (sau {SCORING.halfLifeWeeks} tuần còn một nửa).</p>
      </details>
      <p class="muted small">Cột màu: % điểm bài tập mỗi tuần. Thứ hạng các tuần trước tính theo các bài đã tới hạn lúc đó.</p>
    </div>
  );
}

export function LearnerDetailPage(props: { d: LearnerDetail; viewerNav?: "full" | "grader" }) {
  return (
    <Layout title={props.d.me.name} publicPage={!props.viewerNav} nav={props.viewerNav}>
      <p class="small">
        <a href="/bang-xep-hang">← Bảng xếp hạng</a>
      </p>
      <LearnerDetailView d={props.d} />
    </Layout>
  );
}
