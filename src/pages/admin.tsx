import { addDays, formatVN, mondayOf, vietnamDay } from "../dates";
import { teamLabel } from "../domain/teams";
import { Layout } from "../layout";
import { ROLE_LABEL, ROLES, type UserListItem } from "../users/accounts";

// Quản trị (chỉ admin): tạo tài khoản, cấp lại mã kích hoạt, thu hồi / khôi phục, đổi vai trò, giao đội chấm.

const TEAMS = Array.from({ length: 12 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`);
const STATUS: Record<UserListItem["status"], [string, string]> = {
  "cho-kich-hoat": ["Chờ kích hoạt", "warn"],
  "dang-dung": ["Đang dùng", "ok"],
  "thu-hoi": ["Đã thu hồi", "bad"],
};

export type IssuedCode = { name: string; phone: string; code: string };

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function AdminPage(props: { users: UserListItem[]; issued?: IssuedCode; error?: string; notice?: string; origin: string }) {
  const week = mondayOf(vietnamDay(new Date()));
  const weeks = [0, 1, 2, 3, 4, 5].map((i) => addDays(week, 7 * i));
  return (
    <Layout title="Quản trị">
      <h1>Quản trị tài khoản</h1>
      {props.issued ? (
        <div class="notice code-box">
          <p style="margin:0 0 6px">
            Mã kích hoạt cho <strong>{props.issued.name}</strong> ({props.issued.phone}):
          </p>
          <p class="code">{props.issued.code}</p>
          <p class="small" style="margin:6px 0 0">
            Mã chỉ hiện <strong>một lần</strong>, hết hạn sau 7 ngày. Gửi riêng cho người đó kèm link: {props.origin}/kich-hoat
          </p>
        </div>
      ) : null}
      {props.notice ? <p class="notice toast" role="status">✓ {props.notice}</p> : null}
      {props.error ? <p class="warn">{props.error}</p> : null}

      <h2>Thêm người</h2>
      <form method="post" action="/quan-tri/tao" class="auth-form admin-new">
        <label for="ten">Họ tên</label>
        <input id="ten" name="ten" required />
        <label for="sdt">Số điện thoại</label>
        <input id="sdt" name="sdt" type="tel" inputmode="tel" required />
        <label for="vt">Vai trò</label>
        <select id="vt" name="vt">
          {ROLES.map((r) => (
            <option value={r} selected={r === "phung_su"}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <button>Tạo và lấy mã kích hoạt</button>
      </form>
      <p class="muted small">
        Admin, BTC, coach: dùng mọi trang nội bộ. Ban phụng sự: chỉ vào bàn chấm, chỉ chấm các đội được giao. Kết quả chấm của ban phụng sự
        hiện công khai cho coach và BTC xem.
      </p>

      <h2>Danh sách ({props.users.length})</h2>
      {props.users.length === 0 ? <p class="muted">Chưa có ai.</p> : null}
      <ul class="list">
        {props.users.map((u) => {
          const [label, badge] = STATUS[u.status];
          return (
            <li>
              <div class="row-top">
                <div>
                  <strong>{u.name}</strong> <span class="muted small">· {u.phone}</span>
                  <div class="small">
                    {ROLE_LABEL[u.role]}
                    {u.role === "phung_su" ? ` · tuần này chấm: ${u.teams.length ? u.teams.map(teamLabel).join(", ") : "chưa giao"}` : ""} · lần vào gần nhất{" "}
                    {formatVN(u.last_login_at)}
                  </div>
                </div>
                <span class={`badge ${badge}`}>{label}</span>
              </div>
              <details class="admin-actions">
                <summary class="small">Thao tác</summary>
                {u.role === "phung_su" ? (
                  <form method="post" action="/quan-tri/doi" class="team-pick">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <div class="small" style="font-weight:600;margin-bottom:4px">Giao đội chấm (luân phiên theo tuần)</div>
                    {u.plans.length ? (
                      <ul class="small plan-list">
                        {u.plans.map((p) => (
                          <li class={p.fromWeek > week ? "future" : ""}>
                            Từ tuần {ddmm(p.fromWeek)}: {p.teams.length ? p.teams.map(teamLabel).join(", ") : "không chấm"}
                            {p.fromWeek > week ? " (sắp tới)" : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <label class="small">
                      Áp dụng từ tuần{" "}
                      <select name="tuan">
                        {weeks.map((w, i) => (
                          <option value={w}>
                            {ddmm(w)}
                            {i === 0 ? " (tuần này)" : i === 1 ? " (tuần sau)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p class="small muted" style="margin:4px 0">Các tuần sau giữ nguyên như vậy cho tới khi giao lại. Nhiều người có thể chấm trùng đội.</p>
                    <div class="team-grid">
                      {TEAMS.map((t) => (
                        <label class="tchk">
                          <input type="checkbox" name="doi" value={t} checked={u.teams.includes(t)} /> {teamLabel(t)}
                        </label>
                      ))}
                    </div>
                    <button class="secondary">Lưu lịch giao</button>
                  </form>
                ) : null}
                <div class="actions" style="margin-top:8px">
                  <form method="post" action="/quan-tri/ma">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <button class="secondary">Cấp mã kích hoạt mới</button>
                  </form>
                  <form method="post" action="/quan-tri/trang-thai">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <input type="hidden" name="bat" value={u.active ? "0" : "1"} />
                    <button class="secondary">{u.active ? "Thu hồi quyền" : "Khôi phục quyền"}</button>
                  </form>
                  <form method="post" action="/quan-tri/vai-tro" class="pick-row">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <select name="vt" aria-label="Đổi vai trò">
                      {ROLES.map((r) => (
                        <option value={r} selected={r === u.role}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <button class="secondary">Đổi vai trò</button>
                  </form>
                </div>
                <p class="muted small">Cấp mã mới sẽ hủy mật khẩu cũ và đăng xuất người đó khỏi mọi máy.</p>
              </details>
            </li>
          );
        })}
      </ul>
    </Layout>
  );
}
