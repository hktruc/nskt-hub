-- Câu hỏi học viên gửi BTC (lấy từ các câu góp ý không bắt buộc của bài tập tuần), AI biên tập thành FAQ,
-- và các câu trả lời BTC đăng công khai.

-- Một lần AI biên tập. scope: 'all' (từ đầu khóa) hoặc 'week' (ref = mã bài tập tuần).
-- status: pending (chờ cron chạy) | running | done | failed.
CREATE TABLE faq_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  ref INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  item_count INTEGER,
  items_hash TEXT,          -- để biết đã có câu hỏi mới so với lần biên tập này chưa
  requested_by TEXT,
  requested_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  model TEXT,
  error TEXT
);
CREATE INDEX faq_runs_scope ON faq_runs(scope, ref, id);

-- Các câu hỏi đã gộp của một lần biên tập. item_keys_json: ["mãHọcViên:mãBài:sốCâu", …] trỏ về câu gốc.
CREATE TABLE faq_groups (
  run_id INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  question TEXT NOT NULL,
  summary TEXT,
  topic TEXT,
  urgency TEXT NOT NULL,    -- cap-bach | quan-trong | thuong | chua-xep
  item_keys_json TEXT NOT NULL,
  PRIMARY KEY (run_id, idx)
);

-- Câu trả lời BTC soạn, đăng ở cuối bảng xếp hạng công khai khi published = 1.
CREATE TABLE faq_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT
);
