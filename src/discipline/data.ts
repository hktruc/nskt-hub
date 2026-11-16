// Kỷ luật: đọc dữ liệu từ D1 cho `computeDiscipline`, và ghi phần do trưởng nhóm / BTC nhập.

import { COURSE } from "../course";
import { isLearnerTeam, teamCode } from "../domain/teams";
import { nowVN } from "../scoring/run";
import { computeDiscipline, type DisciplineInput, type LearnerResult } from "./engine";

export async function loadDisciplineInput(db: D1Database, now: Date): Promise<DisciplineInput> {
  const start = COURSE.discipline.startDate;
  const [ls, as, ss, ses, at, cam, ex] = await db.batch([
    db.prepare(
      `SELECT l.id, l.full_name, t.name AS team_name, st.stopped_from, st.reason AS stop_reason
       FROM learners l LEFT JOIN teams t ON t.id = l.team_id LEFT JOIN learner_status st ON st.learner_id = l.id`,
    ),
    db.prepare("SELECT id, title, type, due_at FROM assignments WHERE due_at >= ?").bind(start),
    db.prepare("SELECT s.learner_id, s.assignment_id, s.status, s.submitted_at FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.due_at >= ?").bind(start),
    db.prepare("SELECT id, title, start_at, end_at FROM sessions WHERE start_at >= ?").bind(start),
    db.prepare("SELECT x.learner_id, x.session_id, x.attended, x.attended_at FROM attendances x JOIN sessions s ON s.id = x.session_id WHERE s.start_at >= ?").bind(start),
    db.prepare("SELECT session_id, learner_id FROM zoom_camera WHERE camera_off = 1"),
    db.prepare("SELECT learner_id, kind, ref, reason FROM discipline_exemptions"),
  ]);
  type L = { id: number; full_name: string | null; team_name: string | null; stopped_from: string | null; stop_reason: string | null };
  const learners = ((ls?.results ?? []) as L[])
    .map((r) => ({ id: r.id, name: r.full_name ?? `#${r.id}`, team: teamCode(r.team_name), stoppedFrom: r.stopped_from, stopReason: r.stop_reason }))
    .filter((l) => isLearnerTeam(l.team))
    .sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name, "vi"));
  return {
    learners,
    assignments: ((as?.results ?? []) as { id: number; title: string | null; type: string | null; due_at: string }[]).map((a) => ({
      id: a.id,
      title: (a.title ?? `Bài #${a.id}`).trim(),
      type: a.type ?? "NORMAL",
      dueAt: a.due_at,
    })),
    subs: ((ss?.results ?? []) as { learner_id: number; assignment_id: number; status: string | null; submitted_at: string | null }[]).map((s) => ({
      learnerId: s.learner_id,
      assignmentId: s.assignment_id,
      status: s.status,
      submittedAt: s.submitted_at,
    })),
    sessions: ((ses?.results ?? []) as { id: number; title: string | null; start_at: string; end_at: string | null }[]).map((s) => ({
      id: s.id,
      title: (s.title ?? "").trim(),
      startAt: s.start_at,
      endAt: s.end_at,
    })),
    atts: ((at?.results ?? []) as { learner_id: number; session_id: number; attended: number | null; attended_at: string | null }[]).map((a) => ({
      learnerId: a.learner_id,
      sessionId: a.session_id,
      attended: a.attended === 1,
      attendedAt: a.attended_at,
    })),
    cameraOff: new Set(((cam?.results ?? []) as { session_id: number; learner_id: number }[]).map((c) => `${c.session_id}:${c.learner_id}`)),
    exemptions: new Map(((ex?.results ?? []) as { learner_id: number; kind: string; ref: number; reason: string }[]).map((e) => [`${e.learner_id}:${e.kind}:${e.ref}`, e.reason])),
    now: nowVN(now),
  };
}

export async function loadDiscipline(db: D1Database, now: Date): Promise<{ input: DisciplineInput; results: LearnerResult[] }> {
  const input = await loadDisciplineInput(db, now);
  return { input, results: computeDiscipline(input, COURSE.discipline) };
}

// ---------------- Báo cáo của nhóm ----------------

export type TeamReport = { team: string; kind: string; ref: string; content: Record<string, string> | null; by: string; at: string };

export async function loadTeamReports(db: D1Database, kind?: "camera" | "journal"): Promise<TeamReport[]> {
  const rows = (
    await (kind ? db.prepare("SELECT * FROM team_reports WHERE kind = ?").bind(kind) : db.prepare("SELECT * FROM team_reports")).all<{
      team: string;
      kind: string;
      ref: string;
      content_json: string | null;
      by_user: string;
      at: string;
    }>()
  ).results;
  return rows.map((r) => ({ team: r.team, kind: r.kind, ref: r.ref, content: r.content_json ? (JSON.parse(r.content_json) as Record<string, string>) : null, by: r.by_user, at: r.at }));
}

/** Trưởng nhóm / BTC lưu danh sách không bật camera của một nhóm trong một buổi (thay toàn bộ danh sách cũ của nhóm đó). */
export async function saveCamera(db: D1Database, sessionId: number, team: string, memberIds: number[], offIds: number[], by: string, now: Date): Promise<void> {
  const at = now.toISOString();
  const off = new Set(offIds.filter((id) => memberIds.includes(id)));
  await db.batch([
    db.prepare("DELETE FROM zoom_camera WHERE session_id = ? AND learner_id IN (SELECT value FROM json_each(?))").bind(sessionId, JSON.stringify(memberIds)),
    db
      .prepare("INSERT INTO zoom_camera (session_id, learner_id, camera_off, by_user, at) SELECT ?, value, 1, ?, ? FROM json_each(?)")
      .bind(sessionId, by, at, JSON.stringify([...off])),
    db
      .prepare(
        `INSERT INTO team_reports (team, kind, ref, content_json, by_user, at) VALUES (?, 'camera', ?, ?, ?, ?)
         ON CONFLICT (team, kind, ref) DO UPDATE SET content_json = excluded.content_json, by_user = excluded.by_user, at = excluded.at`,
      )
      .bind(team, String(sessionId), JSON.stringify({ off: String(off.size) }), by, at),
  ]);
}

export async function saveJournal(db: D1Database, team: string, week: number, content: Record<string, string>, by: string, now: Date): Promise<void> {
  const clean = Object.fromEntries(
    COURSE.discipline.journalFields.map((f) => [f.key, (content[f.key] ?? "").trim().slice(0, 4000)]),
  );
  await db
    .prepare(
      `INSERT INTO team_reports (team, kind, ref, content_json, by_user, at) VALUES (?, 'journal', ?, ?, ?, ?)
       ON CONFLICT (team, kind, ref) DO UPDATE SET content_json = excluded.content_json, by_user = excluded.by_user, at = excluded.at`,
    )
    .bind(team, String(week), JSON.stringify(clean), by, now.toISOString())
    .run();
}

// ---------------- BTC: duyệt miễn, dừng tham gia ----------------

export type Exemption = { learnerId: number; kind: "bai" | "zoom"; ref: number; reason: string; by: string; at: string };

export async function listExemptions(db: D1Database): Promise<Exemption[]> {
  return (
    await db.prepare("SELECT * FROM discipline_exemptions ORDER BY at DESC").all<{ learner_id: number; kind: "bai" | "zoom"; ref: number; reason: string; by_user: string; at: string }>()
  ).results.map((e) => ({ learnerId: e.learner_id, kind: e.kind, ref: e.ref, reason: e.reason, by: e.by_user, at: e.at }));
}

export async function setExemption(db: D1Database, learnerId: number, kind: "bai" | "zoom", ref: number, reason: string, by: string, now: Date): Promise<void> {
  const r = reason.trim().slice(0, 500);
  if (!r) throw new Error("Cần ghi lý do miễn.");
  await db
    .prepare(
      `INSERT INTO discipline_exemptions (learner_id, kind, ref, reason, by_user, at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (learner_id, kind, ref) DO UPDATE SET reason = excluded.reason, by_user = excluded.by_user, at = excluded.at`,
    )
    .bind(learnerId, kind, ref, r, by, now.toISOString())
    .run();
}

export async function removeExemption(db: D1Database, learnerId: number, kind: "bai" | "zoom", ref: number): Promise<void> {
  await db.prepare("DELETE FROM discipline_exemptions WHERE learner_id = ? AND kind = ? AND ref = ?").bind(learnerId, kind, ref).run();
}

export async function setStopped(db: D1Database, learnerId: number, from: string | null, reason: string, by: string, now: Date): Promise<void> {
  if (!from) {
    await db.prepare("DELETE FROM learner_status WHERE learner_id = ?").bind(learnerId).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO learner_status (learner_id, stopped_from, reason, by_user, at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (learner_id) DO UPDATE SET stopped_from = excluded.stopped_from, reason = excluded.reason, by_user = excluded.by_user, at = excluded.at`,
    )
    .bind(learnerId, from, reason.trim().slice(0, 500) || null, by, now.toISOString())
    .run();
}
