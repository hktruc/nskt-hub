import { describe, expect, it } from "vitest";
import app from "../src/app";
import { headerDay, normalizeCode, normPhone, parseCheckIn, parseRoster, syncOfflineAttendance } from "../src/attendance/offline";
import { rank, type AttRow, type ScoreRow } from "../src/scoring/leaderboard";
import { createTestDb } from "./helpers/d1";
import { json, testEnv } from "./helpers/fixtures";

// Dữ liệu GIẢ, cùng cấu trúc với hai trang Google Sheet thật (đối chiếu 12/11/2026).
const CHECK_IN = [
  ["Mã Thôn", "Mã Cư Dân", "Họ và Tên", "Khu Vực", "KHAI GIANG", "09-10", "16-10", "23-10", "30-10", "13-11", "Σ ✅"],
  ["T01", "T0101", "Người Giả Một", "Hà Nội", "❌", "✅", "M", "✅️", "PD", "", "3"],
  ["T01", "T0102", "Người Giả Hai", "Hà Nội", "✅", "❌", "P", "⚠️", "X", "", "0"],
  ["T02", "T0201", "Người Giả Ba", "Hà Nội", "✅", "✅", "✅", "✅", "✅", "", "5"],
];
const ROSTER = [
  ["Thôn", "Mã Cư Dân", "Họ và Tên", "SĐT cư dân", "Email"],
  ["T01", "T0101", "Người Giả Một", "0900000001", "x@example.invalid"],
  ["T01", "T0102", "Người Giả Hai", "+84 900 000 002", "y@example.invalid"],
  ["T02", "T0201", "Người Giả Ba", "0900000099", "z@example.invalid"], // số không có trên dh3g
];

describe("đọc file điểm danh", () => {
  it("ký hiệu, ngày, số điện thoại", () => {
    expect(["✅", "✅️", " m ", "X", "M1", "⚠️", "P", "PD", "❌", "", "??"].map(normalizeCode)).toEqual([
      "OK", "OK", "M", "X", "M1", "CANH_BAO", "P", "PD", "VANG", null, "KHAC",
    ]);
    expect([headerDay("09-10"), headerDay("25-12"), headerDay("05-01"), headerDay("KHAI GIANG")]).toEqual([
      "2026-10-09", "2026-12-25", "2027-01-05", null,
    ]);
    expect([normPhone("+84 900 000 002"), normPhone("900000002"), normPhone("0900.000.002")]).toEqual(["0900000002", "0900000002", "0900000002"]);
  });

  it("bỏ cột khai giảng, cột tổng và ô trống", () => {
    const { residents, records } = parseCheckIn(CHECK_IN);
    expect(residents).toEqual(["T0101", "T0102", "T0201"]);
    expect(records.filter((r) => r.resident === "T0101")).toEqual([
      { resident: "T0101", day: "2026-10-09", code: "OK" },
      { resident: "T0101", day: "2026-10-16", code: "M" },
      { resident: "T0101", day: "2026-10-23", code: "OK" },
      { resident: "T0101", day: "2026-10-30", code: "PD" },
    ]);
    expect(parseRoster(ROSTER).get("T0102")).toBe("0900000002");
  });
});

describe("điểm xếp hạng có đi học offline", () => {
  const study = (id: number, earned: number): ScoreRow => ({
    learner_id: id, full_name: `HV ${id}`, team_name: "Đội Cá Chép 01", due_at: "2026-11-10T23:00:00",
    earned, max: 10, on_time_videos: 0, hours_early: null, provisional: 0,
  });
  const att = (id: number, ...codes: string[]): AttRow[] =>
    codes.map((code, i) => ({ learner_id: id, session_day: `2026-11-${String(6 - i).padStart(2, "0")}`, code }));
  const TODAY = "2026-11-07T08:00:00";

  it("50% bài tập + 50% đi học; vắng học qua Zoom kéo điểm xuống", () => {
    const { ranked } = rank([study(1, 10), study(2, 10), study(3, 10)], TODAY, [...att(1, "OK", "OK"), ...att(2, "OK", "VANG"), ...att(3, "P", "PD")]);
    const of = (id: number) => ranked.find((r) => r.learnerId === id)!;
    expect([of(1).percent, of(1).attendancePercent, of(1).color]).toEqual([100, 100, "xanh"]);
    expect([of(2).percent, of(2).attendancePercent, of(2).color]).toEqual([75, 50, "vang"]);
    // PD không tính; P được 30%.
    expect([of(3).percent, of(3).attendancePercent]).toEqual([65, 30]);
  });

  it("chưa có điểm danh thì chỉ tính bài tập; bằng điểm thì ai đi đúng giờ nhiều hơn xếp trên", () => {
    const { ranked } = rank([study(1, 8), study(2, 8), study(3, 8)], TODAY, [...att(1, "M", "M1", "OK"), ...att(2, "X", "OK", "M")]);
    expect(ranked.find((r) => r.learnerId === 3)).toMatchObject({ percent: 80, attendancePercent: null });
    // HV1: (0.7+0.4+1)/3 = 70% → 75%; HV2: (0.6+1+0.7)/3 ≈ 76,7% → 78,3%.
    expect(ranked.map((r) => [r.learnerId, r.percent])).toEqual([[3, 80], [2, 78.3], [1, 75]]);
  });
});

async function fakeServiceAccount() {
  const kp = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", kp.privateKey)) as ArrayBuffer);
  const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n");
  return JSON.stringify({ client_email: "doc-diem-danh@du-an-gia.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` });
}

function fakeGoogle(opts: { deny?: boolean } = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      expect(String(init?.body)).toContain("grant_type=urn");
      return json({ access_token: "MA-GIA", expires_in: 3600 });
    }
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer MA-GIA");
    if (opts.deny) return json({ error: { code: 403 } }, 403);
    if (url.includes("FILE-DIEM-DANH")) return json({ values: CHECK_IN });
    if (url.includes("FILE-CHIA-THON")) return json({ values: ROSTER });
    return json({}, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

async function setup(extra = {}) {
  const { d1, raw } = createTestDb();
  const iso = "2026-11-01T00:00:00Z";
  raw.prepare("INSERT INTO teams (id, name, first_seen_at, last_seen_at) VALUES (1, 'Đội Cá Chép 01', ?, ?)").run(iso, iso);
  for (const [id, phone] of [[11, "0900000001"], [12, "0900000002"]] as const) {
    raw.prepare("INSERT INTO learners (id, full_name, phone, team_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, 1, ?, ?)").run(id, `Học Viên ${id}`, phone, iso, iso);
    raw.prepare(
      "INSERT INTO scores (learner_id, assignment_id, due_at, earned, max, on_time_videos, hours_early, provisional, flags_json, detail_json, computed_at) VALUES (?, 1, '2026-11-05T23:00:00', 6, 6, 0, NULL, 0, '[]', '[]', ?)",
    ).run(id, iso);
  }
  const env = testEnv(d1, { SHEET_ATTENDANCE_ID: "FILE-DIEM-DANH", SHEET_ROSTER_ID: "FILE-CHIA-THON", GOOGLE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount(), ...extra });
  return { env, raw };
}

describe("đồng bộ điểm danh từ Google Sheet", () => {
  const NOW = new Date("2026-11-12T01:00:00Z");

  it("chưa có khóa Google thì không làm gì", async () => {
    const { env } = await setup({ GOOGLE_SERVICE_ACCOUNT_JSON: undefined });
    expect(await syncOfflineAttendance(env, NOW, fakeGoogle().fetchImpl)).toEqual({ status: "chua-cau-hinh" });
  });

  it("ghép qua số điện thoại, ghi lại Mã Cư Dân chưa ghép được, bảng xếp hạng tính đi học", async () => {
    const { env, raw } = await setup();
    const g = fakeGoogle();
    const r = await syncOfflineAttendance(env, NOW, g.fetchImpl);
    expect(r).toEqual({ status: "ok", sessions: 4, residents: 3, matched: 2, unmatched: ["T0201"], byName: [], rows: 8 });
    expect(raw.prepare("SELECT code, COUNT(*) n FROM offline_attendance WHERE learner_id = 12 GROUP BY code ORDER BY code").all()).toEqual([
      { code: "CANH_BAO", n: 1 }, { code: "P", n: 1 }, { code: "VANG", n: 1 }, { code: "X", n: 1 },
    ]);
    // Chạy lại không nhân đôi dữ liệu.
    await syncOfflineAttendance(env, NOW, g.fetchImpl);
    expect(raw.prepare("SELECT COUNT(*) n FROM offline_attendance").get()).toEqual({ n: 8 });

    const html = await (await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang"), env)).text();
    expect(html).toContain("50% bài tập + 50% đi học offline");
    expect(html).not.toContain("Chưa có dữ liệu điểm danh");
    const detail = await (await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang/hv/12?p=1"), env)).text();
    expect(detail).toContain("Đi học offline");
    expect(detail).toContain("2/4"); // có mặt 2/4 buổi (⚠️ và X); vắng 1, có phép 1
    expect(detail).not.toContain("0900000002");
    expect(detail).not.toContain("T0102");
  });

  it("số điện thoại khác dh3g: ghép theo họ tên, chỉ trong cùng đội và chỉ khi trùng đúng một người", async () => {
    const { env, raw } = await setup();
    const iso = "2026-11-01T00:00:00Z";
    raw.prepare("INSERT INTO teams (id, name, first_seen_at, last_seen_at) VALUES (2, 'Đội Cá Chép 02', ?, ?)").run(iso, iso);
    // Người Giả Ba (T0201) đăng nhập dh3g bằng số cũ; tên trên dh3g viết hoa, không dấu cách thừa.
    raw.prepare("INSERT INTO learners (id, full_name, phone, team_id, first_seen_at, last_seen_at) VALUES (21, 'NGƯỜI GIẢ  BA', '0911111111', 2, ?, ?)").run(iso, iso);
    // Trùng tên nhưng khác đội: không được ghép.
    raw.prepare("INSERT INTO learners (id, full_name, phone, team_id, first_seen_at, last_seen_at) VALUES (31, 'Người Giả Một', '0922222222', 1, ?, ?)").run(iso, iso);
    const r = await syncOfflineAttendance(env, NOW, fakeGoogle().fetchImpl);
    expect(r).toMatchObject({ status: "ok", matched: 3, unmatched: [], byName: ["T0201"] });
    expect(raw.prepare("SELECT COUNT(*) n FROM offline_attendance WHERE learner_id = 21").get()).toEqual({ n: 4 });
    expect(raw.prepare("SELECT COUNT(*) n FROM offline_attendance WHERE learner_id = 31").get()).toEqual({ n: 0 });

    // Hai người cùng tên trong đội: không đoán.
    raw.prepare("INSERT INTO learners (id, full_name, phone, team_id, first_seen_at, last_seen_at) VALUES (22, 'Nguoi Gia Ba', '0933333333', 2, ?, ?)").run(iso, iso);
    raw.prepare("INSERT INTO learners (id, full_name, phone, team_id, first_seen_at, last_seen_at) VALUES (23, 'Người Giả Ba', '0944444444', 2, ?, ?)").run(iso, iso);
    const r2 = await syncOfflineAttendance(env, NOW, fakeGoogle().fetchImpl);
    expect(r2).toMatchObject({ status: "ok", unmatched: ["T0201"], byName: [] });
    const page = await (await app.fetch(new Request("http://localhost/du-lieu"), { ...env, LOCAL_DEV_NO_AUTH: "true" })).text();
    expect(page).toContain("T0201");
  });

  it("file chưa chia sẻ cho tài khoản dịch vụ: ghi lỗi dễ hiểu, giữ nguyên dữ liệu cũ", async () => {
    const { env, raw } = await setup();
    await syncOfflineAttendance(env, NOW, fakeGoogle().fetchImpl);
    const r = await syncOfflineAttendance(env, NOW, fakeGoogle({ deny: true }).fetchImpl);
    expect(r.status).toBe("loi");
    expect(r.status === "loi" && r.message).toContain("chia sẻ");
    expect(raw.prepare("SELECT COUNT(*) n FROM offline_attendance").get()).toEqual({ n: 8 });
    expect(raw.prepare("SELECT status FROM sheet_syncs ORDER BY id DESC LIMIT 1").get()).toEqual({ status: "loi" });
  });
});

describe("trang tình trạng dữ liệu", () => {
  it("chỉ đếm học viên và đội thuộc 12 đội; người khác trong cộng đồng đếm riêng", async () => {
    const { env, raw } = await setup();
    const iso = "2026-11-01T00:00:00Z";
    raw.prepare("INSERT INTO teams (id, name, first_seen_at, last_seen_at) VALUES (99, 'BTC', ?, ?)").run(iso, iso);
    raw.prepare("INSERT INTO learners (id, full_name, team_id, first_seen_at, last_seen_at) VALUES (90, 'Người BTC', 99, ?, ?)").run(iso, iso);
    raw.prepare("INSERT INTO learners (id, full_name, team_id, first_seen_at, last_seen_at) VALUES (91, 'Người đã nghỉ', NULL, ?, ?)").run(iso, iso);
    await syncOfflineAttendance(env, new Date("2026-11-12T01:00:00Z"), fakeGoogle().fetchImpl);
    const html = await (await app.fetch(new Request("http://localhost/du-lieu"), { ...env, LOCAL_DEV_NO_AUTH: "true" })).text();
    const tile = (label: string) => html.match(new RegExp(`<div class="num">([\\d.]+)</div><div class="lbl">${label.replace(/[()]/g, "\\$&")}`))?.[1];
    expect(tile("Học viên (12 đội)")).toBe("2");
    expect(tile("Người khác trong cộng đồng dh3g")).toBe("2");
    expect(tile("Đội học viên")).toBe("1"); // đội BTC không tính
    expect(tile("Buổi học offline")).toBe("4");
  });
});
