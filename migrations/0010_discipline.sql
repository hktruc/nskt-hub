-- Kỷ luật (lỗi nhẹ / lỗi nặng): dữ liệu do trưởng nhóm và BTC nhập trên web.
-- Bài tập và điểm danh Zoom lấy từ dh3g (bảng submissions, sessions, attendances), không lưu lại ở đây.

-- Trưởng nhóm đánh dấu ai KHÔNG bật camera trong một buổi Zoom (dh3g không ghi nhận camera).
CREATE TABLE zoom_camera (
  session_id INTEGER NOT NULL,
  learner_id INTEGER NOT NULL,
  camera_off INTEGER NOT NULL,     -- 1 = không bật camera
  by_user TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (session_id, learner_id)
);

-- Báo cáo của nhóm: kind 'camera' (ref = mã buổi Zoom: đã báo cáo camera buổi đó) hoặc
-- 'journal' (ref = thứ Hai của tuần: nhật ký nhóm tuần đó, nội dung trong content_json).
CREATE TABLE team_reports (
  team TEXT NOT NULL,              -- T01…
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  content_json TEXT,
  by_user TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (team, kind, ref)
);

-- BTC duyệt miễn: mục đó không tính lỗi, lưu lý do. kind 'bai' (ref = mã bài tập) hoặc 'zoom' (ref = mã buổi).
CREATE TABLE discipline_exemptions (
  learner_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ref INTEGER NOT NULL,
  reason TEXT NOT NULL,
  by_user TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (learner_id, kind, ref)
);

-- BTC đánh dấu thành viên dừng tham gia (không tính vào "đang tham gia", không tính lỗi từ ngày dừng).
CREATE TABLE learner_status (
  learner_id INTEGER PRIMARY KEY,
  stopped_from TEXT NOT NULL,      -- ngày (giờ VN) bắt đầu dừng, YYYY-MM-DD
  reason TEXT,
  by_user TEXT NOT NULL,
  at TEXT NOT NULL
);
