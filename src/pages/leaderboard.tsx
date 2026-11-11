import { formatVN } from "../dates";
import { teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import { SCORING } from "../scoring/config";
import type { Ranked } from "../scoring/leaderboard";

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
            <li class={`rank-row ${r.color}`} title={`${r.colorLabel}`}>
              <span class="rank">{r.shown}</span>
              <span class="name">{r.name}</span>
              <span class="team">{props.team ? `#${r.rank} khóa` : teamLabel(r.team)}</span>
              <span class="pct">{r.percent.toLocaleString("vi-VN")}%</span>
            </li>
          ))}
        </ol>
      )}
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
    </Layout>
  );
}
