import { Layout } from "../layout";
import { ROLE_LABEL, type User } from "../users/accounts";
import { teamLabel } from "../domain/teams";

// Trang đăng nhập, kích hoạt, tài khoản. Dành cho admin, BTC, coach, ban phụng sự (học viên không dùng).

const safeNext = (n: string | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "");

export function LoginPage(props: { error?: string; phone?: string; next?: string; notice?: string }) {
  const next = safeNext(props.next);
  return (
    <Layout title="Đăng nhập" publicPage>
      <div class="auth-box">
        <h1>Đăng nhập</h1>
        <p class="muted small">Dành cho BTC, coach và ban phụng sự.</p>
        {props.notice ? <p class="notice small">{props.notice}</p> : null}
        {props.error ? <p class="warn small">{props.error}</p> : null}
        <form method="post" action="/dang-nhap" class="auth-form">
          <input type="hidden" name="tiep" value={next} />
          <label for="sdt">Số điện thoại</label>
          <input id="sdt" name="sdt" type="tel" inputmode="tel" autocomplete="username" required value={props.phone ?? ""} />
          <label for="mk">Mật khẩu</label>
          <input id="mk" name="mk" type="password" autocomplete="current-password" required />
          <button>Đăng nhập</button>
        </form>
        <p class="small">
          Lần đầu dùng, hoặc được admin cấp mã mới? <a href="/kich-hoat">Kích hoạt tài khoản</a>
        </p>
        <p class="small muted">Quên mật khẩu: nhờ admin cấp mã kích hoạt mới.</p>
      </div>
    </Layout>
  );
}

export function ActivatePage(props: { error?: string; phone?: string }) {
  return (
    <Layout title="Kích hoạt tài khoản" publicPage>
      <div class="auth-box">
        <h1>Kích hoạt tài khoản</h1>
        <p class="muted small">Nhập mã admin đã gửi cho bạn (dùng một lần, hết hạn sau 7 ngày) và tự đặt mật khẩu.</p>
        {props.error ? <p class="warn small">{props.error}</p> : null}
        <form method="post" action="/kich-hoat" class="auth-form">
          <label for="sdt">Số điện thoại</label>
          <input id="sdt" name="sdt" type="tel" inputmode="tel" autocomplete="username" required value={props.phone ?? ""} />
          <label for="ma">Mã kích hoạt</label>
          <input id="ma" name="ma" autocomplete="one-time-code" placeholder="VD: ABCD-2345" required />
          <label for="mk">Mật khẩu mới (ít nhất 8 ký tự)</label>
          <input id="mk" name="mk" type="password" autocomplete="new-password" minlength={8} required />
          <label for="mk2">Nhập lại mật khẩu</label>
          <input id="mk2" name="mk2" type="password" autocomplete="new-password" minlength={8} required />
          <button>Kích hoạt và đăng nhập</button>
        </form>
        <p class="small">
          Đã có mật khẩu? <a href="/dang-nhap">Đăng nhập</a>
        </p>
      </div>
    </Layout>
  );
}

export function NeedLoginPage(props: { path: string; message?: string }) {
  return (
    <Layout title="Cần đăng nhập" publicPage>
      <div class="auth-box">
        <h1>Cần đăng nhập</h1>
        <p>Trang này chỉ dành cho BTC, coach và ban phụng sự.</p>
        {props.message ? <p class="muted small">{props.message}</p> : null}
        <p>
          <a class="btn" href={`/dang-nhap?tiep=${encodeURIComponent(props.path)}`}>
            Đăng nhập bằng số điện thoại
          </a>
        </p>
      </div>
    </Layout>
  );
}

export function ForbiddenPage(props: { user: User; message: string }) {
  return (
    <Layout title="Không có quyền" nav={props.user.role === "phung_su" ? "grader" : "full"}>
      <h1>Không có quyền</h1>
      <p>{props.message}</p>
      <p>
        <a href={props.user.role === "phung_su" ? "/cham" : "/"}>← Về trang của bạn</a>
      </p>
    </Layout>
  );
}

export function AccountPage(props: { user: User; error?: string; notice?: string }) {
  const u = props.user;
  return (
    <Layout title="Tài khoản" nav={u.role === "phung_su" ? "grader" : "full"}>
      <h1>Tài khoản</h1>
      {props.notice ? <p class="notice">{props.notice}</p> : null}
      <p>
        <strong>{u.name}</strong> · {ROLE_LABEL[u.role]}
        {u.viaAccess ? " (đăng nhập qua Cloudflare Access)" : ` · ${u.phone}`}
      </p>
      {u.role === "phung_su" ? (
        <p>Đội được giao chấm: {u.teams.length ? u.teams.map(teamLabel).join(", ") : "chưa có (nhờ admin giao)"}.</p>
      ) : null}
      {u.role === "admin" ? (
        <p>
          <a href="/quan-tri">→ Quản trị tài khoản và giao đội chấm</a>
        </p>
      ) : null}
      {u.viaAccess ? null : (
        <>
          <h2>Đổi mật khẩu</h2>
          {props.error ? <p class="warn small">{props.error}</p> : null}
          <form method="post" action="/tai-khoan/mat-khau" class="auth-form" style="max-width:360px">
            <label for="cu">Mật khẩu hiện tại</label>
            <input id="cu" name="cu" type="password" autocomplete="current-password" required />
            <label for="mk">Mật khẩu mới (ít nhất 8 ký tự)</label>
            <input id="mk" name="mk" type="password" autocomplete="new-password" minlength={8} required />
            <label for="mk2">Nhập lại mật khẩu mới</label>
            <input id="mk2" name="mk2" type="password" autocomplete="new-password" minlength={8} required />
            <button>Đổi mật khẩu</button>
          </form>
          <h2>Đăng xuất</h2>
          <form method="post" action="/dang-xuat">
            <button class="secondary">Đăng xuất</button>
          </form>
        </>
      )}
    </Layout>
  );
}

/** Trang tạm cho ban phụng sự cho tới khi có bàn chấm. */
export function GraderHomePage(props: { user: User }) {
  return (
    <Layout title="Bàn chấm" nav="grader">
      <h1>Bàn chấm bài tuần</h1>
      <p>Xin chào {props.user.name}.</p>
      <p>
        Đội được giao: <strong>{props.user.teams.length ? props.user.teams.map(teamLabel).join(", ") : "chưa có"}</strong>.
      </p>
      <p class="notice">Bàn chấm đang được xây dựng, sẽ mở trong đợt tới. Bộ tiêu chí chấm xem ở tài liệu BTC gửi.</p>
    </Layout>
  );
}
