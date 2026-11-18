import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { buildDay, buildRoster, loadSource, parseLog, resetSourceCache, roundDay, sessionOf } from "../src/chamcheo/live";
import { createTestDb } from "./helpers/d1";
import { json, testEnv } from "./helpers/fixtures";

// Dữ liệu GIẢ, cùng cấu trúc với trang CHAM_CHEO_LOG thật (theo bản bàn giao của màn hình cũ).
const HEAD = ["Thời gian gửi", "Cập nhật lúc", "Số lần sửa", "Mã đợt", "Tên đợt", "Thôn", "Mã người chấm", "Người chấm", "Mã người được chấm", "Người được chấm",
  "Tóm tắt", "Sơ đồ", "Nhận xét sơ đồ", "Thuyết phục", "Nhận xét thuyết phục", "Phản biện", "Nhận xét phản biện", "Đặt câu hỏi", "Nhận xét đặt câu hỏi", "Điểm TB", "", "", "", "", "Khoá", "Đội nhận"];
const row = (over: Record<number, string>) => {
  const r = Array.from({ length: 26 }, () => "");
  Object.assign(r, { 0: "20/11/2026 19:10:00", 1: "20/11/2026 19:11:34", 2: "1", 3: "CC-20261120", 4: "Buổi 8", 5: "T01", 6: "T0101", 7: "Người Một", 8: "T0102", 9: "Người Hai",
    10: "Hay lắm", 11: "4", 12: "Gọn", 13: "5", 14: "Thuyết phục", 15: "4", 16: "Sắc", 17: "4", 18: "Mở", 19: "4.3", 24: "K1", 25: "T01" }, over);
  return r;
};
const LOG = [
  HEAD,
  row({}),
  row({ 24: "K2", 6: "T0103", 7: "Người Ba", 8: "T0405", 9: "Người Năm", 5: "T01", 25: "T04" }), // liên đội: đội lấy từ mã người
  row({ 24: "K1", 10: "Đã sửa", 2: "2", 1: "20/11/2026 19:30:00" }), // cùng khoá: bản mới nhất
  row({ 24: "K3", 8: "T0101", 9: "Tự chấm" }), // tự chấm
  row({ 24: "K4", 6: "BTC01", 7: "Dòng thử", 8: "T0101", 9: "Người Một" }), // đội không hợp lệ
  row({ 24: "K5", 7: "" }), // thiếu tên
  row({ 24: "K6", 3: "CC-T1", 0: "02/10/2026 19:00:00", 1: "" }), // buổi 1
  row({ 24: "K7", 3: "", 0: "13/11/2026 19:00:00", 1: "" }), // không có mã đợt: lấy ngày từ giờ gửi
  Array.from({ length: 26 }, () => ""), // dòng trống
];
const CHECK_IN = [
  ["Mã Thôn", "Mã Cư Dân", "Họ và Tên", "Khu Vực", "KHAI GIANG", "20-11"],
  ["T01", "T0101", "Người Một", "Hà Nội", "✅", "✅"],
  ["T01", "T0102", "Người Hai", "HCM", "✅", "❌"],
  ["T01", "T0103", "Người Ba", "HCM", "✅", ""],
  ["T04", "T0405", "Người Năm", "Hà Nội", "✅", "M"],
];

describe("màn hình chấm chéo mới: đọc bảng tính", () => {
  it("mã đợt → ngày học, buổi thứ mấy", () => {
    expect([roundDay("CC-T1"), roundDay("CC-20261120"), roundDay("CC-20261399"), roundDay("abc")]).toEqual(["2026-10-02", "2026-11-20", "", ""]);
    expect([sessionOf("2026-10-02"), sessionOf("2026-11-20"), sessionOf("2026-11-21"), sessionOf("2026-09-25")]).toEqual([{ so: 1, tuan: 1 }, { so: 8, tuan: 8 }, null, null]);
  });

  it("lọc dòng sai, gộp cùng khoá, nêu rõ lý do bỏ", () => {
    const p = parseLog(LOG);
    expect(p.total).toBe(8);
    expect(p.records.map((r) => r.khoa)).toEqual(["K1", "K2", "K6", "K7"]);
    expect(p.merged).toBe(1);
    expect(Object.fromEntries(p.dropped.map((d) => [d.lyDo, d.soDong]))).toEqual({
      "Tự chấm chính mình": 1,
      "Mã đội không hợp lệ (ví dụ dòng thử của BTC)": 1,
      "Thiếu mã hoặc tên người chấm / người được chấm": 1,
    });
    const k1 = p.records[0]!;
    expect(k1.tomTat).toBe("Đã sửa");
    expect(k1.gui).toBe("20/11/2026 19:30:00");
    expect(k1.tieuChi.map((c) => [c.ten, c.diem])).toEqual([["Sơ đồ", "4"], ["Thuyết phục", "5"], ["Phản biện", "4"], ["Đặt câu hỏi", "4"]]);
    expect(p.records[1]!.nguoiNhan.doi).toBe("T04"); // đội lấy từ mã người, không từ cột Thôn
    expect(p.records[2]!.ngay).toBe("2026-10-02");
    expect(p.records[3]!.ngay).toBe("2026-11-13");
  });

  it("đổi đầu bảng thì dừng, không hiện sai", () => {
    const bad = [HEAD.map((h, i) => (i === 24 ? "Khác" : h)), row({})];
    expect(() => parseLog(bad)).toThrow(/đổi cột/);
    expect(() => parseLog([])).toThrow();
  });

  it("danh sách đội; vắng chỉ dành cho BTC và chỉ khi cột ngày đã có điểm danh", () => {
    const khach = buildRoster(CHECK_IN, "2026-11-20", false);
    expect(khach.map((d) => [d.ma, d.thanhVien.length])).toEqual([["T01", 3], ["T04", 1]]);
    expect(JSON.stringify(khach)).not.toContain("vang");
    const btc = buildRoster(CHECK_IN, "2026-11-20", true);
    expect(btc[0]!.thanhVien.filter((m) => m.vang).map((m) => m.id)).toEqual(["T0102", "T0103"]);
    expect(buildRoster(CHECK_IN, "2026-11-13", true).flatMap((d) => d.thanhVien).some((m) => m.vang)).toBe(false);
    expect(buildRoster(null, "2026-11-20", true)).toEqual([]);
  });

  it("câu trả lời: khách không thấy kiểm nguồn; BTC thấy", () => {
    const khach = buildDay({ log: LOG, checkIn: CHECK_IN }, "2026-11-20", false);
    expect(khach.luot.map((r) => r.khoa)).toEqual(["K1", "K2"]);
    expect("nguon" in khach).toBe(false);
    expect(khach.buoi).toEqual({ so: 8, tuan: 8 });
    const btc = buildDay({ log: LOG, checkIn: CHECK_IN }, "2026-11-20", true) as { nguon: { tongDong: number; hienThi: number; bo: number; gop: number; trongNgay: number } };
    expect(btc.nguon).toMatchObject({ tongDong: 8, hienThi: 4, bo: 3, gop: 1, trongNgay: 2 });
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
    if (url.includes("FILE-CHAM-CHEO")) return json({ values: LOG });
    if (url.includes("FILE-DIEM-DANH")) return json({ values: CHECK_IN });
    return json({}, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetSourceCache();
});

describe("màn hình chấm chéo mới: đường dẫn dữ liệu", () => {
  const HUB = "https://nskt-hub.invalid";
  async function setup(extra = {}) {
    const { d1 } = await createTestDb();
    return testEnv(d1, { SHEET_CHAMCHEO_ID: "FILE-CHAM-CHEO", SHEET_ATTENDANCE_ID: "FILE-DIEM-DANH", GOOGLE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), ...extra });
  }

  it("chỉ đọc: mọi lệnh gọi Google đều là GET hoặc lấy mã truy cập", async () => {
    const env = await setup();
    const g = fakeGoogle();
    const r = await loadSource(env, new Date("2026-11-20T12:00:00Z"), g.fetchImpl);
    expect(r.status).toBe("ok");
    expect(g.calls.filter((c) => !c.url.startsWith("https://oauth2.googleapis.com/token")).every((c) => c.method === "GET")).toBe(true);
  });

  it("đệm ngắn: hỏi liên tiếp chỉ đọc bảng tính một lần", async () => {
    const env = await setup();
    const g = fakeGoogle();
    const t = new Date("2026-11-20T12:00:00Z");
    await loadSource(env, t, g.fetchImpl);
    const n = g.calls.length;
    await loadSource(env, new Date(t.getTime() + 3000), g.fetchImpl);
    expect(g.calls.length).toBe(n);
    await loadSource(env, new Date(t.getTime() + 20000), g.fetchImpl);
    expect(g.calls.length).toBeGreaterThan(n);
  });

  it("chưa cấu hình: báo 503, không gọi Google", async () => {
    const env = await setup({ SHEET_CHAMCHEO_ID: undefined });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await app.request(`${HUB}/cham-cheo-moi/api/ket-qua?ngay=2026-11-20`, {}, env);
    expect(res.status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("khách xem được không cần đăng nhập, không lộ kiểm nguồn; ngày sai bị từ chối", async () => {
    const env = await setup();
    vi.stubGlobal("fetch", fakeGoogle().fetchImpl);
    const ph = await (await app.request(`${HUB}/cham-cheo-moi/api/phien`, {}, env)).json();
    expect(ph).toEqual({ vaiTro: "khach" });
    const res = await app.request(`${HUB}/cham-cheo-moi/api/ket-qua?ngay=2026-11-20`, {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = (await res.json()) as { luot: unknown[]; nguon?: unknown };
    expect(body.luot).toHaveLength(2);
    expect(body.nguon).toBeUndefined();
    expect((await app.request(`${HUB}/cham-cheo-moi/api/ket-qua?ngay=hom-nay`, {}, env)).status).toBe(400);
  });

  it("nguồn lỗi: báo 502 bằng lời dễ hiểu, không lộ chi tiết", async () => {
    const env = await setup();
    vi.stubGlobal("fetch", fakeGoogle({ deny: true }).fetchImpl);
    const res = await app.request(`${HUB}/cham-cheo-moi/api/ket-qua?ngay=2026-11-20`, {}, env);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).toContain("chia sẻ");
  });
});
