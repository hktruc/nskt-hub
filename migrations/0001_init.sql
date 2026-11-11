-- Đợt 1: dữ liệu lấy từ dh3g và hàng đợi đồng bộ.
-- Thời gian lưu dạng chuỗi ISO. Các cột *_at từ dh3g giữ nguyên chuỗi dh3g trả về.

CREATE TABLE teams (
  id INTEGER PRIMARY KEY,
  name TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE learners (
  id INTEGER PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  cohort INTEGER,
  team_id INTEGER,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX learners_team ON learners(team_id);

CREATE TABLE assignments (
  id INTEGER PRIMARY KEY,
  title TEXT,
  type TEXT,            -- NORMAL | WEEK | EXAM
  type_label TEXT,
  due_at TEXT,
  grace_minutes INTEGER,
  course_id INTEGER,
  course_name TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX assignments_due ON assignments(due_at);

-- Một dòng cho mỗi cặp (học viên, bài tập), kể cả khi chưa nộp.
CREATE TABLE submissions (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  submission_id INTEGER,
  status TEXT,          -- DONE | LATE | OVERDUE | NOT_SUBMITTED
  status_label TEXT,
  raw_status TEXT,
  priority_status TEXT,
  submitted_at TEXT,
  edit_count INTEGER,
  last_edited_at TEXT,
  char_count INTEGER,
  media_count INTEGER,
  feedback_count INTEGER,
  edits_json TEXT,      -- mảng JSON nguyên dạng dh3g
  answers_json TEXT,
  feedbacks_json TEXT,
  answers_hash TEXT,    -- đổi khi nội dung trả lời đổi (dùng cho chấm điểm sau này)
  content_hash TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id)
);
CREATE INDEX submissions_assignment ON submissions(assignment_id, status);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  title TEXT,
  start_at TEXT,
  end_at TEXT,
  course_id INTEGER,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE attendances (
  learner_id INTEGER NOT NULL,
  session_id INTEGER NOT NULL,
  attended INTEGER,     -- 1 có mặt, 0 vắng, NULL không rõ
  attended_at TEXT,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, session_id)
);

-- Hàng đợi kiêm nhật ký đồng bộ: mỗi dòng là một lần gọi dh3g cho một khoảng ngày.
CREATE TABLE sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report TEXT NOT NULL,       -- submissions | attendance
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT NOT NULL,       -- daily | full | manual
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  enqueued_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  http_status INTEGER,
  bytes INTEGER,
  summary TEXT,               -- JSON: số bản ghi đã xử lý
  error TEXT
);
CREATE UNIQUE INDEX sync_jobs_one_open ON sync_jobs(report, from_date, to_date)
  WHERE status IN ('pending', 'running');
CREATE INDEX sync_jobs_status ON sync_jobs(status, from_date);

-- Bản gốc mới nhất (nén gzip) của mỗi khoảng ngày, để dựng lại bảng khi cần.
CREATE TABLE raw_responses (
  report TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  generated_at TEXT,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  PRIMARY KEY (report, from_date, to_date)
);
CREATE TABLE raw_chunks (
  report TEXT NOT NULL,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  seq INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (report, from_date, to_date, seq)
);
