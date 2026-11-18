// Lưu và đọc các lần AI biên tập FAQ, chạy hàng đợi biên tập trong cron, và các câu trả lời BTC đăng công khai.

import type { AiConfig } from "../ai/openai";
import { COURSE, featureOn } from "../course";
import type { Env } from "../env";
import { collectFaqItems, itemsHash, type FaqItem } from "./collect";
import { groupFaq } from "./ai";

export type FaqScope = { scope: "all" } | { scope: "week"; ref: number };
export type FaqRun = { id: number; scope: string; ref: number | null; status: string; itemCount: number | null; itemsHash: string | null; requestedBy: string | null; requestedAt: string; finishedAt: string | null; error: string | null };
export type FaqGroup = { idx: number; question: string; summary: string; topic: string; urgency: string; keys: string[] };

const STALE_MS = 20 * 60_000; // lần chạy treo quá 20 phút coi như hỏng
const AUTO_EVERY_MS = 20 * 3_600_000; // tự biên tập lại tối đa ~1 lần / ngày khi có câu mới

export const sourceLabel = (k: string) => COURSE.faq.sources.find((s) => s.key === k)?.label ?? k;

function faqAiConfig(env: Env, fetchImpl?: typeof fetch): AiConfig | null {
  if (!env.OPENAI_API_KEY || !featureOn("faq")) return null;
  return { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || "gpt-5-nano", reasoningEffort: env.OPENAI_REASONING_EFFORT || undefined, baseUrl: env.OPENAI_BASE_URL || undefined, fetchImpl };
}

type RunRow = { id: number; scope: string; ref: number | null; status: string; item_count: number | null; items_hash: string | null; requested_by: string | null; requested_at: string; finished_at: string | null; error: string | null };
const toRun = (r: RunRow): FaqRun => ({ id: r.id, scope: r.scope, ref: r.ref, status: r.status, itemCount: r.item_count, itemsHash: r.items_hash, requestedBy: r.requested_by, requestedAt: r.requested_at, finishedAt: r.finished_at, error: r.error });
const refOf = (s: FaqScope) => (s.scope === "week" ? s.ref : null);

/** Xếp một lần biên tập vào hàng đợi (bỏ qua nếu phạm vi này đang chờ / đang chạy). */
export async function requestRun(db: D1Database, s: FaqScope, by: string, now: Date): Promise<boolean> {
  const busy = await db
    .prepare("SELECT 1 FROM faq_runs WHERE scope = ? AND ref IS ? AND status IN ('pending','running')")
    .bind(s.scope, refOf(s))
    .first();
  if (busy) return false;
  await db.prepare("INSERT INTO faq_runs (scope, ref, status, requested_by, requested_at) VALUES (?, ?, 'pending', ?, ?)").bind(s.scope, refOf(s), by, now.toISOString()).run();
  return true;
}

export type FaqView = { run: FaqRun | null; groups: FaqGroup[]; busy: FaqRun | null; lastFailed: FaqRun | null; items: FaqItem[]; changed: boolean };

/** Lần biên tập xong gần nhất của một phạm vi, kèm câu gốc hiện có (để tra ngược) và cờ "đã có câu mới". */
export async function loadFaqView(db: D1Database, s: FaqScope): Promise<FaqView> {
  const runs = (
    await db
      .prepare("SELECT * FROM faq_runs WHERE scope = ? AND ref IS ? ORDER BY id DESC LIMIT 10")
      .bind(s.scope, refOf(s))
      .all<RunRow>()
  ).results.map(toRun);
  const run = runs.find((r) => r.status === "done") ?? null;
  const busy = runs.find((r) => r.status === "pending" || r.status === "running") ?? null;
  const lastFailed = runs[0]?.status === "failed" ? runs[0] : null;
  const groups = run
    ? (
        await db.prepare("SELECT * FROM faq_groups WHERE run_id = ? ORDER BY idx").bind(run.id).all<{ idx: number; question: string; summary: string | null; topic: string | null; urgency: string; item_keys_json: string }>()
      ).results.map((g) => ({ idx: g.idx, question: g.question, summary: g.summary ?? "", topic: g.topic ?? "", urgency: g.urgency, keys: JSON.parse(g.item_keys_json) as string[] }))
    : [];
  const items = await collectFaqItems(db, s.scope === "week" ? { assignmentId: s.ref } : {});
  const changed = run ? run.itemsHash !== (await itemsHash(items)) : items.length > 0;
  return { run, groups, busy, lastFailed, items, changed };
}

/** Cron: tự xếp lần biên tập khi có câu mới (tối đa ~1 lần/ngày mỗi phạm vi), rồi chạy một lần đang chờ. */
export async function faqTick(env: Env, now: Date, opts: { auto?: boolean; fetchImpl?: typeof fetch } = {}): Promise<{ status: string; runId?: number; groups?: number; error?: string }> {
  const cfg = faqAiConfig(env, opts.fetchImpl);
  if (!cfg) return { status: "no-key" };
  const db = env.DB;
  await db
    .prepare("UPDATE faq_runs SET status = 'failed', error = 'quá thời gian, thử lại', finished_at = ? WHERE status = 'running' AND started_at < ?")
    .bind(now.toISOString(), new Date(now.getTime() - STALE_MS).toISOString())
    .run();

  // Tự động: phạm vi "từ đầu khóa" và bài tuần mới nhất đã có câu trả lời.
  const latestWeek = await db
    .prepare("SELECT a.id FROM assignments a WHERE a.type = 'WEEK' AND EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.answers_json IS NOT NULL) ORDER BY a.due_at DESC LIMIT 1")
    .first<{ id: number }>();
  const autoScopes: FaqScope[] = [{ scope: "all" }, ...(latestWeek ? [{ scope: "week" as const, ref: latestWeek.id }] : [])];
  for (const s of opts.auto ? autoScopes : []) {
    const last = await db.prepare("SELECT * FROM faq_runs WHERE scope = ? AND ref IS ? ORDER BY id DESC LIMIT 1").bind(s.scope, refOf(s)).first<RunRow>();
    if (last && (last.status === "pending" || last.status === "running")) continue;
    if (last && now.getTime() - Date.parse(last.requested_at) < AUTO_EVERY_MS) continue;
    const items = await collectFaqItems(db, s.scope === "week" ? { assignmentId: s.ref } : {});
    if (!items.length) continue;
    const lastDone = await db.prepare("SELECT items_hash FROM faq_runs WHERE scope = ? AND ref IS ? AND status = 'done' ORDER BY id DESC LIMIT 1").bind(s.scope, refOf(s)).first<{ items_hash: string }>();
    if (lastDone?.items_hash === (await itemsHash(items))) continue;
    await requestRun(db, s, "tự động", now);
  }

  const job = await db
    .prepare("UPDATE faq_runs SET status = 'running', started_at = ? WHERE id = (SELECT id FROM faq_runs WHERE status = 'pending' ORDER BY id LIMIT 1) RETURNING *")
    .bind(now.toISOString())
    .first<RunRow>();
  if (!job) return { status: "idle" };
  const items = await collectFaqItems(db, job.scope === "week" && job.ref ? { assignmentId: job.ref } : {});
  const hash = await itemsHash(items);
  const res = await groupFaq(cfg, items, sourceLabel);
  if (!res.ok) {
    await db.prepare("UPDATE faq_runs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").bind(res.error, new Date().toISOString(), job.id).run();
    return { status: "failed", runId: job.id, error: res.error };
  }
  // Câu AI không xếp vào nhóm nào: gom vào một nhóm cuối để BTC vẫn đọc được.
  const used = new Set(res.groups.flatMap((g) => g.ids));
  const rest = items.map((_, i) => i + 1).filter((id) => !used.has(id));
  const all = [
    ...res.groups.map((g) => ({ ...g })),
    ...(rest.length ? [{ question: "Các câu AI chưa xếp nhóm (thường là cảm ơn, khen chung, không có câu hỏi cụ thể)", summary: "", topic: "", urgency: "chua-xep", ids: rest }] : []),
  ];
  const keysOf = (ids: number[]) => JSON.stringify(ids.map((id) => items[id - 1]!.key));
  await db.batch([
    db.prepare("DELETE FROM faq_groups WHERE run_id = ?").bind(job.id),
    ...all.map((g, idx) =>
      db.prepare("INSERT INTO faq_groups (run_id, idx, question, summary, topic, urgency, item_keys_json) VALUES (?,?,?,?,?,?,?)").bind(job.id, idx, g.question, g.summary, g.topic, g.urgency, keysOf(g.ids)),
    ),
    db.prepare("UPDATE faq_runs SET status = 'done', item_count = ?, items_hash = ?, model = ?, finished_at = ?, error = NULL WHERE id = ?").bind(items.length, hash, cfg.model, new Date().toISOString(), job.id),
  ]);
  return { status: "done", runId: job.id, groups: all.length };
}

// ---------------- Câu trả lời đăng công khai ----------------

export type FaqPost = { id: number; question: string; answer: string; published: boolean; sortOrder: number; createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string | null };
type PostRow = { id: number; question: string; answer: string; published: number; sort_order: number; created_by: string; created_at: string; updated_by: string | null; updated_at: string | null };
const toPost = (r: PostRow): FaqPost => ({ id: r.id, question: r.question, answer: r.answer, published: r.published === 1, sortOrder: r.sort_order, createdBy: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by, updatedAt: r.updated_at });

export async function listPosts(db: D1Database, publishedOnly: boolean): Promise<FaqPost[]> {
  return (
    await db.prepare(`SELECT * FROM faq_posts ${publishedOnly ? "WHERE published = 1" : ""} ORDER BY sort_order, id DESC`).all<PostRow>()
  ).results.map(toPost);
}

export async function getPost(db: D1Database, id: number): Promise<FaqPost | null> {
  const r = await db.prepare("SELECT * FROM faq_posts WHERE id = ?").bind(id).first<PostRow>();
  return r ? toPost(r) : null;
}

export class FaqError extends Error {}

export async function savePost(db: D1Database, input: { id?: number; question: string; answer: string; published: boolean; sortOrder: number }, by: string, now: Date): Promise<number> {
  const q = input.question.trim().slice(0, 500);
  const a = input.answer.trim().slice(0, 8000);
  if (!q) throw new FaqError("Cần nhập câu hỏi.");
  if (!a) throw new FaqError("Cần nhập câu trả lời.");
  const order = Number.isFinite(input.sortOrder) ? Math.trunc(input.sortOrder) : 0;
  if (input.id) {
    await db
      .prepare("UPDATE faq_posts SET question = ?, answer = ?, published = ?, sort_order = ?, updated_by = ?, updated_at = ? WHERE id = ?")
      .bind(q, a, input.published ? 1 : 0, order, by, now.toISOString(), input.id)
      .run();
    return input.id;
  }
  const r = await db
    .prepare("INSERT INTO faq_posts (question, answer, published, sort_order, created_by, created_at) VALUES (?,?,?,?,?,?) RETURNING id")
    .bind(q, a, input.published ? 1 : 0, order, by, now.toISOString())
    .first<{ id: number }>();
  return r!.id;
}

export async function deletePost(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM faq_posts WHERE id = ?").bind(id).run();
}
