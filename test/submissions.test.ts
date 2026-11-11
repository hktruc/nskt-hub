import { describe, expect, it } from "vitest";
import app from "../src/app";
import { bucketOf, loadBoard, shortVN } from "../src/pages/submissions";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

const NOW = new Date("2026-11-08T03:00:00Z"); // 10:00 giờ VN ngày 08/11

function seed() {
  const { d1, raw } = createTestDb();
  const t = "2026-11-01T00:00:00Z";
  raw.exec(`
    INSERT INTO teams VALUES (1,'🐟 Đội Cá Chép 01','${t}','${t}'), (2,'🐟 Đội Cá Chép 02','${t}','${t}'), (3,'BTC','${t}','${t}');
    INSERT INTO learners (id, full_name, team_id, first_seen_at, last_seen_at) VALUES
      (11,'Học Viên A',1,'${t}','${t}'), (12,'Học Viên B',1,'${t}','${t}'),
      (21,'Học Viên C',2,'${t}','${t}'), (31,'Người BTC',3,'${t}','${t}'), (41,'Chưa Có Đội',NULL,'${t}','${t}');
    INSERT INTO assignments (id, title, type, due_at, first_seen_at, last_seen_at) VALUES
      (501,'Thứ Bảy, 07/11/2026','NORMAL','2026-11-07T23:00:00','${t}','${t}'),
      (502,'Thứ Hai, 09/11/2026','NORMAL','2026-11-09T23:00:00','${t}','${t}');
  `);
  const sub = raw.prepare(`INSERT INTO submissions (learner_id, assignment_id, status, submitted_at, answers_json, content_hash, first_seen_at, changed_at, last_seen_at)
    VALUES (?,?,?,?,?, 'h', '${t}','${t}','${t}')`);
  const ans = (...a: string[]) => JSON.stringify(a.map((answer) => ({ question: "Câu", type: "Tự luận", answer })));
  sub.run(11, 501, "DONE", "2026-11-07T21:05:00.1", ans("https://youtu.be/x", "https://s3.sunteco.app/i/a.jpg"));
  sub.run(12, 501, "OVERDUE", "2026-11-08T08:15:00.1", ans("https://s3.sunteco.app/i/b.png"));
  sub.run(21, 501, "NOT_SUBMITTED", null, null);
  sub.run(31, 501, "DONE", "2026-11-07T20:00:00", ans("https://youtu.be/btc"));
  sub.run(41, 501, "DONE", "2026-11-07T20:00:00", ans());
  for (const id of [11, 12, 21]) sub.run(id, 502, "NOT_SUBMITTED", null, null);
  return testEnv(d1, { LOCAL_DEV_NO_AUTH: "true" });
}

describe("theo dõi nộp bài", () => {
  it("phân loại tình trạng theo giờ Việt Nam", () => {
    expect(bucketOf("DONE", "2026-11-07T23:00:00", "2026-11-08T10:00:00")).toBe("dung-han");
    expect(bucketOf("OVERDUE", "2026-11-07T23:00:00", "2026-11-08T10:00:00")).toBe("tre");
    expect(bucketOf("NOT_SUBMITTED", "2026-11-07T23:00:00", "2026-11-08T10:00:00")).toBe("chua-nop");
    expect(bucketOf("NOT_SUBMITTED", "2026-11-09T23:00:00", "2026-11-08T10:00:00")).toBe("chua-toi-han");
    expect(shortVN("2026-11-07T21:05:00.123")).toBe("07/11 21:05");
  });

  it("mặc định chọn bài đã tới hạn gần nhất; chỉ tính học viên 12 đội", async () => {
    const d = await loadBoard(seed(), {}, NOW);
    expect(d.assignment?.id).toBe(501);
    expect(d.teams).toEqual(["T01", "T02"]);
    expect(d.totals).toMatchObject({ "dung-han": 1, tre: 1, "chua-nop": 1, videos: 1, images: 2, learners: 3 });
    expect(d.byTeam).toEqual([
      { team: "T01", total: 2, submitted: 2, late: 1, videos: 1, images: 2 },
      { team: "T02", total: 1, submitted: 0, late: 0, videos: 0, images: 0 },
    ]);
    expect(d.lines.map((l) => l.name)).toEqual(["Học Viên B", "Học Viên A", "Học Viên C"]);
  });

  it("lọc theo đội và tình trạng", async () => {
    const env = seed();
    expect((await loadBoard(env, { doi: "T01", tt: "tre" }, NOW)).lines.map((l) => l.id)).toEqual([12]);
    expect((await loadBoard(env, { doi: "BTC" }, NOW)).team).toBe("");
    const future = await loadBoard(env, { bt: "502" }, NOW);
    expect(future.totals["chua-toi-han"]).toBe(3);
  });

  it("trang hiển thị được và lọc qua đường dẫn", async () => {
    const res = await app.fetch(new Request("http://localhost/nop-bai?bt=501&doi=T01"), seed());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Theo dõi nộp bài");
    expect(html).toContain("Học Viên A");
    expect(html).not.toContain("Học Viên C");
    expect(html).not.toContain("Người BTC");
  });

  it("xem tất cả đội thì chỉ hiện bảng theo đội, không liệt kê hết học viên", async () => {
    const html = await (await app.fetch(new Request("http://localhost/nop-bai?bt=501"), seed())).text();
    expect(html).toContain("Theo đội");
    expect(html).not.toContain("Học Viên A");
    const late = await (await app.fetch(new Request("http://localhost/nop-bai?bt=501&tt=tre"), seed())).text();
    expect(late).toContain("Học Viên B");
    expect(late).not.toContain("Học Viên A");
  });

  it("chưa có dữ liệu thì báo rõ", async () => {
    const res = await app.fetch(new Request("http://localhost/nop-bai"), testEnv(createTestDb().d1, { LOCAL_DEV_NO_AUTH: "true" }));
    expect(await res.text()).toContain("Chưa có bài tập nào");
  });
});
