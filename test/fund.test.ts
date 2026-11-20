import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { loadFund, parseFund, parseMoney, resetFundCache, summarize } from "../src/fund/read";
import { ddmmyyyy, money } from "../src/pages/fund";
import { createUser } from "../src/users/accounts";
import { createTestDb } from "./helpers/d1";
import { json, testEnv } from "./helpers/fixtures";

// Dữ liệu GIẢ, cùng cấu trúc với tab TONG_HOP của bảng tính kỷ luật thật.
const HEAD = ["Thôn", "Mã Cư Dân", "Họ và Tên", "Trạng thái", "Trừ cá nhân (đ)", "Trừ do đội (đ)", "Tổng trừ (đ)", "Đi trễ", "Vắng có phép", "Vắng không phép", "Nộp bài trễ", "Không nộp bài", "Chờ xác minh"];
const TONG_HOP = [
  ["Cập nhật 11:03 20/11/2026 · tiền chỉ cộng dòng trạng thái TÍNH"],
  HEAD,
  ["T01", "T0101", "Người Giả Một", "Đang học", "600.000", "525.000", "1.125.000", "0", "1", "3", "0", "0", "1"],
  ["T01", "T0102", "Người Giả Hai", "Đang học", "50.000", "1.175.000", "1.225.000", "0", "0", "0", "1", "0", "1"],
  ["T02", "T0201", "Người Giả Ba", "Đang học", "0", "0", "0", "0", "0", "0", "0", "0", "0"],
  ["T02", "T0202", "Người Giả Bốn", "Bảo lưu", "100.000", "50.000", "150.000", "0", "0", "0", "0", "1", "0"],
  ["BTC", "B0001", "Người BTC", "Đang học", "0", "0", "999.999", "", "", "", "", "", ""], // không thuộc 12 đội: bỏ
  [],
];

describe("quỹ gieo hạt: đọc và tổng hợp", () => {
  it("đọc tiền theo cách bảng tính ghi", () => {
    expect([parseMoney("1.125.000"), parseMoney("1,125,000 đ"), parseMoney("0"), parseMoney(""), parseMoney("-25.000"), parseMoney("chữ")]).toEqual([1125000, 1125000, 0, 0, -25000, 0]);
    expect([money(1125000), money(0), ddmmyyyy("2026-11-20")]).toEqual(["1.125.000 đ", "0 đ", "20-11-2026"]);
  });

  it("chỉ lấy 12 đội, giữ cả người đã rời lớp, ghi giờ cập nhật của bảng tính", () => {
    const d = parseFund(TONG_HOP);
    expect(d.updatedText).toBe("11:03 20/11/2026");
    expect(d.members.map((m) => m.id)).toEqual(["T0101", "T0102", "T0201", "T0202"]);
    expect(d.skipped).toBe(1);
    expect(d.members[3]).toMatchObject({ status: "Bảo lưu", total: 150000 });
  });

  it("tổng theo đội và toàn lớp; tổng đội cộng lại bằng tổng lớp", () => {
    const s = summarize(parseFund(TONG_HOP).members);
    expect(s.total).toBe(1125000 + 1225000 + 150000);
    expect([s.members, s.paying]).toEqual([4, 3]);
    expect(s.teams.map((t) => [t.team, t.members, t.paying, t.personal, t.byTeam, t.total])).toEqual([
      ["T01", 2, 2, 650000, 1700000, 2350000],
      ["T02", 2, 1, 100000, 50000, 150000],
    ]);
    expect(s.teams.reduce((n, t) => n + t.total, 0)).toBe(s.total);
    expect(s.personal + s.byTeam).toBe(s.total);
    expect(summarize([]).total).toBe(0);
  });

  it("đổi cột đầu bảng thì dừng, không hiện sai", () => {
    const bad = [TONG_HOP[0]!, HEAD.map((h) => (h === "Tổng trừ (đ)" ? "Tổng khác" : h)), TONG_HOP[2]!];
    expect(() => parseFund(bad)).toThrow(/đổi cột/);
    expect(() => parseFund([])).toThrow();
  });
});

async function fakeServiceAccount() {
  const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", kp.privateKey)) as ArrayBuffer);
  const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n");
  return JSON.stringify({ client_email: "doc@du-an-gia.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` });
}
function fakeGoogle(opts: { deny?: boolean } = {}) {
  const calls: { url: string; method: string }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "MA-GIA", expires_in: 3600 });
    if (opts.deny) return json({ error: { code: 403 } }, 403);
    if (url.includes("FILE-KY-LUAT")) return json({ values: TONG_HOP });
    return json({}, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetFundCache();
});

describe("quỹ gieo hạt: trang cho BTC", () => {
  const HUB = "https://nskt-hub.invalid";
  async function setup(extra = {}) {
    const { d1 } = createTestDb();
    const env = testEnv(d1, { SHEET_KYLUAT_ID: "FILE-KY-LUAT", GOOGLE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), ...extra });
    const now = new Date();
    const coachCode = await createUser(d1, { phone: "0900000111", name: "Coach Giả", role: "coach" }, "test", now);
    const psCode = await createUser(d1, { phone: "0900000222", name: "Phụng Sự Giả", role: "phung_su" }, "test", now);
    const call = (path: string, cookie?: string) => app.fetch(new Request(`${HUB}${path}`, { headers: cookie ? { cookie } : {} }), env);
    const login = async (phone: string, code: string) => {
      const res = await app.fetch(new Request(`${HUB}/kich-hoat`, { method: "POST", headers: { origin: HUB }, body: new URLSearchParams({ sdt: phone, ma: code, mk: "matkhau-gia-1", mk2: "matkhau-gia-1" }) }), env);
      return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
    };
    return { env, call, coach: await login("0900000111", coachCode), ps: await login("0900000222", psCode) };
  }

  it("chỉ đọc: Google chỉ bị gọi bằng GET (và lấy mã truy cập)", async () => {
    const { env } = await setup();
    const g = fakeGoogle();
    expect((await loadFund(env, new Date(), g.fetchImpl)).status).toBe("ok");
    expect(g.calls.filter((c) => !c.url.startsWith("https://oauth2.googleapis.com/token")).every((c) => c.method === "GET")).toBe(true);
  });

  it("BTC thấy tổng, theo đội và cá nhân, kèm ngày dd-mm-yyyy; lọc theo đội", async () => {
    const { call, coach } = await setup();
    vi.stubGlobal("fetch", fakeGoogle().fetchImpl);
    const res = await call("/gieo-hat", coach);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("2.500.000 đ"); // tổng lớp
    expect(html).toContain("2.350.000 đ"); // đội 01
    expect(html).toContain("Người Giả Hai");
    expect(html).toContain("Bảo lưu");
    expect(html).toContain("11:03 20/11/2026");
    expect(html).toMatch(/Tính đến ngày <b>\d{2}-\d{2}-\d{4}<\/b>/);
    expect(html).not.toContain("999.999"); // dòng ngoài 12 đội không tính
    const t2 = await (await call("/gieo-hat?doi=T02", coach)).text();
    expect(t2).toContain("Người Giả Bốn");
    expect(t2.split("Theo cá nhân")[1]).not.toContain("Người Giả Một");
  });

  it("chưa đăng nhập hoặc ban phụng sự không xem được", async () => {
    const { call, ps } = await setup();
    const fetchSpy = vi.fn(fakeGoogle().fetchImpl);
    vi.stubGlobal("fetch", fetchSpy);
    expect((await call("/gieo-hat")).status).toBeGreaterThanOrEqual(401);
    expect((await call("/gieo-hat", ps)).status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("chưa cấu hình: báo rõ, không gọi Google; nguồn lỗi: báo bằng lời dễ hiểu", async () => {
    const a = await setup({ SHEET_KYLUAT_ID: undefined });
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r1 = await a.call("/gieo-hat", a.coach);
    expect(r1.status).toBe(503);
    expect(spy).not.toHaveBeenCalled();
    const b = await setup();
    vi.stubGlobal("fetch", fakeGoogle({ deny: true }).fetchImpl);
    const r2 = await b.call("/gieo-hat", b.coach);
    expect(r2.status).toBe(502);
    expect(await r2.text()).toContain("chia sẻ");
  });
});
