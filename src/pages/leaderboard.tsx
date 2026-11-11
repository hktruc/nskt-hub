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
      <details class="rules">
        <summary>Cách tính điểm và phân màu (bấm để xem)</summary>
        <h2>Điểm của bạn là gì?</h2>
        <p>
          Là <strong>phần trăm số điểm bạn đạt được</strong> so với số điểm tối đa có thể đạt, tính từ bài có hạn nộp
          30/09/2026.
        </p>
        <h2>Mỗi bài được bao nhiêu điểm?</h2>
        <ul>
          <li>
            <strong>Bài tập ngày:</strong> mỗi câu bắt buộc {SCORING.daily.mandatory} điểm. Câu khuyến khích: nộp video được{" "}
            {SCORING.daily.encouragedVideo} điểm; không có video nhưng viết đúc kết sâu sắc được {SCORING.daily.encouragedDeepText}{" "}
            điểm.
          </li>
          <li>
            <strong>Bài tập tuần:</strong> mỗi video đúng yêu cầu được {SCORING.weekly.perVideo} điểm; mỗi câu bắt buộc trả
            lời nghiêm túc, đúng ý được {SCORING.weekly.mandatory} điểm; mỗi câu góp ý cho BTC được {SCORING.weekly.idea} điểm.
          </li>
          <li>
            <strong>Nộp trễ hạn:</strong> mỗi video chỉ được {SCORING.lateVideo} điểm, các câu viết được một nửa số điểm.
          </li>
          <li>
            <strong>Trả lời cho có</strong> (vài chữ vô nghĩa, ký hiệu, gõ đại): không được điểm.
          </li>
        </ul>
        <h2>Vì sao cố gắng từ hôm nay vẫn lên được?</h2>
        <p>
          Bài càng cũ càng được tính ít: bài cách đây {SCORING.halfLifeWeeks} tuần chỉ còn tính một nửa, cách đây{" "}
          {SCORING.halfLifeWeeks * 2} tuần còn một phần tư. Vì vậy, làm đủ bài trong vài tuần tới là điểm tăng nhanh, dù
          trước đây chưa làm tốt.
        </p>
        <h2>Màu có nghĩa là gì?</h2>
        <ul>
          <li>
            <span class="swatch xanh">Xanh</span> từ {SCORING.greenFrom}% trở lên: đang làm rất tốt.
          </li>
          <li>
            <span class="swatch vang">Vàng</span> từ {SCORING.yellowFrom}% đến dưới {SCORING.greenFrom}%: khá, cố thêm một chút
            để lên xanh.
          </li>
          <li>
            <span class="swatch do">Đỏ</span> dưới {SCORING.yellowFrom}%: cần cố gắng nhiều hơn.
          </li>
        </ul>
        <p>
          Ai đạt mức nào thì được màu đó, không giới hạn số người mỗi màu. Nếu bằng điểm, người có nhiều video nộp đúng hạn
          hơn, rồi người nộp sớm hơn, xếp trên.
        </p>
      </details>
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
    </Layout>
  );
}
