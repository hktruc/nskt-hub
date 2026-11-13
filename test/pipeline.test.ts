import { describe, expect, it } from "vitest";
import app from "../src/app";
import { enqueueRange, workQueue } from "../src/sync/queue";
import { scoringTick } from "../src/scoring/run";
import { createTestDb } from "./helpers/d1";
import { attendanceReport, fakeDh3g, json, submissionsReport, testEnv } from "./helpers/fixtures";

const NOW = new Date("2026-11-11T00:20:00Z");

async function synced(extra = {}) {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1, extra);
  await enqueueRange(d1, "2026-11-07", "2026-11-07", "manual", NOW);
  const dh3g = fakeDh3g((u) => (u.pathname.endsWith("attendance") ? json(attendanceReport()) : json(submissionsReport())));
  await workQueue(env, NOW, dh3g.fetchImpl);
  return { env, raw };
}

describe("chuỗi chấm điểm", () => {
  it("không có khóa OpenAI: vẫn tính điểm tạm, không gọi AI", async () => {
    const { env, raw } = await synced();
    const calls: string[] = [];
    const r = await scoringTick(env, NOW, (async (u: RequestInfo | URL) => { calls.push(String(u)); return new Response("{}"); }) as typeof fetch);
    expect(r.ai.status).toBe("no-key");
    expect(calls).toEqual([]);
    expect(r.specs).toBe(1);
    expect(r.scored).toBe(2);
    const rows = raw.prepare("SELECT learner_id, earned, max, provisional FROM scores ORDER BY learner_id").all();
    expect(rows).toEqual([
      { learner_id: 1001, earned: 1, max: 1, provisional: 0 },
      { learner_id: 1002, earned: 0, max: 1, provisional: 0 },
    ]);
    // Lượt sau không có gì mới thì không tính lại.
    expect((await scoringTick(env, NOW)).scored).toBe(0);
  });

  it("có khóa: gọi AI cho câu cần đọc hiểu, lưu kết quả, tính lại khi học viên sửa bài", async () => {
    const { env, raw } = await synced({ OPENAI_API_KEY: "KHOA-GIA", OPENAI_MODEL: "gpt-5-nano" });
    // Bài giả có 1 câu "Câu 1" không nhãn → coi là câu bắt buộc bài ngày, không cần AI.
    const ai: unknown[] = [];
    const r = await scoringTick(env, NOW, (async (_u: RequestInfo | URL, init?: RequestInit) => { ai.push(init?.body); return new Response("{}"); }) as typeof fetch);
    expect(r.ai).toEqual({ status: "ran", reviewed: 0, failed: 0 });
    expect(ai).toEqual([]);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM ai_reviews WHERE status='ok'").get()).toEqual({ n: 1 });
    // Học viên sửa bài → bài nộp đổi → tính lại.
    raw.prepare("UPDATE submissions SET answers_hash='moi', changed_at='2026-11-11T00:30:00.000Z' WHERE learner_id=1001").run();
    const r2 = await scoringTick(env, new Date("2026-11-11T00:35:00Z"));
    expect(r2.scored).toBe(1);
  });

  it("bảng xếp hạng công khai: không cần đăng nhập, chỉ hiện tên, đội, điểm, màu", async () => {
    const { env, raw } = await synced();
    raw.prepare("UPDATE teams SET name='🐟 Đội Cá Chép 07' WHERE id=7").run();
    await scoringTick(env, NOW);
    const res = await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang"), env); // không có cấu hình đăng nhập
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Học Viên A");
    expect(html).toContain("Đội 07");
    expect(html).toContain("100%");
    expect(html).not.toContain("0000000001"); // số điện thoại
    expect(html).not.toContain("example.invalid"); // email
    expect(html).not.toContain("Học Viên B"); // không thuộc 12 đội
    expect(html).not.toContain('href="/du-lieu"'); // không lộ đường vào trang nội bộ
    // Các trang khác vẫn bị khóa.
    expect((await app.fetch(new Request("https://nskt-hub.invalid/nop-bai"), env)).status).toBe(503);
  });

  it("bấm tên trên bảng xếp hạng: chi tiết công khai, không lộ số điện thoại / email / cảnh báo", async () => {
    const { env, raw } = await synced();
    raw.prepare("UPDATE teams SET name='🐟 Đội Cá Chép 07' WHERE id=7").run();
    await scoringTick(env, NOW);
    const list = await (await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang"), env)).text();
    expect(list).toContain('href="/bang-xep-hang/hv/1001"');
    for (const url of ["/bang-xep-hang/hv/1001", "/bang-xep-hang/hv/1001?p=1"]) {
      const res = await app.fetch(new Request(`https://nskt-hub.invalid${url}`), env);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Học Viên A");
      expect(html).toContain("Thứ hạng 3 tuần gần nhất");
      expect(html).toContain("Bài tập tích lũy");
      expect(html).not.toContain("0000000001");
      expect(html).not.toContain("example.invalid");
      expect(html).not.toContain("Cảnh báo");
    }
    // Người không thuộc 12 đội, hoặc mã sai: không có trang.
    expect((await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang/hv/1002"), env)).status).toBe(404);
    expect((await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang/hv/abc"), env)).status).toBe(404);
  });
});

describe("bảng xếp hạng theo đội", () => {
  it("xem một đội thì hiện hạng trong đội kèm hạng toàn khóa", async () => {
    const { LeaderboardPage } = await import("../src/pages/leaderboard");
    const mk = (id: number, team: string, percent: number, rank: number) => ({
      rank, learnerId: id, name: `HV ${id}`, team, percent, studyPercent: percent, attendancePercent: null, color: "vang" as const, colorLabel: "Vàng", onTimeSessions: 0, onTimeVideos: 0, avgHoursEarly: 0,
    });
    const ranked = [mk(1, "T01", 90, 1), mk(2, "T02", 80, 2), mk(3, "T02", 80, 2), mk(4, "T02", 70, 4)];
    const html = String(LeaderboardPage({ ranked, team: "T02", teams: ["T01", "T02"], provisional: false, updatedAt: null }));
    expect(html).toContain("#4 khóa");
    expect(html.match(/class="rank">(\d+)</g)).toEqual(['class="rank">1<', 'class="rank">1<', 'class="rank">3<']);
    expect(html).not.toContain("HV 1<");
    // Bục Top 3 và thanh tỷ lệ màu (đội có 3 người).
    expect(html).toContain('class="podium"');
    expect(html).toContain('class="dist"');
  });
});

describe("báo cáo chấm chéo và từng học viên", () => {
  it("đếm lượt chấm chéo cho / nhận; bảng từng học viên sắp xếp được", async () => {
    const { env, raw } = await synced();
    raw.prepare("UPDATE teams SET name='🐟 Đội Cá Chép 07' WHERE id=7").run();
    await scoringTick(env, NOW);
    const dev = { ...env, LOCAL_DEV_NO_AUTH: "true" };
    const peer = await (await app.fetch(new Request("http://localhost/bao-cao/cham-cheo"), dev)).text();
    // Học Viên A (đội 07) được Học Viên B (không thuộc 12 đội) chấm 1 lượt.
    expect(peer).toMatch(/Tổng lượt chấm chéo<\/div><div class="num">1</);
    expect(peer).toContain("Chưa chấm chéo cho ai (1)");
    const sum = await (await app.fetch(new Request("http://localhost/bao-cao/hoc-vien?sx=cham-cheo&tang=1"), dev)).text();
    expect(sum).toContain("Học Viên A");
    expect(sum).toContain("0 / 1");
    expect(sum).not.toContain("Học Viên B");
    expect(sum).not.toContain("0000000001");
  });
});

describe("bảng xếp hạng đồng đội", () => {
  it("điểm đội = trung bình thành viên, ghi số thành viên; đội ít người vẫn công bằng", async () => {
    const { LeaderboardPage, teamRanking } = await import("../src/pages/leaderboard");
    const mk = (id: number, team: string, percent: number) => ({
      rank: 0, learnerId: id, name: `HV ${id}`, team, percent, studyPercent: percent, attendancePercent: null,
      color: (percent >= 80 ? "xanh" : percent >= 50 ? "vang" : "do") as "xanh" | "vang" | "do", colorLabel: "", onTimeSessions: 0, onTimeVideos: 0, avgHoursEarly: 0,
    });
    // Đội 01: 3 người (90, 80, 40) → TB 70. Đội 02: 1 người 75 → TB 75 (xếp trên dù ít người).
    const ranked = [mk(1, "T01", 90), mk(2, "T01", 80), mk(3, "T01", 40), mk(4, "T02", 75)];
    expect(teamRanking(ranked).map((t) => [t.team, t.members, t.avg, t.rank, t.color])).toEqual([
      ["T02", 1, 75, 1, "vang"],
      ["T01", 3, 70, 2, "vang"],
    ]);
    const html = String(LeaderboardPage({ ranked, team: "", teams: ["T01", "T02"], provisional: false, updatedAt: null, mode: "doi" }));
    expect(html).toContain("3 người");
    expect(html).toContain('href="/bang-xep-hang?doi=T01"');
    expect(html).not.toContain("HV 1<"); // chế độ đồng đội không liệt kê từng người
  });
});
