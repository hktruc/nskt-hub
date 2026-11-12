-- Tài khoản người dùng nội bộ (admin, BTC, coach, ban phụng sự). Đăng nhập bằng số điện thoại + mật khẩu tự đặt,
-- kích hoạt lần đầu bằng mã dùng một lần do admin cấp. Mật khẩu và mã chỉ lưu dạng băm (PBKDF2).
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,      -- số điện thoại chuẩn hóa (0xxxxxxxxx)
  name TEXT NOT NULL,
  role TEXT NOT NULL,              -- admin | btc | coach | phung_su
  password_hash TEXT,              -- NULL = chưa kích hoạt
  code_hash TEXT,                  -- mã kích hoạt còn hiệu lực (băm)
  code_expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,  -- 0 = đã thu hồi quyền
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT,
  last_login_at TEXT
);

CREATE TABLE user_sessions (
  token_hash TEXT PRIMARY KEY,     -- SHA-256 của mã phiên trong cookie
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX user_sessions_user ON user_sessions(user_id);

-- Đội được giao cho người chấm (ban phụng sự). Coach, BTC, admin xem được mọi đội.
CREATE TABLE grader_teams (
  user_id INTEGER NOT NULL,
  team_code TEXT NOT NULL,         -- T01…T12
  assigned_at TEXT NOT NULL,
  assigned_by TEXT,
  PRIMARY KEY (user_id, team_code)
);
