-- Lịch sử thành viên: ngày vào lớp và ngày rời lớp của từng học viên, đọc từ tab THANH_VIEN của file "NSKT2026 — KỶ LUẬT TỔNG".
-- Dùng để tính bảng xếp hạng công bằng cho người vào sau khai giảng (ân hạn, 6 tuần mới xếp hạng) và bỏ người đã rời lớp.
-- Khóa là số điện thoại (định danh chính thức). Mỗi lần đồng bộ thay toàn bộ bảng.
CREATE TABLE member_history (
  phone TEXT PRIMARY KEY,
  learner_id INTEGER,          -- NULL nếu chưa ghép được với học viên trên dh3g
  joined_at TEXT NOT NULL,     -- "YYYY-MM-DD HH:MM" giờ Việt Nam, lần đầu xuất hiện trong danh sách (qua mọi lần đổi đội, đổi mã)
  left_at TEXT,                -- NULL nếu vẫn đang học
  last_code TEXT,              -- mã Cư Dân hiện tại (hoặc cuối cùng)
  synced_at TEXT NOT NULL
);
CREATE INDEX member_history_learner ON member_history(learner_id);
