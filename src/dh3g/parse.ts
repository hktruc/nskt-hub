// Đọc phản hồi dh3g và chuyển thành các dòng sẵn sàng ghi vào D1.
// Trường thiếu hoặc sai kiểu thành null; chỉ mã định danh (id) là bắt buộc.

export class ParseError extends Error {}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const int = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function id(v: unknown, what: string): number {
  const n = int(v);
  if (n === null) throw new ParseError(`thiếu hoặc sai mã ${what}`);
  return n;
}

function root(text: string, lists: string[]): Obj {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new ParseError("phản hồi dh3g không phải JSON");
  }
  if (!isObj(doc)) throw new ParseError("phản hồi dh3g không đúng dạng");
  for (const k of lists) {
    if (!Array.isArray(doc[k])) throw new ParseError(`phản hồi dh3g thiếu danh sách "${k}"`);
  }
  return doc;
}

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type TeamRow = { id: number; name: string | null };
export type LearnerRow = {
  id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  cohort: number | null;
  team_id: number | null;
};
export type AssignmentRow = {
  id: number;
  title: string | null;
  type: string | null;
  type_label: string | null;
  due_at: string | null;
  grace_minutes: number | null;
  course_id: number | null;
  course_name: string | null;
};
export type SubmissionRow = {
  learner_id: number;
  assignment_id: number;
  submission_id: number | null;
  status: string | null;
  status_label: string | null;
  raw_status: string | null;
  priority_status: string | null;
  submitted_at: string | null;
  edit_count: number | null;
  last_edited_at: string | null;
  char_count: number | null;
  media_count: number | null;
  feedback_count: number | null;
  edits_json: string;
  answers_json: string;
  feedbacks_json: string;
  answers_hash: string;
  content_hash: string;
};
export type SessionRow = {
  id: number;
  title: string | null;
  start_at: string | null;
  end_at: string | null;
  course_id: number | null;
};
export type AttendanceRow = {
  learner_id: number;
  session_id: number;
  attended: number | null;
  attended_at: string | null;
};

function member(m: unknown, teams: Map<number, TeamRow>): LearnerRow {
  if (!isObj(m)) throw new ParseError("học viên không đúng dạng");
  const teamId = int(m.teamId);
  if (teamId !== null) teams.set(teamId, { id: teamId, name: str(m.teamName) });
  return {
    id: id(m.userId, "học viên"),
    full_name: str(m.fullName),
    phone: str(m.phone),
    email: str(m.email),
    cohort: int(m.cohort),
    team_id: teamId,
  };
}

export type SubmissionsReport = {
  generatedAt: string | null;
  teams: TeamRow[];
  learners: LearnerRow[];
  assignments: AssignmentRow[];
  submissions: SubmissionRow[];
};

export async function parseSubmissions(text: string): Promise<SubmissionsReport> {
  const doc = root(text, ["assignments", "members"]);
  const teams = new Map<number, TeamRow>();
  const learners = new Map<number, LearnerRow>();
  const assignments = new Map<number, AssignmentRow>();
  const submissions = new Map<string, SubmissionRow>();

  for (const a of arr(doc.assignments)) {
    if (!isObj(a)) throw new ParseError("bài tập không đúng dạng");
    const row: AssignmentRow = {
      id: id(a.id, "bài tập"),
      title: str(a.title),
      type: str(a.type),
      type_label: str(a.typeLabel),
      due_at: str(a.dueDate),
      grace_minutes: int(a.gracePeriodMinutes),
      course_id: int(a.courseId),
      course_name: str(a.courseName),
    };
    assignments.set(row.id, row);
  }

  for (const m of arr(doc.members)) {
    const learner = member(m, teams);
    learners.set(learner.id, learner);
    for (const s of arr((m as Obj).submissions)) {
      if (!isObj(s)) throw new ParseError("bài nộp không đúng dạng");
      const assignmentId = id(s.assignmentId, "bài tập của bài nộp");
      const answers = JSON.stringify(arr(s.answers));
      const feedbacks = JSON.stringify(arr(s.feedbacks));
      const edits = JSON.stringify(arr(s.edits));
      const core = {
        submission_id: int(s.submissionId),
        status: str(s.status),
        status_label: str(s.statusLabel),
        raw_status: str(s.rawStatus),
        priority_status: str(s.priorityStatus),
        submitted_at: str(s.submittedAt),
        edit_count: int(s.editCount),
        last_edited_at: str(s.lastEditedAt),
        char_count: int(s.charCount),
        media_count: int(s.mediaCount),
        feedback_count: int(s.feedbackCount),
        edits_json: edits,
        answers_json: answers,
        feedbacks_json: feedbacks,
      };
      submissions.set(`${learner.id}:${assignmentId}`, {
        learner_id: learner.id,
        assignment_id: assignmentId,
        ...core,
        answers_hash: await sha256(answers),
        content_hash: await sha256(JSON.stringify(core)),
      });
    }
  }

  return {
    generatedAt: str(doc.generatedAt),
    teams: [...teams.values()],
    learners: [...learners.values()],
    assignments: [...assignments.values()],
    submissions: [...submissions.values()],
  };
}

export type AttendanceReport = {
  generatedAt: string | null;
  teams: TeamRow[];
  learners: LearnerRow[];
  sessions: SessionRow[];
  attendances: AttendanceRow[];
};

export function parseAttendance(text: string): AttendanceReport {
  const doc = root(text, ["sessions", "members"]);
  const teams = new Map<number, TeamRow>();
  const learners = new Map<number, LearnerRow>();
  const sessions = new Map<number, SessionRow>();
  const attendances = new Map<string, AttendanceRow>();

  for (const s of arr(doc.sessions)) {
    if (!isObj(s)) throw new ParseError("buổi học không đúng dạng");
    const row: SessionRow = {
      id: id(s.id, "buổi học"),
      title: str(s.title),
      start_at: str(s.startTime),
      end_at: str(s.endTime),
      course_id: int(s.courseId),
    };
    sessions.set(row.id, row);
  }

  for (const m of arr(doc.members)) {
    const learner = member(m, teams);
    learners.set(learner.id, learner);
    for (const a of arr((m as Obj).attendances)) {
      if (!isObj(a)) throw new ParseError("điểm danh không đúng dạng");
      const sessionId = id(a.sessionId, "buổi học của điểm danh");
      attendances.set(`${learner.id}:${sessionId}`, {
        learner_id: learner.id,
        session_id: sessionId,
        attended: typeof a.attended === "boolean" ? (a.attended ? 1 : 0) : null,
        attended_at: str(a.attendedAt),
      });
    }
  }

  return {
    generatedAt: str(doc.generatedAt),
    teams: [...teams.values()],
    learners: [...learners.values()],
    sessions: [...sessions.values()],
    attendances: [...attendances.values()],
  };
}

export { sha256 };
