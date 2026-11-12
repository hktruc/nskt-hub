import { describe, expect, it } from "vitest";
import { planDaily, workQueue, enqueueRange } from "../src/sync/queue";
import { createTestDb } from "./helpers/d1";
import { FAKE_KEY, attendanceReport, fakeDh3g, json, submissionsReport, testEnv } from "./helpers/fixtures";

const NOW = new Date("2026-11-11T00:15:00Z"); // thứ Tư, 07:15 giờ VN

function setup() {
  const { d1, raw } = createTestDb();
  const one = (sql: string) => raw.prepare(sql).get() as Record<string, unknown>;
  return { env: testEnv(d1), raw, one };
}

const ok = (url: URL) => (url.pathname.endsWith("cohort-attendance") ? json(attendanceReport()) : json(submissionsReport()));

describe("lên kế hoạch", () => {
  it("lần đầu tải toàn bộ từ ngày bắt đầu; lần sau chỉ 14 ngày gần đây", async () => {
    const { env, one } = setup();
    const first = await planDaily(env, NOW);
    expect(first.full).toBe(true);
    // 23/09 → 18/11 là 57 ngày: 57 khoảng bài nộp + 9 khoảng điểm danh.
    expect(first.added).toBe(57 + 9);
    expect(one("SELECT MIN(from_date) AS a, MAX(to_date) AS b FROM sync_jobs")).toEqual({ a: "2026-09-23", b: "2026-11-18" });

    await env.DB.prepare("UPDATE sync_jobs SET status='done'").run();
    const next = await planDaily(env, new Date("2026-11-12T00:15:00Z"));
    expect(next.full).toBe(false);
    expect(next.added).toBe(22 + 4);
  });

  it("thứ Hai tải lại toàn bộ; khoảng đang chờ không bị xếp trùng", async () => {
    const { env } = setup();
    await planDaily(env, NOW);
    expect((await planDaily(env, NOW)).added).toBe(0);
    await env.DB.prepare("UPDATE sync_jobs SET status='done'").run();
    expect((await planDaily(env, new Date("2026-11-16T00:15:00Z"))).full).toBe(true);
  });
});

describe("xử lý hàng đợi", () => {
  it("không có khóa thì không gọi dh3g và không đụng hàng đợi", async () => {
    const { env, one } = setup();
    await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", NOW);
    const dh3g = fakeDh3g(ok);
    const r = await workQueue({ ...env, DH3G_API_KEY: undefined }, NOW, dh3g.fetchImpl);
    expect(r.status).toBe("no-key");
    expect(dh3g.calls).toHaveLength(0);
    expect(one("SELECT COUNT(*) AS n FROM sync_jobs WHERE status='pending'").n).toBe(2);
  });

  it("lấy bài nộp và điểm danh, ghi đủ các bảng, gửi khóa đúng chỗ", async () => {
    const { env, one, raw } = setup();
    await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", NOW);
    const dh3g = fakeDh3g(ok);
    const r = await workQueue(env, NOW, dh3g.fetchImpl);
    expect(r).toEqual({ status: "ran", done: 2, failed: 0 });

    const sub = dh3g.calls.find((c) => c.url.pathname.endsWith("cohort-submissions"))!;
    expect(sub.key).toBe(FAKE_KEY);
    expect(Object.fromEntries(sub.url.searchParams)).toEqual({ communityId: "44", fromDate: "2026-11-07", toDate: "2026-11-07", includeAnswers: "true" });
    expect(sub.url.href).not.toContain(FAKE_KEY);

    expect(one("SELECT COUNT(*) AS n FROM learners").n).toBe(2);
    expect(one("SELECT team_id, cohort FROM learners WHERE id=1002")).toEqual({ team_id: null, cohort: null });
    expect(one("SELECT answers_json FROM submissions WHERE learner_id=1002").answers_json).toBe("[]");
    expect(one("SELECT name FROM teams WHERE id=7").name).toBe("Đội Thử 1");
    expect(one("SELECT title, type FROM assignments WHERE id=501")).toEqual({ title: "Bài thử 1", type: "NORMAL" });
    expect(one("SELECT COUNT(*) AS n FROM submissions").n).toBe(2);
    const a = one("SELECT status, submission_id, answers_json, feedbacks_json FROM submissions WHERE learner_id=1001");
    expect(a.status).toBe("DONE");
    expect(JSON.parse(a.answers_json as string)[0].answer).toBe("Trả lời thử");
    expect(JSON.parse(a.feedbacks_json as string)[0].grade).toBe(80);
    expect(one("SELECT status, submission_id, submitted_at FROM submissions WHERE learner_id=1002")).toEqual({ status: "NOT_SUBMITTED", submission_id: null, submitted_at: null });
    expect(one("SELECT attended FROM attendances WHERE learner_id=1001").attended).toBe(1);
    expect(one("SELECT attended FROM attendances WHERE learner_id=1002").attended).toBe(0);
    expect(one("SELECT COUNT(*) AS n FROM sync_jobs WHERE status='done'").n).toBe(2);
    expect(one("SELECT COUNT(*) AS n FROM raw_responses").n).toBe(2);

    // Khóa không được nằm ở bất kỳ đâu trong cơ sở dữ liệu.
    const dump = JSON.stringify([
      raw.prepare("SELECT * FROM sync_jobs").all(),
      raw.prepare("SELECT * FROM raw_responses").all(),
    ]);
    expect(dump).not.toContain(FAKE_KEY);
  });

  it("bản gốc nén lưu lại giải nén ra đúng nội dung dh3g đã trả", async () => {
    const { env, raw } = setup();
    await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", NOW);
    await workQueue(env, NOW, fakeDh3g(ok).fetchImpl);
    const chunks = raw.prepare("SELECT data FROM raw_chunks WHERE report='submissions' ORDER BY seq").all() as { data: Uint8Array }[];
    const stream = new Blob(chunks.map((c) => c.data)).stream().pipeThrough(new DecompressionStream("gzip"));
    expect(await new Response(stream).text()).toBe(JSON.stringify(submissionsReport()));
  });

  it("gọi lại: nội dung không đổi thì changed_at giữ nguyên, đổi thì cập nhật", async () => {
    const { env, one } = setup();
    const changed = () => one("SELECT changed_at, first_seen_at, last_seen_at FROM submissions WHERE learner_id=1001");
    const run = async (at: string, answer?: string) => {
      await env.DB.prepare("DELETE FROM sync_jobs").run();
      await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", new Date(at));
      await workQueue(env, new Date(at), fakeDh3g((u) => (u.pathname.endsWith("attendance") ? json(attendanceReport()) : json(submissionsReport({ answer })))).fetchImpl);
    };
    await run("2026-11-11T00:00:00Z");
    await run("2026-11-12T00:00:00Z");
    expect(changed()).toEqual({ changed_at: "2026-11-11T00:00:00.000Z", first_seen_at: "2026-11-11T00:00:00.000Z", last_seen_at: "2026-11-12T00:00:00.000Z" });
    await run("2026-11-13T00:00:00Z", "Trả lời đã sửa");
    expect(changed().changed_at).toBe("2026-11-13T00:00:00.000Z");
    expect(one("SELECT COUNT(*) AS n FROM submissions").n).toBe(2);
    expect(one("SELECT COUNT(*) AS n FROM raw_responses").n).toBe(2);
  });

  it("khóa bị từ chối: dừng ngay, việc vẫn nằm trong hàng đợi, không mất lượt thử", async () => {
    const { env, one } = setup();
    await enqueueRange(env.DB, "2026-11-05", "2026-11-07", "manual", NOW);
    await env.DB.prepare("DELETE FROM sync_jobs WHERE report='attendance'").run();
    const dh3g = fakeDh3g(() => new Response("no", { status: 401 }));
    for (let i = 0; i < 5; i++) await workQueue(env, NOW, dh3g.fetchImpl);
    expect(dh3g.calls).toHaveLength(5);
    expect(one("SELECT COUNT(*) AS n FROM sync_jobs WHERE status='pending' AND attempts=0").n).toBe(3);
    expect(one("SELECT error FROM sync_jobs WHERE error IS NOT NULL").error).toContain("từ chối khóa");
  });

  it("điểm danh không được phép: đánh dấu lỗi nhưng bài nộp vẫn chạy", async () => {
    const { env, one } = setup();
    await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", NOW);
    const dh3g = fakeDh3g((u) => (u.pathname.endsWith("attendance") ? new Response("", { status: 403 }) : json(submissionsReport())));
    expect(await workQueue(env, NOW, dh3g.fetchImpl)).toEqual({ status: "ran", done: 1, failed: 1 });
    expect(one("SELECT status FROM sync_jobs WHERE report='attendance'").status).toBe("failed");
    expect(one("SELECT COUNT(*) AS n FROM submissions").n).toBe(2);
  });

  it("dh3g lỗi tạm thời: thử lại tối đa 3 lần rồi đánh dấu lỗi", async () => {
    const { env, one } = setup();
    await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", NOW);
    await env.DB.prepare("DELETE FROM sync_jobs WHERE report='attendance'").run();
    const dh3g = fakeDh3g(() => new Response("", { status: 502 }));
    await workQueue(env, NOW, dh3g.fetchImpl);
    await workQueue(env, NOW, dh3g.fetchImpl);
    expect(dh3g.calls).toHaveLength(3);
    expect(one("SELECT status, attempts FROM sync_jobs")).toEqual({ status: "failed", attempts: 3 });
  });

  it("phản hồi sai dạng: không ghi gì, báo lỗi rõ", async () => {
    const { env, one } = setup();
    await enqueueRange(env.DB, "2026-11-07", "2026-11-07", "manual", NOW);
    await env.DB.prepare("DELETE FROM sync_jobs WHERE report='attendance'").run();
    await workQueue(env, NOW, fakeDh3g(() => json({ members: "sai" })).fetchImpl);
    expect(one("SELECT status, error FROM sync_jobs")).toEqual({ status: "failed", error: 'phản hồi dh3g thiếu danh sách "assignments"' });
    expect(one("SELECT COUNT(*) AS n FROM learners").n).toBe(0);
    expect(one("SELECT COUNT(*) AS n FROM raw_responses").n).toBe(0);
  });

  it("mỗi lượt chỉ xử lý 3 việc, ưu tiên ngày mới nhất; việc bị treo được trả lại", async () => {
    const { env, raw, one } = setup();
    await enqueueRange(env.DB, "2026-11-01", "2026-11-05", "manual", NOW);
    await env.DB.prepare("DELETE FROM sync_jobs WHERE report='attendance'").run();
    await workQueue(env, NOW, fakeDh3g(ok).fetchImpl);
    expect((raw.prepare("SELECT from_date FROM sync_jobs WHERE status='done' ORDER BY from_date").all() as { from_date: string }[]).map((r) => r.from_date)).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);

    await env.DB.prepare("UPDATE sync_jobs SET status='running', started_at='2026-11-10T23:00:00.000Z' WHERE from_date='2026-11-01'").run();
    await workQueue(env, NOW, fakeDh3g(ok).fetchImpl);
    expect(one("SELECT COUNT(*) AS n FROM sync_jobs WHERE status='done'").n).toBe(5);
  });
});

describe("lấy bài mỗi giờ", () => {
  it("chỉ xếp bài nộp của 2 ngày trước → 7 ngày tới, không gọi điểm danh; chạy lại không trùng", async () => {
    const { planHourly } = await import("../src/sync/queue");
    const { createTestDb } = await import("./helpers/d1");
    const { testEnv } = await import("./helpers/fixtures");
    const { d1, raw } = createTestDb();
    const env = testEnv(d1);
    const now = new Date("2026-11-12T03:00:00Z"); // 10:00 giờ VN
    expect(await planHourly(env, now)).toBe(10);
    const rows = raw.prepare("SELECT report, MIN(from_date) a, MAX(to_date) b, reason FROM sync_jobs GROUP BY report").all();
    expect(rows).toEqual([{ report: "submissions", a: "2026-11-10", b: "2026-11-19", reason: "hourly" }]);
    expect(await planHourly(env, now)).toBe(0);
    expect(await planHourly(testEnv(d1, { DH3G_API_KEY: undefined }), now)).toBe(0);
  });
});
