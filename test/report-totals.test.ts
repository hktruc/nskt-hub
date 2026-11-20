import { describe, expect, it } from "vitest";
import app from "../src/app";
import { courseByWeek } from "../src/reports/data";
import { createUser } from "../src/users/accounts";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

// Dữ liệu giả hoàn toàn: 2 học viên, 2 bài ngày, 2 bài tuần.
const ORIGIN = "https://nskt-hub.invalid";

async function setup() {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1);
  const t = "2026-11-01T00:00:00Z";
  raw.exec(`
    INSERT INTO teams VALUES (1,'🐟 Đội Cá Chép 01','${t}','${t}');
    INSERT INTO learners VALUES (1,'Học Viên Một',NULL,NULL,1,1,'${t}','${t}'), (2,'Học Viên Hai',NULL,NULL,1,1,'${t}','${t}');
    INSERT INTO assignments (id,title,type,due_at,first_seen_at,last_seen_at) VALUES
      (10,'Bài ngày A','NORMAL','2026-10-06T23:00:00','${t}','${t}'), (11,'Bài ngày B','NORMAL','2026-10-07T23:00:00','${t}','${t}'),
      (20,'Bài tuần C (X10)','WEEK','2026-10-11T23:00:00','${t}','${t}'), (21,'Bài tuần D (X10)','WEEK','2026-10-18T23:00:00','${t}','${t}');
    INSERT INTO submissions (learner_id,assignment_id,status,answers_json,content_hash,first_seen_at,changed_at,last_seen_at) VALUES
      (1,10,'DONE','[]','h','${t}','${t}','${t}'), (2,10,'NOT_SUBMITTED','[]','h','${t}','${t}','${t}'),
      (1,11,'OVERDUE','[]','h','${t}','${t}','${t}'), (2,11,'DONE','[]','h','${t}','${t}','${t}'),
      (1,20,'DONE','[]','h','${t}','${t}','${t}'), (2,20,'LATE','[]','h','${t}','${t}','${t}'),
      (1,21,'NOT_SUBMITTED','[]','h','${t}','${t}','${t}'), (2,21,'NOT_SUBMITTED','[]','h','${t}','${t}','${t}');
  `);
  const code = await createUser(d1, { phone: "0900000111", name: "Coach Giả", role: "coach" }, "test", new Date());
  const call = (path: string, cookie?: string) => app.fetch(new Request(`${ORIGIN}${path}`, { headers: cookie ? { cookie } : {} }), env);
  const res = await app.fetch(new Request(`${ORIGIN}/kich-hoat`, { method: "POST", headers: { origin: ORIGIN }, body: new URLSearchParams({ sdt: "0900000111", ma: code, mk: "matkhau-gia-1", mk2: "matkhau-gia-1" }) }), env);
  return { d1, call, coach: (res.headers.get("set-cookie") ?? "").split(";")[0]! };
}

describe("báo cáo toàn khóa: tổng bài tập ngày và tuần đã nộp", () => {
  it("đếm số lượt đã nộp (gồm cả nộp trễ) trên số lượt phải nộp, theo tuần", async () => {
    const { d1 } = await setup();
    const weeks = await courseByWeek(d1, new Date("2026-11-20T05:00:00Z"));
    const sum = (k: "dailyDue" | "dailySubmitted" | "dailyAssignments" | "weeklyDue" | "weeklySubmitted" | "weeklyAssignments") => weeks.reduce((n, w) => n + w[k], 0);
    expect([sum("dailyDue"), sum("dailySubmitted"), sum("dailyAssignments")]).toEqual([4, 3, 2]);
    expect([sum("weeklyDue"), sum("weeklySubmitted"), sum("weeklyAssignments")]).toEqual([4, 2, 2]);
  });

  it("trang /bao-cao hiện hai ô tổng", async () => {
    const { call, coach } = await setup();
    const html = await (await call("/bao-cao", coach)).text();
    expect(html).toMatch(/Tổng bài tập ngày đã nộp<\/div><div class="num">3<\/div>/);
    expect(html).toContain("trên 4 lượt phải nộp (75%)");
    expect(html).toMatch(/Tổng bài tập tuần đã nộp<\/div><div class="num">2<\/div>/);
    expect(html).toContain("trên 4 lượt phải nộp (50%)");
    expect(html).toContain("2 bài ngày đã tới hạn");
    expect(html).toContain("2 bài tuần đã tới hạn");
  });
});
