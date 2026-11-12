import { formatVN } from "../dates";
import { teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import type { GraderStat } from "../grading/stats";

// Năng lực chấm của ban phụng sự (và coach) — chỉ coach, BTC, admin xem.

export function GradersPage(props: { graders: GraderStat[]; overall: number | null; teamsOf: Map<number, string[]> }) {
  const f = (n: number | null) => (n === null ? "—" : n.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  return (
    <Layout title="Năng lực người chấm">
      <p class="small">
        <a href="/cham">← Bàn chấm</a>
      </p>
      <h1>Năng lực người chấm</h1>
      <p class="muted small">
        Điểm trung bình cả khóa: <strong>{f(props.overall)}★</strong>. Người cho điểm cao hơn mặt bằng từ 0,5★ trở lên (đã chấm ít nhất 5 bài) bị đánh
        dấu <span class="badge warn">Chấm dễ</span>, thấp hơn từ 0,5★ là <span class="badge warn">Chấm khắt khe</span>. "Đúng hạn" = chấm trong 3 ngày
        sau hạn nộp.
      </p>
      {props.graders.length === 0 ? <p class="muted">Chưa có ai chấm bài.</p> : null}
      <ul class="list">
        {props.graders.map((g) => (
          <li>
            <div class="row-top">
              <div>
                <strong>{g.label}</strong>
                <div class="small muted">
                  {(props.teamsOf.get(g.graderId) ?? []).map(teamLabel).join(", ") || "Không giới hạn đội"} · lần chấm gần nhất {formatVN(g.lastAt)}
                </div>
              </div>
              {g.lean ? <span class="badge warn">{g.lean === "de" ? "Chấm dễ" : "Chấm khắt khe"}</span> : null}
            </div>
            <div class="g-stats">
              <span>
                <strong>{g.reviews}</strong> bài
              </span>
              <span>
                <strong>{g.reviews ? Math.round((100 * g.onTime) / g.reviews) : 0}%</strong> đúng hạn
              </span>
              <span>
                TB <strong>{f(g.avg)}★</strong>
              </span>
              <span>
                <strong>{g.doiPho}</strong> đối phó
              </span>
              <span>
                <strong>{g.reviews ? Math.round((100 * g.withComment) / g.reviews) : 0}%</strong> có nhận xét
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Layout>
  );
}
