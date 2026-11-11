-- Đợt 4: chấm điểm tự động và bảng xếp hạng.

-- Cấu trúc câu hỏi của mỗi bài tập (loại câu, điểm tối đa), suy ra từ đề bài và dữ liệu nộp.
CREATE TABLE assignment_specs (
  assignment_id INTEGER PRIMARY KEY,
  questions_hash TEXT NOT NULL,   -- đổi khi đề bài đổi
  spec_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,       -- lần cấu trúc thật sự đổi (điểm phải tính lại)
  checked_at TEXT NOT NULL        -- lần kiểm tra gần nhất
);

-- Kết quả AI đọc câu trả lời của một bài nộp (lần gần nhất).
CREATE TABLE ai_reviews (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  answers_hash TEXT NOT NULL,     -- AI chấm lại khi học viên sửa bài
  version TEXT NOT NULL,          -- đổi cách hỏi AI thì chấm lại
  status TEXT NOT NULL,           -- ok | loi
  result_json TEXT,
  model TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id)
);

-- Điểm của từng bài nộp (kể cả chưa nộp: được 0 trên tối đa) cho các bài đã tới hạn.
CREATE TABLE scores (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  earned REAL NOT NULL,
  max REAL NOT NULL,
  on_time_videos INTEGER NOT NULL,
  hours_early REAL,               -- nộp sớm hơn hạn bao nhiêu giờ (chỉ khi có video đúng hạn)
  provisional INTEGER NOT NULL,   -- 1 = có câu chưa được AI chấm, đang dùng quy tắc tạm
  flags_json TEXT NOT NULL,       -- cảnh báo trả lời đối phó (chỉ BTC thấy)
  detail_json TEXT NOT NULL,      -- điểm từng câu, để giải thích
  computed_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id)
);
CREATE INDEX scores_due ON scores(due_at);
