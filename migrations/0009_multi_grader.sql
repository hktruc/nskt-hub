-- Chấm nhiều người (chủ dự án chốt 13/11/2026):
-- 1) Giao đội theo tuần, luân phiên: mỗi dòng là "từ tuần này trở đi, người này chấm các đội này". Tuần không giao lại thì giữ như tuần trước.
-- 2) Mỗi người chấm giữ bản chấm riêng; một học viên có thể được nhiều người chấm. Điểm chính thức = trung bình các bản.
-- Bảng cũ (grader_teams, week_reviews, item_reviews) giữ nguyên làm bản lưu, không dùng nữa.

CREATE TABLE grader_team_plans (
  user_id INTEGER NOT NULL,
  from_week TEXT NOT NULL,          -- thứ Hai của tuần bắt đầu áp dụng (YYYY-MM-DD)
  teams_json TEXT NOT NULL,         -- ["T01","T03"]
  set_by TEXT,
  set_at TEXT NOT NULL,
  PRIMARY KEY (user_id, from_week)
);
INSERT OR IGNORE INTO grader_team_plans (user_id, from_week, teams_json, set_by, set_at)
  SELECT user_id, '2026-09-28', json_group_array(team_code), 'chuyển từ cách giao cũ', MAX(assigned_at) FROM grader_teams GROUP BY user_id;

CREATE TABLE reviews_week (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  grader_id INTEGER NOT NULL,
  grader_label TEXT NOT NULL,
  grader_role TEXT,
  b1 INTEGER, b2 INTEGER, spirit TEXT, progress TEXT, comment TEXT, featured_key TEXT,
  score REAL, items_total INTEGER, answers_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id, grader_id)
);
CREATE INDEX reviews_week_assignment ON reviews_week(assignment_id);
CREATE INDEX reviews_week_grader ON reviews_week(grader_id);
INSERT OR IGNORE INTO reviews_week
  SELECT learner_id, assignment_id, grader_id, grader_label, NULL, b1, b2, spirit, progress, comment, featured_key, score, items_total, answers_hash, created_at, updated_at FROM week_reviews;

CREATE TABLE reviews_item (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  grader_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  a1 INTEGER, a2 INTEGER, a3 INTEGER, a4 INTEGER, a5 INTEGER, flag TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id, grader_id, item_key)
);
INSERT OR IGNORE INTO reviews_item
  SELECT learner_id, assignment_id, grader_id, item_key, kind, a1, a2, a3, a4, a5, flag, updated_at FROM item_reviews;
