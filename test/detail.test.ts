import { describe, expect, it } from "vitest";
import app from "../src/app";
import { scoringTick } from "../src/scoring/run";
import { enqueueRange, workQueue } from "../src/sync/queue";
import { createTestDb } from "./helpers/d1";
import { attendanceReport, fakeDh3g, json, submissionsReport, testEnv } from "./helpers/fixtures";

const NOW = new Date("2026-11-11T00:20:00Z");
const local = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);

async function setup(answer?: string) {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1, { LOCAL_DEV_NO_AUTH: "true" });
  await enqueueRange(d1, "2026-11-07", "2026-11-07", "manual", NOW);
  const r = submissionsReport({ answer });
  await workQueue(env, NOW, fakeDh3g((u) => (u.pathname.endsWith("attendance") ? json(attendanceReport()) : json(r))).fetchImpl);
  raw.prepare("UPDATE teams SET name='🐟 Đội Cá Chép 07' WHERE id=7").run();
  await scoringTick(env, NOW);
  return { env, raw };
}

const post = (env: ReturnType<typeof testEnv>, body: Record<string, string>) =>
  app.fetch(local("/bai/sua", { method: "POST", body: new URLSearchParams(body), headers: { Origin: "http://localhost" } }), env);

describe("trang đọc bài", () => {
  it("hiện câu hỏi, câu trả lời, ảnh bìa YouTube, ảnh, điểm từng câu", async () => {
    const { env } = await setup("Em kể chuyện https://youtu.be/abcDEF12345 và ảnh https://s3.sunteco.app/i/a.jpg");
    const res = await app.fetch(local("/bai?hv=1001&bt=501"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Học Viên A");
    expect(html).toContain("Đội 07");
    expect(html).toContain("https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg");
    expect(html).toContain('src="https://s3.sunteco.app/i/a.jpg"');
    expect(html).toContain("<strong>1</strong>/1 điểm");
    expect(html).not.toContain("0000000001"); // không hiện số điện thoại
  });

  it("bài không tồn tại thì 404", async () => {
    const { env } = await setup();
    expect((await app.fetch(local("/bai?hv=1&bt=2"), env)).status).toBe(404);
  });

  it("sửa điểm tay: lưu, tính lại ngay, ghi người sửa; gõ 'bo' để bỏ", async () => {
    const { env, raw } = await setup();
    expect(raw.prepare("SELECT earned FROM scores WHERE learner_id=1001").get()).toEqual({ earned: 1 });

    const r1 = await post(env, { hv: "1001", bt: "501", cau: "0", diem: "0,5" });
    expect(r1.status).toBe(303);
    expect(r1.headers.get("location")).toContain("tb=da-sua");
    expect(raw.prepare("SELECT earned FROM scores WHERE learner_id=1001").get()).toEqual({ earned: 0.5 });
    expect(raw.prepare("SELECT by_email FROM score_overrides").get()).toEqual({ by_email: "dev@localhost" });
    const html = await (await app.fetch(local("/bai?hv=1001&bt=501"), env)).text();
    expect(html).toContain("Sửa tay");

    // Điểm vượt tối đa của câu được kẹp lại.
    await post(env, { hv: "1001", bt: "501", cau: "0", diem: "9" });
    expect(raw.prepare("SELECT earned FROM scores WHERE learner_id=1001").get()).toEqual({ earned: 1 });

    const r2 = await post(env, { hv: "1001", bt: "501", cau: "0", diem: "bo" });
    expect(r2.headers.get("location")).toContain("tb=da-bo");
    expect(raw.prepare("SELECT COUNT(*) AS n FROM score_overrides").get()).toEqual({ n: 0 });
    expect(raw.prepare("SELECT detail_json FROM scores WHERE learner_id=1001").get()).not.toMatchObject({ detail_json: expect.stringContaining("sua-tay") });
  });

  it("điểm không hợp lệ thì báo lỗi, không lưu; yêu cầu từ trang khác bị chặn", async () => {
    const { env, raw } = await setup();
    const r = await post(env, { hv: "1001", bt: "501", cau: "0", diem: "abc" });
    expect(r.headers.get("location")).toContain("tb=sai-so");
    expect(raw.prepare("SELECT COUNT(*) AS n FROM score_overrides").get()).toEqual({ n: 0 });
    const foreign = await app.fetch(
      local("/bai/sua", { method: "POST", body: new URLSearchParams({ hv: "1001", bt: "501", cau: "0", diem: "0" }), headers: { Origin: "https://ke-xau.invalid" } }),
      env,
    );
    expect(foreign.status).toBe(403);
  });

  it("trang cảnh báo liệt kê câu đối phó, chỉ người đăng nhập mới xem được", async () => {
    const { env, raw } = await setup();
    raw.prepare(`UPDATE scores SET flags_json='[{"index":0,"reason":"chỉ có ký hiệu, không có chữ"}]' WHERE learner_id=1001`).run();
    const html = await (await app.fetch(local("/canh-bao"), env)).text();
    expect(html).toContain("Học Viên A");
    expect(html).toContain("chỉ có ký hiệu");
    expect(html).toContain("/bai?hv=1001&amp;bt=501");
    const pub = await app.fetch(new Request("https://nskt-hub.invalid/canh-bao"), testEnv(env.DB));
    expect(pub.status).toBe(503);
  });
});
