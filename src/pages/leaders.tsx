// BTC / coach / admin quản lý tài khoản trưởng nhóm: tạo, cấp lại mã kích hoạt, thu hồi / khôi phục, đổi nhóm phụ trách.
// Chỉ thao tác được trên tài khoản vai trò trưởng nhóm; tài khoản BTC, coach, admin vẫn chỉ admin tạo ở /quan-tri.

import { formatVN } from "../dates";
import { teamCodes, teamLabel } from "../domain/teams";
import type { UserListItem } from "../users/accounts";
import type { IssuedCode } from "./admin";
import { DisciplineShell, type Viewer } from "./discipline";

const TEAMS = teamCodes();
const STATUS: Record<UserListItem["status"], [string, string]> = {
  "cho-kich-hoat": ["Chờ kích hoạt", "warn"],
  "dang-dung": ["Đang dùng", "ok"],
  "thu-hoi": ["Đã thu hồi", "bad"],
};

function TeamSelect(props: { name: string; value?: string }) {
  return (
    <select name={props.name} required>
      <option value="">— Chọn nhóm —</option>
      {TEAMS.map((t) => (
        <option value={t} selected={t === props.value}>
          {teamLabel(t)}
        </option>
      ))}
    </select>
  );
}

export function LeadersPage(props: { v: Viewer; leaders: UserListItem[]; issued?: IssuedCode; error?: string; notice?: string; origin: string }) {
  const without = TEAMS.filter((t) => !props.leaders.some((u) => u.status !== "thu-hoi" && u.teams.includes(t)));
  return (
    <DisciplineShell tab="/ky-luat/truong-nhom" title="Tài khoản trưởng nhóm" v={props.v} notice={props.notice}>
      {props.issued ? (
        <div class="notice code-box">
          <p style="margin:0 0 6px">
            Mã kích hoạt cho <strong>{props.issued.name}</strong> ({props.issued.phone}):
          </p>
          <p class="code">{props.issued.code}</p>
          <p class="small" style="margin:6px 0 0">
            Mã chỉ hiện <strong>một lần</strong>, hết hạn sau 7 ngày. Gửi riêng cho trưởng nhóm kèm link: {props.origin}/kich-hoat
          </p>
        </div>
      ) : null}
      {props.error ? <p class="warn">{props.error}</p> : null}
      <p class="muted small">
        Trưởng nhóm đăng nhập bằng số điện thoại, chỉ xem nhóm mình, báo camera sau mỗi buổi Zoom và viết nhật ký nhóm hằng tuần. Tài khoản BTC, coach do admin tạo.
      </p>
      {without.length ? <p class="warn small">Nhóm chưa có trưởng nhóm: {without.map(teamLabel).join(", ")}.</p> : null}

      <h2>Thêm trưởng nhóm</h2>
      <form method="post" action="/ky-luat/truong-nhom/tao" class="auth-form admin-new">
        <label for="ten">Họ tên</label>
        <input id="ten" name="ten" required />
        <label for="sdt">Số điện thoại</label>
        <input id="sdt" name="sdt" type="tel" inputmode="tel" required />
        <label for="doi">Nhóm phụ trách</label>
        <TeamSelect name="doi" />
        <button>Tạo và lấy mã kích hoạt</button>
      </form>

      <h2>Danh sách ({props.leaders.length})</h2>
      {props.leaders.length === 0 ? <p class="muted">Chưa có trưởng nhóm nào.</p> : null}
      <ul class="list">
        {props.leaders.map((u) => {
          const [label, badge] = STATUS[u.status];
          return (
            <li>
              <div class="row-top">
                <div>
                  <strong>{u.name}</strong> <span class="muted small">· {u.phone}</span>
                  <div class="small">
                    {u.teams.length ? u.teams.map(teamLabel).join(", ") : "chưa giao nhóm"} · lần vào gần nhất {formatVN(u.last_login_at)}
                  </div>
                </div>
                <span class={`badge ${badge}`}>{label}</span>
              </div>
              <details class="admin-actions">
                <summary class="small">Thao tác</summary>
                <form method="post" action="/ky-luat/truong-nhom/doi" class="actions" style="margin-top:8px">
                  <input type="hidden" name="id" value={String(u.id)} />
                  <TeamSelect name="doi" value={u.teams[0]} />
                  <button class="secondary">Đổi nhóm</button>
                </form>
                <div class="actions" style="margin-top:8px">
                  <form method="post" action="/ky-luat/truong-nhom/ma">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <button class="secondary">Cấp mã kích hoạt mới</button>
                  </form>
                  <form method="post" action="/ky-luat/truong-nhom/trang-thai">
                    <input type="hidden" name="id" value={String(u.id)} />
                    <input type="hidden" name="bat" value={u.status === "thu-hoi" ? "1" : "0"} />
                    <button class="secondary">{u.status === "thu-hoi" ? "Khôi phục quyền" : "Thu hồi quyền"}</button>
                  </form>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </DisciplineShell>
  );
}
