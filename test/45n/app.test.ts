import { describe, expect, it } from "vitest";
import app from "../../src/app";
import { createUser, setTeams } from "../../src/users/accounts";
import { createTestDb } from "../helpers/d1";
import { testEnv } from "../helpers/fixtures";

// Bản khóa 45N-K02 với dữ liệu giả hoàn toàn (tên, số điện thoại giả).
const ORIGIN = "https://45n-hub.invalid";
const form = (o: Record<string, string | string[]>) => {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

async function setup() {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1, { DH3G_COMMUNITY_ID: "47", SYNC_START_DATE: "2026-11-09" });
  const t = "2026-11-12T00:00:00Z";
  raw.exec(`
    INSERT INTO teams VALUES (1,'Nhóm 1-K2','${t}','${t}'), (2,'Nhóm 2-K2','${t}','${t}'), (3,'BTC','${t}','${t}'), (4,'Mentor đồng hành','${t}','${t}');
    INSERT INTO learners VALUES
      (1,'Học Viên Một','0911000001',NULL,2,1,'${t}','${t}'), (2,'Học Viên Hai','0911000002',NULL,2,1,'${t}','${t}'),
      (3,'Học Viên Ba','0911000003',NULL,2,2,'${t}','${t}'), (4,'Người BTC','0911000004',NULL,NULL,3,'${t}','${t}'),
      (5,'Người Mentor','0911000005',NULL,NULL,4,'${t}','${t}'), (6,'Học Viên K01','0911000006',NULL,NULL,NULL,'${t}','${t}');
    INSERT INTO assignments (id,title,type,due_at,first_seen_at,last_seen_at) VALUES
      (10,'BÀI TẬP NGÀY 12/11','NORMAL','2026-11-12T23:30:00','${t}','${t}'),
      (11,'BÀI TẬP TUẦN 1-1','WEEK','2026-11-15T23:30:00','${t}','${t}'),
      (9,'BÀI TẬP TUẦN 5.3 (K01)','WEEK','2026-10-21T18:00:00','${t}','${t}');
    INSERT INTO submissions (learner_id,assignment_id,status,submitted_at,content_hash,first_seen_at,changed_at,last_seen_at) VALUES
      (1,10,'DONE','2026-11-12T20:00:00','h','${t}','${t}','${t}'), (1,11,'DONE','2026-11-15T20:00:00','h','${t}','${t}','${t}'),
      (2,10,'OVERDUE','2026-11-13T08:00:00','h','${t}','${t}','${t}'), (2,11,'NOT_SUBMITTED',NULL,'h','${t}','${t}','${t}'),
      (3,10,'NOT_SUBMITTED',NULL,'h','${t}','${t}','${t}'), (3,11,'DONE','2026-11-15T10:00:00','h','${t}','${t}','${t}');
    INSERT INTO sessions VALUES (100,'','2026-11-12T19:45:00','2026-11-12T20:30:00',96,'${t}','${t}');
    INSERT INTO attendances VALUES (1,100,1,'2026-11-12T19:44:00','${t}'), (2,100,1,'2026-11-12T19:58:00','${t}'), (3,100,0,NULL,'${t}');
  `);
  const now = new Date();
  const btcCode = await createUser(d1, { phone: "0900000444", name: "BTC Giả", role: "btc" }, "test", now);
  const leadCode = await createUser(d1, { phone: "0900000555", name: "Trưởng Nhóm Giả", role: "truong_nhom" }, "test", now);
  const leadId = (raw.prepare("SELECT id FROM users WHERE phone='0900000555'").get() as { id: number }).id;
  await setTeams(d1, leadId, ["T01"], "test", now, "2026-11-09");
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.method === "POST") headers.set("origin", ORIGIN);
    return app.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), env);
  };
  const login = async (phone: string, code: string) => {
    const res = await call("/kich-hoat", { method: "POST", body: form({ sdt: phone, ma: code, mk: "matkhau-gia-1", mk2: "matkhau-gia-1" }) });
    expect(res.status).toBe(303);
    return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
  };
  return { raw, call, btc: await login("0900000444", btcCode), lead: await login("0900000555", leadCode) };
}

describe("45N-K02: kỷ luật", () => {
  it("trang chủ là tổng quan kỷ luật; không có bảng xếp hạng điểm, không công khai", async () => {
    const { call, btc } = await setup();
    const html = await (await call("/", { cookie: btc })).text();
    expect(html).toContain("Tổng quan 45N K2");
    expect(html).toContain("Bảng xếp hạng 7 nhóm");
    expect(html).toContain('href="/ky-luat/nhom/T01"');
    expect(html).not.toContain("Người BTC");
    expect(html).not.toContain('href="/bang-xep-hang"');
    expect(html).not.toContain('href="/cham"');
    expect((await call("/bang-xep-hang")).status).toBe(404);
    expect((await call("/cham", { cookie: btc })).status).toBe(404);
    expect((await call("/bao-cao", { cookie: btc })).status).toBe(404);
    // Chưa đăng nhập thì không xem được gì.
    const anon = await call("/");
    expect(anon.status).not.toBe(200);
    expect(await anon.text()).toContain("/dang-nhap");
  });

  it("Zoom: đúng giờ / trễ / vắng từ dh3g; trưởng nhóm báo camera cho nhóm mình", async () => {
    const { call, lead, btc } = await setup();
    let html = await (await call("/ky-luat/zoom?buoi=100", { cookie: btc })).text();
    expect(html).toMatch(/Có mặt đúng giờ \(1\)/);
    expect(html).toMatch(/Vào trễ \(1\)/);
    expect(html).toMatch(/Vắng \(1\)/);
    // Trưởng nhóm Nhóm 1 chỉ thấy và báo được nhóm mình.
    html = await (await call("/ky-luat/zoom?buoi=100", { cookie: lead })).text();
    expect(html).not.toContain("Học Viên Ba");
    expect((await call("/ky-luat/zoom/camera", { method: "POST", cookie: lead, body: form({ buoi: "100", doi: "T02", tat: "3" }) })).status).toBe(403);
    const ok = await call("/ky-luat/zoom/camera", { method: "POST", cookie: lead, body: form({ buoi: "100", doi: "T01", tat: ["1", "3"] }) });
    expect(ok.status).toBe(303);
    html = await (await call("/ky-luat/hv/1", { cookie: btc })).text();
    expect(html).toContain("Không bật camera");
    // Người ngoài nhóm (3) không bị ghi camera dù gửi lên.
    html = await (await call("/ky-luat/zoom?buoi=100", { cookie: btc })).text();
    expect(html).toMatch(/Không bật camera \(1\)/);
  });

  it("trưởng nhóm: chỉ vào nhóm mình, viết nhật ký; không duyệt miễn được", async () => {
    const { call, lead } = await setup();
    const home = await call("/", { cookie: lead });
    expect(home.headers.get("location")).toBe("/ky-luat/nhom");
    expect((await call("/ky-luat/nhom", { cookie: lead })).headers.get("location")).toBe("/ky-luat/nhom/T01");
    expect((await call("/ky-luat/nhom/T02", { cookie: lead })).status).toBe(403);
    expect((await call("/ky-luat/hv/3", { cookie: lead })).status).toBe(403);
    expect((await call("/ky-luat/thanh-vien", { cookie: lead })).status).toBe(403);
    expect((await call("/nop-bai", { cookie: lead })).status).toBe(403);
    const saved = await call("/ky-luat/nhom/T01/nhat-ky", { method: "POST", cookie: lead, body: form({ tuan: "1", tinh_hinh: "Cả nhóm cố gắng", de_xuat: "Không" }) });
    expect(saved.status).toBe(303);
    const html = await (await call("/ky-luat/nhom/T01?tuan=1", { cookie: lead })).text();
    expect(html).toContain("Cả nhóm cố gắng");
    expect(html).toContain("Học Viên Hai");
    expect((await call("/ky-luat/hv/2/mien", { method: "POST", cookie: lead, body: form({ loai: "bai", ma: "11", ly_do: "x" }) })).status).toBe(403);
  });

  it("BTC duyệt miễn có lý do và đánh dấu dừng tham gia", async () => {
    const { call, btc, raw } = await setup();
    let html = await (await call("/ky-luat/hv/2", { cookie: btc })).text();
    expect(html).toContain("Không làm bài tuần");
    expect((await call("/ky-luat/hv/2/mien", { method: "POST", cookie: btc, body: form({ loai: "bai", ma: "11", ly_do: "" }) })).status).toBe(400);
    expect((await call("/ky-luat/hv/2/mien", { method: "POST", cookie: btc, body: form({ loai: "bai", ma: "11", ly_do: "Nhập viện" }) })).status).toBe(303);
    html = await (await call("/ky-luat/hv/2", { cookie: btc })).text();
    expect(html).toContain("Được miễn");
    expect(html).toContain("Nhập viện");
    html = await (await call("/ky-luat/mien", { cookie: btc })).text();
    expect(html).toContain("BÀI TẬP TUẦN 1-1");
    expect((await call("/ky-luat/hv/3/dung", { method: "POST", cookie: btc, body: form({ tu: "2026-11-14", ly_do: "Xin nghỉ" }) })).status).toBe(303);
    expect((raw.prepare("SELECT stopped_from FROM learner_status WHERE learner_id=3").get() as { stopped_from: string }).stopped_from).toBe("2026-11-14");
    html = await (await call("/", { cookie: btc })).text();
    expect(html).toContain("1 đã dừng");
  });

  it("bài tập: thống kê theo bài, theo nhóm, danh sách chưa hoàn thành; không lẫn bài khóa K01", async () => {
    const { call, btc } = await setup();
    const html = await (await call("/ky-luat/bai-tap?bt=11", { cookie: btc })).text();
    expect(html).toContain("Chưa hoàn thành đúng hạn (1)");
    expect(html).toContain("Học Viên Hai");
    expect(html).not.toContain("K01");
  });
});
