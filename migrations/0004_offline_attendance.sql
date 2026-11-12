-- Điểm danh offline đọc từ Google Sheet "NSKT2026 - KỶ LUẬT - HỌC VIÊN" (trang CHECK_IN).
-- Mỗi lần đồng bộ thay toàn bộ bảng bằng nội dung mới nhất của file.
CREATE TABLE offline_attendance (
  learner_id INTEGER NOT NULL,
  session_day TEXT NOT NULL,      -- ngày buổi học (YYYY-MM-DD)
  code TEXT NOT NULL,             -- OK, M, X, M1, CANH_BAO, P, PD, VANG, KHAC
  resident_code TEXT,             -- Mã Cư Dân trong file lúc đồng bộ (chỉ để đối chiếu)
  synced_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, session_day)
);

-- Nhật ký mỗi lần đọc Google Sheet.
CREATE TABLE sheet_syncs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  status TEXT NOT NULL,           -- ok / loi / chua-cau-hinh
  sessions INTEGER,               -- số buổi đã có dữ liệu
  rows_total INTEGER,             -- số học viên trong file điểm danh
  matched INTEGER,                -- số học viên ghép được với dh3g qua số điện thoại
  unmatched_json TEXT,            -- danh sách Mã Cư Dân chưa ghép được
  message TEXT
);
