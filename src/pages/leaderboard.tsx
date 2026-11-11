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
      <p class="muted small">
        Cập nhật {formatVN(props.updatedAt)} (giờ Việt Nam). Điểm là phần trăm so với điểm tối đa, bài càng cũ tính càng ít
        (sau {SCORING.halfLifeWeeks} tuần còn một nửa) — ai cố gắng từ bây giờ vẫn lên được màu xanh.
      </p>
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

      <div class="legend">
        <span class="dot-label xanh">Xanh ≥ {SCORING.greenFrom}% · {count("xanh")}</span>
        <span class="dot-label vang">Vàng {SCORING.yellowFrom}–{SCORING.greenFrom - 1}% · {count("vang")}</span>
        <span class="dot-label do">Đỏ &lt; {SCORING.yellowFrom}% · {count("do")}</span>
      </div>

      {list.length === 0 ? (
        <p class="muted">Chưa có điểm.</p>
      ) : (
        <ol class="list rank-list">
          {list.map((r) => (
            <li class={`rank-row ${r.color}`}>
              <span class="rank">{r.shown}</span>
              <span class="who">
                <strong>{r.name}</strong>
                <span class="muted small">
                  {teamLabel(r.team)}
                  {props.team ? ` · hạng khóa ${r.rank}` : ""}
                </span>
              </span>
              <span class="score">
                <strong>{r.percent.toLocaleString("vi-VN")}%</strong>
                <span class={`dot-label ${r.color}`}>{r.colorLabel}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Layout>
  );
}
