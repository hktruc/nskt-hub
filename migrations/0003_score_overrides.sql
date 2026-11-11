-- Đợt 3a: BTC / coach sửa tay điểm từng câu. Điểm sửa tay được ưu tiên hơn AI và quy tắc.
CREATE TABLE score_overrides (
  learner_id INTEGER NOT NULL,
  assignment_id INTEGER NOT NULL,
  question_index INTEGER NOT NULL,
  earned REAL NOT NULL,
  note TEXT,
  by_email TEXT NOT NULL,
  at TEXT NOT NULL,
  PRIMARY KEY (learner_id, assignment_id, question_index)
);
