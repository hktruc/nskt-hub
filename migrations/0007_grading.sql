-- Bàn chấm bài tuần (người chấm: ban phụng sự, coach, BTC). Không ảnh hưởng bảng xếp hạng.

-- Tầng A: chấm riêng từng video / sơ đồ trong bài nộp.
CREATE TABLE item_reviews (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,          -- "<chỉ số câu>:<đường dẫn>"
  kind TEXT NOT NULL,              -- video | so-do
  a1 INTEGER, a2 INTEGER, a3 INTEGER, a4 INTEGER,   -- video: 1–5 sao
  a5 INTEGER,                      -- sơ đồ: 1–5 sao
  flag TEXT,                       -- khong-xem-duoc | khong-dung-de | trung-bai-cu (đã đánh dấu thì không chấm sao)
  grader_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id, item_key)
);

-- Tầng B: chấm chung một lần cho cả tuần.
CREATE TABLE week_reviews (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  b1 INTEGER,                      -- trọng tâm tuần, 1–5
  b2 INTEGER,                      -- chiều sâu phần viết, 1–5
  spirit TEXT,                     -- nghiem-tuc | binh-thuong | doi-pho
  progress TEXT,                   -- tien-bo | giu-nguyen | di-xuong
  comment TEXT,
  featured_key TEXT,               -- item_key được đề cử bài mẫu
  score REAL,                      -- điểm chất lượng tuần (thang 5), tính khi lưu
  items_total INTEGER,             -- số video + sơ đồ lúc chấm
  answers_hash TEXT,               -- bài nộp lúc chấm (để biết học viên sửa bài sau đó)
  grader_id INTEGER NOT NULL,
  grader_label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id)
);
CREATE INDEX week_reviews_grader ON week_reviews(grader_id);

-- Năng lực trọng tâm (B1) của từng bài tuần; không có dòng = dùng mặc định.
CREATE TABLE assignment_focus (
  assignment_id INTEGER PRIMARY KEY,
  focus TEXT NOT NULL,
  set_by TEXT,
  set_at TEXT NOT NULL
);
