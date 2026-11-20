import { teamLabel, type TeamCode } from "../domain/teams";
import { Layout } from "../layout";
import { summarize, type FundData, type FundMember } from "../fund/read";

// Quỹ gieo hạt (chỉ BTC, coach, admin): số tiền học viên bị trừ dần vì vi phạm kỷ luật, từ số tiền cam kết đã đóng khi vào khóa.

/** 1125000 → "1.125.000 đ". */
export const money = (n: number) => `${n < 0 ? "−" : ""}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} đ`;
/** "2026-11-20" → "20-11-2026". */
export const ddmmyyyy = (day: string) => `${day.slice(8, 10)}-${day.slice(5, 7)}-${day.slice(0, 4)}`;

export function FundPage(props: { day: string; data: FundData; team: string }) {
  const all = props.data.members;
  const s = summarize(all);
  const teamCodes = s.teams.map((t) => t.team);
  const team = teamCodes.includes(props.team) ? props.team : "";
  const people: FundMember[] = all.filter((m) => !team || m.team === team).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "vi"));
  const shown = team ? s.teams.find((t) => t.team === team) : null;
  return (
    <Layout title="Quỹ gieo hạt">
      <h1>Quỹ gieo hạt</h1>
      <p class="muted small">
        Tính đến ngày <b>{ddmmyyyy(props.day)}</b>
        {props.data.updatedText ? <> · bảng tính kỷ luật cập nhật lúc {props.data.updatedText}</> : null}. Đây là số tiền học viên bị trừ dần khi vi phạm kỷ luật, từ số tiền cam kết đã đóng khi tham gia khóa học (mỗi người đóng mức khác nhau).
      </p>
      <div class="tiles">
        <div class="tile">
          <div class="num" style="font-size:1.3rem;white-space:nowrap">{money(s.total)}</div>
          <div class="lbl">Tổng đã gieo hạt vào quỹ</div>
        </div>
        <div class="tile">
          <div class="num">
            {s.paying}/{s.members}
          </div>
          <div class="lbl">học viên đã bị trừ tiền</div>
        </div>
        <div class="tile">
          <div class="num" style="font-size:1.3rem;white-space:nowrap">{money(s.personal)}</div>
          <div class="lbl">do lỗi của chính mình</div>
        </div>
        <div class="tile">
          <div class="num" style="font-size:1.3rem;white-space:nowrap">{money(s.byTeam)}</div>
          <div class="lbl">do đồng đội cùng đội vi phạm</div>
        </div>
      </div>

      <h2>Theo đội</h2>
      <div class="scroll">
        <table class="rtable">
          <thead>
            <tr>
              <th>Đội</th>
              <th class="r">Học viên</th>
              <th class="r">Đã bị trừ</th>
              <th class="r">Lỗi cá nhân</th>
              <th class="r">Theo đồng đội</th>
              <th class="r">Tổng</th>
              <th class="r">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {s.teams.map((t) => (
              <tr>
                <td>
                  <a href={`/gieo-hat?doi=${t.team}#ca-nhan`}>{teamLabel(t.team as TeamCode)}</a>
                </td>
                <td class="r">{t.members}</td>
                <td class="r">{t.paying}</td>
                <td class="r">{money(t.personal)}</td>
                <td class="r">{money(t.byTeam)}</td>
                <td class="r">
                  <b>{money(t.total)}</b>
                </td>
                <td class="r">{t.share}%</td>
              </tr>
            ))}
            <tr>
              <td>
                <b>Cộng</b>
              </td>
              <td class="r">{s.members}</td>
              <td class="r">{s.paying}</td>
              <td class="r">{money(s.personal)}</td>
              <td class="r">{money(s.byTeam)}</td>
              <td class="r">
                <b>{money(s.total)}</b>
              </td>
              <td class="r">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="ca-nhan">Theo cá nhân{shown ? ` · ${teamLabel(shown.team as TeamCode)}` : ""}</h2>
      <nav class="chips" aria-label="Lọc theo đội">
        <a class={`chip${team ? "" : " on"}`} href="/gieo-hat#ca-nhan">
          Cả lớp
        </a>
        {teamCodes.map((t) => (
          <a class={`chip${team === t ? " on" : ""}`} href={`/gieo-hat?doi=${t}#ca-nhan`}>
            {t}
          </a>
        ))}
      </nav>
      <div class="scroll">
        <table class="rtable">
          <thead>
            <tr>
              <th>#</th>
              <th>Họ và tên</th>
              <th>Đội</th>
              <th class="r">Lỗi cá nhân</th>
              <th class="r">Theo đồng đội</th>
              <th class="r">Tổng</th>
            </tr>
          </thead>
          <tbody>
            {people.map((m, i) => (
              <tr>
                <td class="muted">{i + 1}</td>
                <td>
                  {m.name}
                  {m.status && m.status !== "Đang học" ? <span class="muted small"> · {m.status}</span> : null}
                </td>
                <td>{m.team}</td>
                <td class="r">{money(m.personal)}</td>
                <td class="r">{money(m.byTeam)}</td>
                <td class="r">
                  <b>{money(m.total)}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">
        Nguồn: bảng tính “NSKT2026 — KỶ LUẬT TỔNG”, tab TONG_HOP, tự cập nhật khoảng 15 phút một lần; trang này chỉ đọc, không sửa gì. Số tiền gồm cả học viên đã rời lớp (phần đã gieo hạt đến lúc rời vẫn được giữ). Đội tính theo đội hiện tại của học viên.
        {props.data.skipped ? ` Có ${props.data.skipped} dòng không thuộc 12 đội nên không tính.` : ""}
      </p>
    </Layout>
  );
}

export function FundMessagePage(props: { title: string; message: string }) {
  return (
    <Layout title="Quỹ gieo hạt">
      <h1>Quỹ gieo hạt</h1>
      <div class="card-item">
        <b>{props.title}</b>
        <p>{props.message}</p>
      </div>
    </Layout>
  );
}
