// Dữ liệu cho bàn chấm: danh sách bài tuần, hàng chờ chấm, phiếu chấm một học viên, lưu kết quả.

import { findMedia, isVideo, parseAnswers, type Answer, type MediaKind } from "../domain/media";
import { isLearnerTeam, teamCode } from "../domain/teams";
import { SCORING } from "../scoring/config";
import type { AssignmentSpec } from "../scoring/spec";
import type { User } from "../users/accounts";
import { DEFAULT_FOCUS, GRADING, qualityOf, weekScore, type ItemScore, type Quality } from "./rubric";

export type GradeItem = { key: string; kind: "video" | "so-do"; url: string; media: MediaKind; qIndex: number; question: string };

/** Tách bài nộp thành các thẻ chấm riêng: mỗi video, mỗi sơ đồ (ảnh / PDF). Câu góp ý BTC bỏ qua. */
export function extractItems(answers: Answer[], spec: AssignmentSpec | null): GradeItem[] {
  const out: GradeItem[] = [];
  answers.forEach((a, i) => {
    const qkind = spec?.questions[i]?.kind;
    if (qkind === "gop-y") return;
    for (const m of findMedia(a.answer)) {
      let kind: GradeItem["kind"] | null = null;
      if (isVideo(m.kind)) kind = "video";
      else if (m.kind === "image" || m.kind === "file") kind = "so-do";
      else if (m.kind === "drive") kind = qkind === "video" ? "video" : "so-do";
      if (kind) out.push({ key: `${i}:${m.url}`, kind, url: m.url, media: m.kind, qIndex: i, question: a.question ?? "" });
    }
  });
  return out;
}

export type WeekAssignment = { id: number; title: string | null; type: string | null; due_at: string };

export async function gradableAssignments(db: D1Database, nowVN: string): Promise<WeekAssignment[]> {
  return (
    await db
      .prepare("SELECT id, title, type, due_at FROM assignments WHERE type = 'WEEK' AND due_at >= ? AND due_at <= ? ORDER BY due_at DESC")
      .bind(SCORING.startDate, nowVN)
      .all<WeekAssignment>()
  ).results;
}

export async function focusOf(db: D1Database, assignmentId: number): Promise<string> {
  return (await db.prepare("SELECT focus FROM assignment_focus WHERE assignment_id = ?").bind(assignmentId).first<{ focus: string }>())?.focus ?? DEFAULT_FOCUS;
}

export function allowedTeams(u: User): string[] | null {
  return u.role === "phung_su" ? u.teams : null; // null = mọi đội
}

export type QueueStatus = "chua-nop" | "chua-cham" | "dang-cham" | "da-cham" | "sua-sau-cham";
export type QueueLine = {
  learnerId: number;
  name: string;
  team: string;
  status: QueueStatus;
  items: number;
  itemsDone: number;
  score: number | null;
  quality: Quality | null;
  spirit: string | null;
  grader: string | null;
  overdue: boolean;
};

const addDaysIso = (iso: string, d: number) => new Date(Date.parse(`${iso.slice(0, 19)}Z`) + d * 86_400_000).toISOString().slice(0, 19);

export async function loadQueue(db: D1Database, a: WeekAssignment, teams: string[] | null, nowVN: string): Promise<QueueLine[]> {
  const [subs, reviews, items, spec] = await db.batch([
    db
      .prepare(
        `SELECT s.learner_id, l.full_name, t.name AS team_name, s.status, s.answers_json, s.answers_hash
         FROM submissions s JOIN learners l ON l.id = s.learner_id LEFT JOIN teams t ON t.id = l.team_id
         WHERE s.assignment_id = ?`,
      )
      .bind(a.id),
    db.prepare("SELECT learner_id, score, spirit, grader_label, answers_hash FROM week_reviews WHERE assignment_id = ?").bind(a.id),
    db.prepare("SELECT learner_id, COUNT(*) AS n FROM item_reviews WHERE assignment_id = ? GROUP BY learner_id").bind(a.id),
    db.prepare("SELECT spec_json FROM assignment_specs WHERE assignment_id = ?").bind(a.id),
  ]);
  const specJson = (spec?.results[0] as { spec_json?: string } | undefined)?.spec_json;
  const sp = specJson ? (JSON.parse(specJson) as AssignmentSpec) : null;
  const rv = new Map(((reviews?.results ?? []) as { learner_id: number; score: number | null; spirit: string | null; grader_label: string; answers_hash: string | null }[]).map((r) => [r.learner_id, r]));
  const ic = new Map(((items?.results ?? []) as { learner_id: number; n: number }[]).map((r) => [r.learner_id, r.n]));
  const overdueAt = addDaysIso(a.due_at, GRADING.dueDays);
  const lines: QueueLine[] = [];
  for (const s of (subs?.results ?? []) as { learner_id: number; full_name: string | null; team_name: string | null; status: string | null; answers_json: string | null; answers_hash: string | null }[]) {
    const team = teamCode(s.team_name);
    if (!isLearnerTeam(team) || (teams && !teams.includes(team))) continue;
    const submitted = s.status === "DONE" || s.status === "OVERDUE" || s.status === "LATE";
    const r = rv.get(s.learner_id);
    const total = submitted ? extractItems(parseAnswers(s.answers_json), sp).length : 0;
    const status: QueueStatus = !submitted ? "chua-nop" : r ? (r.answers_hash && s.answers_hash && r.answers_hash !== s.answers_hash ? "sua-sau-cham" : "da-cham") : ic.get(s.learner_id) ? "dang-cham" : "chua-cham";
    lines.push({
      learnerId: s.learner_id,
      name: s.full_name ?? `#${s.learner_id}`,
      team,
      status,
      items: total,
      itemsDone: ic.get(s.learner_id) ?? 0,
      score: r?.score ?? null,
      quality: r ? qualityOf(r.score, r.spirit) : null,
      spirit: r?.spirit ?? null,
      grader: r?.grader_label ?? null,
      overdue: (status === "chua-cham" || status === "dang-cham") && nowVN > overdueAt,
    });
  }
  return lines.sort((x, y) => x.team.localeCompare(y.team) || x.name.localeCompare(y.name, "vi"));
}

export type SheetData = {
  assignment: WeekAssignment;
  learner: { id: number; name: string; team: string };
  status: string | null;
  submittedAt: string | null;
  answersHash: string | null;
  answers: Answer[];
  spec: AssignmentSpec | null;
  items: GradeItem[];
  itemReviews: Map<string, ItemScore>;
  review: { b1: number | null; b2: number | null; spirit: string | null; progress: string | null; comment: string | null; featured_key: string | null; score: number | null; grader_label: string; updated_at: string; answers_hash: string | null } | null;
  previous: { title: string | null; score: number | null; spirit: string | null; progress: string | null; comment: string | null } | null;
  focus: string;
  ai: { index: number; kind: string; earned: number; max: number; source: string; note?: string }[];
};

export async function loadSheet(db: D1Database, learnerId: number, assignmentId: number): Promise<SheetData | null> {
  const row = await db
    .prepare(
      `SELECT a.id, a.title, a.type, a.due_at, l.full_name, t.name AS team_name, s.status, s.submitted_at, s.answers_json, s.answers_hash,
              sp.spec_json, sc.detail_json
       FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN learners l ON l.id = s.learner_id
       LEFT JOIN teams t ON t.id = l.team_id LEFT JOIN assignment_specs sp ON sp.assignment_id = a.id
       LEFT JOIN scores sc ON sc.learner_id = s.learner_id AND sc.assignment_id = s.assignment_id
       WHERE s.learner_id = ? AND s.assignment_id = ? AND a.type = 'WEEK'`,
    )
    .bind(learnerId, assignmentId)
    .first<{ id: number; title: string | null; type: string | null; due_at: string; full_name: string | null; team_name: string | null; status: string | null; submitted_at: string | null; answers_json: string | null; answers_hash: string | null; spec_json: string | null; detail_json: string | null }>();
  if (!row) return null;
  const spec = row.spec_json ? (JSON.parse(row.spec_json) as AssignmentSpec) : null;
  const answers = parseAnswers(row.answers_json);
  const [irs, rv, prev] = await db.batch([
    db.prepare("SELECT item_key, kind, a1, a2, a3, a4, a5, flag FROM item_reviews WHERE learner_id = ? AND assignment_id = ?").bind(learnerId, assignmentId),
    db.prepare("SELECT * FROM week_reviews WHERE learner_id = ? AND assignment_id = ?").bind(learnerId, assignmentId),
    db
      .prepare(
        `SELECT a.title, w.score, w.spirit, w.progress, w.comment FROM week_reviews w JOIN assignments a ON a.id = w.assignment_id
         WHERE w.learner_id = ? AND a.type = 'WEEK' AND a.due_at < ? ORDER BY a.due_at DESC LIMIT 1`,
      )
      .bind(learnerId, row.due_at),
  ]);
  return {
    assignment: { id: row.id, title: row.title, type: row.type, due_at: row.due_at },
    learner: { id: learnerId, name: row.full_name ?? `#${learnerId}`, team: teamCode(row.team_name) },
    status: row.status,
    submittedAt: row.submitted_at,
    answersHash: row.answers_hash,
    answers,
    spec,
    items: extractItems(answers, spec),
    itemReviews: new Map(((irs?.results ?? []) as (ItemScore & { item_key: string })[]).map((r) => [r.item_key, r])),
    review: ((rv?.results[0] as SheetData["review"]) ?? null),
    previous: ((prev?.results[0] as SheetData["previous"]) ?? null),
    focus: await focusOf(db, assignmentId),
    ai: row.detail_json ? (JSON.parse(row.detail_json) as SheetData["ai"]) : [],
  };
}

export type SaveInput = {
  items: { key: string; kind: "video" | "so-do"; a1?: number | null; a2?: number | null; a3?: number | null; a4?: number | null; a5?: number | null; flag?: string | null }[];
  b1: number | null;
  b2: number | null;
  spirit: string | null;
  progress: string | null;
  comment: string;
  featured: string | null;
};

/** Kiểm tra phiếu chấm; trả về câu báo lỗi dễ hiểu, hoặc null nếu hợp lệ. */
export function validate(input: SaveInput): string | null {
  for (const [n, it] of input.items.entries()) {
    if (it.flag) continue;
    const need = it.kind === "video" ? [it.a1, it.a2, it.a3, it.a4] : [it.a5];
    if (need.some((x) => !x)) return `Thẻ ${n + 1} (${it.kind === "video" ? "video" : "sơ đồ"}) chưa chấm đủ sao, hoặc đánh dấu nếu không chấm được.`;
  }
  if (!input.b1 || !input.b2) return "Chưa chấm phần chung: B1 và B2.";
  if (!input.spirit) return "Chưa chọn Tinh thần học (B3).";
  if (!input.progress) return "Chưa chọn So với tuần trước (B4).";
  const low = input.items.some((i) => !i.flag && [i.a1, i.a2, i.a3, i.a4, i.a5].some((x) => typeof x === "number" && x <= 2)) || input.b1 <= 2 || input.b2 <= 2;
  if ((low || input.spirit === "doi-pho") && input.comment.trim().length < 10) {
    return "Có tiêu chí từ 2 sao trở xuống hoặc chọn \"Đối phó\": cần viết nhận xét cụ thể (ít nhất 10 ký tự).";
  }
  return null;
}

export async function saveReview(db: D1Database, sheet: SheetData, input: SaveInput, u: User, label: string, now: Date): Promise<number | null> {
  const iso = now.toISOString();
  const score = weekScore(input.items, input.b1, input.b2);
  const stars = (x: number | null | undefined) => (x && x >= 1 && x <= 5 ? x : null);
  const graderId = u.id;
  const keys = new Set(sheet.items.map((i) => i.key));
  await db.batch([
    db.prepare("DELETE FROM item_reviews WHERE learner_id = ? AND assignment_id = ?").bind(sheet.learner.id, sheet.assignment.id),
    ...input.items
      .filter((i) => keys.has(i.key))
      .map((i) =>
        db
          .prepare("INSERT INTO item_reviews (learner_id, assignment_id, item_key, kind, a1, a2, a3, a4, a5, flag, grader_id, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
          .bind(sheet.learner.id, sheet.assignment.id, i.key, i.kind, ...(i.flag ? [null, null, null, null, null] : [stars(i.a1), stars(i.a2), stars(i.a3), stars(i.a4), stars(i.a5)]), i.flag ?? null, graderId, iso),
      ),
    db
      .prepare(
        `INSERT INTO week_reviews (learner_id, assignment_id, b1, b2, spirit, progress, comment, featured_key, score, items_total, answers_hash, grader_id, grader_label, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(learner_id, assignment_id) DO UPDATE SET b1=excluded.b1, b2=excluded.b2, spirit=excluded.spirit, progress=excluded.progress,
           comment=excluded.comment, featured_key=excluded.featured_key, score=excluded.score, items_total=excluded.items_total,
           answers_hash=excluded.answers_hash, grader_id=excluded.grader_id, grader_label=excluded.grader_label, updated_at=excluded.updated_at`,
      )
      .bind(
        sheet.learner.id, sheet.assignment.id, stars(input.b1), stars(input.b2), input.spirit, input.progress, input.comment.trim() || null,
        input.featured && keys.has(input.featured) ? input.featured : null, score, sheet.items.length, sheet.answersHash, graderId, label, iso, iso,
      ),
  ]);
  return score;
}

export async function setFocus(db: D1Database, assignmentId: number, focus: string, by: string, now: Date) {
  await db
    .prepare("INSERT INTO assignment_focus (assignment_id, focus, set_by, set_at) VALUES (?,?,?,?) ON CONFLICT(assignment_id) DO UPDATE SET focus=excluded.focus, set_by=excluded.set_by, set_at=excluded.set_at")
    .bind(assignmentId, focus, by, now.toISOString())
    .run();
}
