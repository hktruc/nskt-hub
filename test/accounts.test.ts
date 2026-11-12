import { describe, expect, it } from "vitest";
import app from "../src/app";
import { createUser } from "../src/users/accounts";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

// Tài khoản giả, số điện thoại giả.
const ORIGIN = "https://nskt-hub.invalid";
const req = (path: string, init: RequestInit & { cookie?: string } = {}) => {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.method === "POST" && !headers.has("origin")) headers.set("origin", ORIGIN);
  return new Request(`${ORIGIN}${path}`, { ...init, headers });
};
const form = (o: Record<string, string | string[]>) => {
  const f = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0]!;

async function setup() {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1, { ACCESS_TEAM_DOMAIN: "nhom-gia.cloudflareaccess.com", ACCESS_AUD: "aud-gia" });
  const now = new Date();
  const codes = {
    coach: await createUser(d1, { phone: "0900 000 111", name: "Coach Giả", role: "coach" }, "test", now),
    ps: await createUser(d1, { phone: "+84900000222", name: "Phụng Sự Giả", role: "phung_su" }, "test", now),
    admin: await createUser(d1, { phone: "0900000333", name: "Admin Giả", role: "admin" }, "test", now),
  };
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => app.fetch(req(path, init), env);
  const activateAs = async (phone: string, code: string, pw = "matkhau-gia-1") => {
    const res = await call("/kich-hoat", { method: "POST", body: form({ sdt: phone, ma: code, mk: pw, mk2: pw }) });
    expect(res.status).toBe(303);
    return cookieOf(res);
  };
  return { env, raw, codes, call, activateAs };
}

describe("tài khoản nội bộ", () => {
  it("kích hoạt bằng mã một lần, đặt mật khẩu, đăng nhập lại được; mã không dùng lại được", async () => {
    const { raw, codes, call, activateAs } = await setup();
    const cookie = await activateAs("0900000111", codes.coach.toLowerCase()); // không phân biệt hoa thường
    expect(cookie).toMatch(/^nskt_s=/);
    expect((await call("/du-lieu", { cookie })).status).toBe(200);
    // Mật khẩu và mã không lưu dạng chữ thường.
    const row = raw.prepare("SELECT password_hash, code_hash FROM users WHERE phone='0900000111'").get() as { password_hash: string; code_hash: string | null };
    expect(row.password_hash).toMatch(/^pbkdf2\$100000\$/);
    expect(row.code_hash).toBeNull();
    const again = await call("/kich-hoat", { method: "POST", body: form({ sdt: "0900000111", ma: codes.coach, mk: "khac-hoan-toan", mk2: "khac-hoan-toan" }) });
    expect(again.status).toBe(400);

    const ok = await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000111", mk: "matkhau-gia-1", tiep: "/nop-bai" }) });
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/nop-bai");
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(ok.headers.get("set-cookie")).toMatch(/Secure/i);
    // Không cho chuyển hướng ra trang ngoài.
    const evil = await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000111", mk: "matkhau-gia-1", tiep: "//ke-xau.invalid" }) });
    expect(evil.headers.get("location")).toBe("/");
  });

  it("sai mật khẩu 5 lần thì tạm khóa; đăng nhập từ trang khác bị từ chối", async () => {
    const { codes, call, activateAs } = await setup();
    await activateAs("0900000111", codes.coach);
    for (let i = 0; i < 5; i++) {
      expect((await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000111", mk: "sai-mat-khau" }) })).status).toBe(401);
    }
    const locked = await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000111", mk: "matkhau-gia-1" }) });
    expect(await locked.text()).toContain("tạm khóa");
    const foreign = await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000111", mk: "matkhau-gia-1" }), headers: { origin: "https://ke-xau.invalid" } });
    expect(foreign.status).toBe(403);
  });

  it("chưa đăng nhập: trang nội bộ hiện nút đăng nhập, không lộ dữ liệu", async () => {
    const { call } = await setup();
    const res = await call("/nop-bai?bt=1");
    expect(res.status).toBe(401);
    const html = await res.text();
    expect(html).toContain("/dang-nhap?tiep=%2Fnop-bai%3Fbt%3D1");
    expect(html).not.toContain("Theo dõi nộp bài");
  });

  it("ban phụng sự chỉ vào bàn chấm và trang tài khoản", async () => {
    const { codes, call, activateAs } = await setup();
    const cookie = await activateAs("0900000222", codes.ps);
    expect((await call("/cham", { cookie })).status).toBe(200);
    expect((await call("/tai-khoan", { cookie })).status).toBe(200);
    const home = await call("/", { cookie });
    expect([home.status, home.headers.get("location")]).toEqual([303, "/cham"]);
    for (const p of ["/nop-bai", "/bai?hv=1&bt=1", "/canh-bao", "/du-lieu", "/quan-tri"]) {
      expect((await call(p, { cookie })).status).toBe(403);
    }
  });

  it("admin tạo người, giao đội, thu hồi; coach không vào được quản trị", async () => {
    const { raw, codes, call, activateAs } = await setup();
    const coach = await activateAs("0900000111", codes.coach);
    expect((await call("/quan-tri", { cookie: coach })).status).toBe(403);

    const admin = await activateAs("0900000333", codes.admin);
    const created = await call("/quan-tri/tao", { method: "POST", cookie: admin, body: form({ ten: "Người Mới Giả", sdt: "0900000444", vt: "phung_su" }) });
    const html = await created.text();
    expect(html).toMatch(/class="code">[A-Z2-9]{4}-[A-Z2-9]{4}</);
    const dup = await call("/quan-tri/tao", { method: "POST", cookie: admin, body: form({ ten: "Trùng", sdt: "0900000444", vt: "coach" }) });
    expect(await dup.text()).toContain("đã có tài khoản");

    const ps = raw.prepare("SELECT id FROM users WHERE phone='0900000222'").get() as { id: number };
    await call("/quan-tri/doi", { method: "POST", cookie: admin, body: form({ id: String(ps.id), doi: ["T03", "T04", "T99"] }) });
    expect(raw.prepare("SELECT team_code FROM grader_teams WHERE user_id=? ORDER BY team_code").all(ps.id)).toEqual([{ team_code: "T03" }, { team_code: "T04" }]);

    // Thu hồi: phiên đang mở bị hủy ngay.
    const psCookie = await activateAs("0900000222", codes.ps);
    expect(await (await call("/tai-khoan", { cookie: psCookie })).text()).toContain("Đội 03, Đội 04");
    await call("/quan-tri/trang-thai", { method: "POST", cookie: admin, body: form({ id: String(ps.id), bat: "0" }) });
    expect((await call("/cham", { cookie: psCookie })).status).toBe(401);
    expect((await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000222", mk: "matkhau-gia-1" }) })).status).toBe(401);

    // Cấp mã mới cho coach: mật khẩu cũ hết tác dụng.
    const c = raw.prepare("SELECT id FROM users WHERE phone='0900000111'").get() as { id: number };
    await call("/quan-tri/ma", { method: "POST", cookie: admin, body: form({ id: String(c.id) }) });
    expect((await call("/du-lieu", { cookie: coach })).status).toBe(401);
    expect(await (await call("/dang-nhap", { method: "POST", body: form({ sdt: "0900000111", mk: "matkhau-gia-1" }) })).text()).toContain("chưa kích hoạt");
  });

  it("đăng xuất hủy phiên", async () => {
    const { codes, call, activateAs } = await setup();
    const cookie = await activateAs("0900000111", codes.coach);
    const out = await call("/dang-xuat", { method: "POST", cookie });
    expect(out.headers.get("location")).toBe("/dang-nhap?tb=da-xuat");
    expect((await call("/du-lieu", { cookie })).status).toBe(401);
  });
});
