import { describe, expect, it } from "vitest";
import { AI_CONCURRENCY, aiTick } from "../src/scoring/run";
import { buildWeeklySpec } from "../src/scoring/spec";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

const NOW = new Date("2026-11-11T00:20:00Z");
const Q = "Viết nhật ký đúc kết của bạn?";

function seed(n: number) {
  const { d1, raw } = createTestDb();
  const t = NOW.toISOString();
  raw.exec(`INSERT INTO assignments (id, title, type, due_at, first_seen_at, last_seen_at) VALUES (9,'Tuần','WEEK','2026-11-05T23:00:00','${t}','${t}')`);
  raw.prepare("INSERT INTO assignment_specs VALUES (9, 'h', ?, ?, ?)").run(JSON.stringify(buildWeeklySpec([Q], [])), t, t);
  const ins = raw.prepare(`INSERT INTO submissions (learner_id, assignment_id, submission_id, status, submitted_at, answers_json, answers_hash, content_hash, first_seen_at, changed_at, last_seen_at)
    VALUES (?, 9, ?, 'DONE', ?, ?, ?, 'c', ?, ?, ?)`);
  for (let i = 1; i <= n; i++) ins.run(i, 100 + i, `2026-11-05T1${i % 10}:00:00`, JSON.stringify([{ question: Q, type: "Tự luận", answer: `Em học được điều số ${i}` }]), `h${i}`, t, t, t);
  return { env: testEnv(d1, { OPENAI_API_KEY: "KHOA-GIA", OPENAI_MODEL: "gpt-5-nano" }), raw };
}

const ok = (async (_u: RequestInfo | URL, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  const idx = Number(String(body.messages[1].content).match(/### Mục (\d+)/)![1]);
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ items: [{ index: idx, ok: true, nonsense: false, note: "" }] }) } }] }));
}) as typeof fetch;

describe("AI chấm theo nhóm song song", () => {
  it("chấm hết các bài trong một lượt khi dưới giới hạn", async () => {
    const { env, raw } = seed(7);
    expect(await aiTick(env, NOW, ok)).toEqual({ status: "ran", reviewed: 7, failed: 0 });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM ai_reviews WHERE status='ok'").get()).toEqual({ n: 7 });
  });

  it("khóa bị từ chối: dừng sau nhóm đầu, không gọi dồn", async () => {
    const { env } = seed(12);
    let calls = 0;
    const denied = (async () => {
      calls++;
      return new Response("{}", { status: 401 });
    }) as typeof fetch;
    const r = await aiTick(env, NOW, denied);
    expect(calls).toBe(AI_CONCURRENCY);
    expect(r).toEqual({ status: "ran", reviewed: 0, failed: AI_CONCURRENCY });
  });
});
