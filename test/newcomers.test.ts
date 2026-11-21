import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../src/app";
import { parseMemberHistory, syncMemberHistory } from "../src/members/history";
import { loadLeaderboard, loadLearnerDetail } from "../src/scoring/leaderboard";
import { applyMembership, membershipOf } from "../src/scoring/newcomers";
import { teamAwards } from "../src/scoring/team-awards";
import { createTestDb } from "./helpers/d1";
import { json, testEnv } from "./helpers/fixtures";

// Dữ liệu GIẢ hoàn toàn. Quy tắc: khai giảng 29/09, ân hạn 2 ngày, 6 tuần (42 ngày) mới xếp hạng, người rời bị bỏ.
const TODAY = "2026-11-20";

describe("quy tắc người vào sau khai giảng", () => {
  it("ngày bắt đầu tính, ngày được xếp hạng, còn bao nhiêu ngày", () => {
    const late = membershipOf({ learner_id: 1, joined_at: "2026-10-10 20:32", left_at: null }, TODAY).late!;
    expect(late).toMatchObject({ joinedDay: "2026-10-10", start: "2026-10-13", eligibleOn: "2026-11-21", newcomer: true, daysLeft: 1 });
    // Ngày vào là "mới vào lớp", 2 ngày sau là ân hạn, từ ngày kế tiếp mới tính.
    expect(membershipOf({ learner_id: 1, joined_at: "2026-10-10 20:32", left_at: null }, "2026-11-21").late!.newcomer).toBe(false);
    expect(membershipOf({ learner_id: 2, joined_at: "2026-09-21 10:00", left_at: null }, TODAY).late).toBeNull(); // vào trước khai giảng
    expect(membershipOf({ learner_id: 3, joined_at: "2026-09-28 15:47", left_at: null }, TODAY).late).toBeNull(); // 28/09: trước khai giảng miền Bắc
    expect(membershipOf({ learner_id: 4, joined_at: "2026-09-07 16:04", left_at: "2026-10-09 17:32" }, TODAY).left).toBe(true);
    expect(membershipOf({ learner_id: 4, joined_at: "2026-09-07 16:04", left_at: "2026-12-01 10:00" }, TODAY).left).toBe(false); // rời trong tương lai: chưa rời
  });

  it("lọc bài và buổi trước ngày bắt đầu, bỏ người rời, đánh dấu người mới vào", () => {
    const rows = [
      { learner_id: 1, due_at: "2026-10-05T23:00:00" },
      { learner_id: 1, due_at: "2026-10-13T23:00:00" },
      { learner_id: 2, due_at: "2026-10-05T23:00:00" },
      { learner_id: 3, due_at: "2026-10-20T23:00:00" },
    ];
    const att = [
      { learner_id: 1, session_day: "2026-10-09" },
      { learner_id: 1, session_day: "2026-10-16" },
      { learner_id: 3, session_day: "2026-10-16" },
    ];
    const members = [
      { learner_id: 1, joined_at: "2026-10-10 20:32", left_at: null },
      { learner_id: 3, joined_at: "2026-09-07 16:04", left_at: "2026-10-09 10:00" },
    ];
    const r = applyMembership(rows, att, members, TODAY);
    expect(r.rows.map((x) => [x.learner_id, x.due_at.slice(5, 10)])).toEqual([[1, "10-13"], [2, "10-05"]]);
    expect(r.att).toEqual([{ learner_id: 1, session_day: "2026-10-16" }]);
    expect([...r.newcomers]).toEqual([1]);
    expect([...r.leavers]).toEqual([3]);
  });
});

describe("đọc tab THANH_VIEN", () => {
  const HEAD = ["Khoá", "Mã Cư Dân", "Họ và Tên", "Thôn", "Vào lúc", "Rời lúc", "Ghi chú"];
  it("gộp nhiều dòng của một số điện thoại: ngày vào là lần đầu, ngày rời theo dòng cuối", () => {
    const spans = parseMemberHistory([
      HEAD,
      ["0900000001", "T0603", "A", "T06", "2026-10-10 20:32", "2026-10-10 20:47", "chuyển sang T05"],
      ["0900000001", "T0514", "A", "T05", "2026-10-10 20:47", "2026-11-03 16:32", "chuyển sang T01"],
      ["0900000001", "T0101", "A", "T01", "2026-11-03 16:32", "", "chuyển từ T05"],
      ["900000002", "T0104", "B", "T01", "2026-09-07 16:04", "2026-10-20 08:47", "rời danh sách"],
      ["", "T0999", "Dòng lỗi", "T09", "2026-09-07 16:04"],
    ]);
    const a = spans.find((s) => s.phone === "0900000001")!;
    expect(a).toMatchObject({ code: "T0101", joinedAt: "2026-10-10 20:32", leftAt: null });
    expect(spans.find((s) => s.phone === "0900000002")).toMatchObject({ joinedAt: "2026-09-07 16:04", leftAt: "2026-10-20 08:47" }); // 9 số: thêm số 0 đầu
    expect(spans).toHaveLength(2);
  });
  it("đổi cột đầu bảng thì dừng", () => {
    expect(() => parseMemberHistory([["Cột lạ", "Mã Cư Dân"], ["x"]])).toThrow();
  });
});

afterEach(() => vi.useRealTimers());

// ---- Bảng xếp hạng với cơ sở dữ liệu giả ----
const t = "2026-11-01T00:00:00Z";
async function setup() {
  const { d1, raw } = createTestDb();
  raw.exec(`
    INSERT INTO teams VALUES (1,'🐟 Đội Cá Chép 01','${t}','${t}'), (2,'🐟 Đội Cá Chép 02','${t}','${t}');
    INSERT INTO learners VALUES
      (1,'Học Viên Từ Đầu',  '0900000001',NULL,1,1,'${t}','${t}'),
      (2,'Học Viên Mới Vào', '0900000002',NULL,1,1,'${t}','${t}'),
      (3,'Học Viên Vào Sau Đủ 6 Tuần','0900000003',NULL,1,2,'${t}','${t}'),
      (4,'Học Viên Đã Rời',  '0900000004',NULL,1,2,'${t}','${t}'),
      (5,'Học Viên Khác',    '0900000005',NULL,1,2,'${t}','${t}'),
      (6,'Học Viên Vừa Vào', '0900000006',NULL,1,1,'${t}','${t}'),
      (7,'Học Viên Chỉ Có Điểm Danh','0900000007',NULL,1,1,'${t}','${t}');
    INSERT INTO assignments (id,title,type,due_at,first_seen_at,last_seen_at) VALUES
      (10,'Bài 1','NORMAL','2026-10-02T23:00:00','${t}','${t}'), (11,'Bài 2','NORMAL','2026-11-12T23:00:00','${t}','${t}'),
      (12,'Bài 3','NORMAL','2026-11-18T23:00:00','${t}','${t}');
  `);
  // Điểm: học viên 2 và 3 vào muộn nên các bài trước ngày vào đang bị tính 0 (như hệ thống hiện tại).
  const sc = (l: number, a: number, due: string, earned: number) =>
    `(${l},${a},'${due}',${earned},3,0,NULL,0,'[]','{}','${t}')`;
  raw.exec(`INSERT INTO scores VALUES
    ${[1, 4, 5].flatMap((l) => [sc(l, 10, "2026-10-02T23:00:00", 3), sc(l, 11, "2026-11-12T23:00:00", 3), sc(l, 12, "2026-11-18T23:00:00", 2)]).join(",")},
    ${sc(2, 10, "2026-10-02T23:00:00", 0)}, ${sc(2, 11, "2026-11-12T23:00:00", 0)}, ${sc(2, 12, "2026-11-18T23:00:00", 3)},
    ${sc(3, 10, "2026-10-02T23:00:00", 0)}, ${sc(3, 11, "2026-11-12T23:00:00", 3)}, ${sc(3, 12, "2026-11-18T23:00:00", 3)};`);
  raw.exec(`INSERT INTO member_history (phone, learner_id, joined_at, left_at, last_code, synced_at) VALUES
    ('0900000002', 2, '2026-11-10 09:00', NULL, 'T0102', '${t}'),
    ('0900000003', 3, '2026-10-01 09:00', NULL, 'T0203', '${t}'),
    ('0900000004', 4, '2026-09-07 16:04', '2026-11-01 08:00', 'T0204', '${t}'),
    ('0900000006', 6, '2026-11-19 09:00', NULL, 'T0106', '${t}'),
    ('0900000007', 7, '2026-11-15 09:00', NULL, 'T0107', '${t}');
  INSERT INTO offline_attendance (learner_id, session_day, code, resident_code, region, synced_at) VALUES (7, '2026-11-20', 'OK', 'T0107', 'HN', '${t}');`);
  return { d1, raw };
}

describe("bảng xếp hạng có quy tắc người vào sau", () => {
  it("người đã rời bị bỏ; người mới vào có bảng riêng và không có trong bảng chính", async () => {
    const { d1 } = await setup();
    const lb = await loadLeaderboard(d1, TODAY);
    expect(lb.ranked.map((r) => r.learnerId).sort()).toEqual([1, 3, 5]); // 2 mới vào, 4 đã rời
    expect(lb.newcomers.map((n) => n.learnerId)).toEqual([2, 7, 6]); // xếp theo ngày được vào bảng chính (còn ít ngày hơn xếp trước)
    const n2 = lb.newcomers.find((n) => n.learnerId === 2)!;
    expect(n2).toMatchObject({ joinedDay: "2026-11-10", eligibleOn: "2026-12-22", daysLeft: 32 });
    // Người mới vào chỉ tính từ 13/11 (ngày vào 10/11 + ân hạn 2 ngày): chỉ còn bài 3 → 100%, không bị phạt bài trước ngày vào.
    expect(n2.studyPercent).toBe(100);
  });

  it("người mới vào chưa có bài nào được tính vẫn hiện trên bảng (không biến mất)", async () => {
    const { d1 } = await setup();
    const lb = await loadLeaderboard(d1, TODAY);
    // 6: vào 19/11, điểm tính từ 22/11 → chưa có bài hay buổi nào được tính.
    expect(lb.newcomers.find((n) => n.learnerId === 6)).toMatchObject({ noData: true, noStudy: true, start: "2026-11-22", eligibleOn: "2026-12-31", daysLeft: 41, team: "T01" });
    // 7: chỉ có điểm danh → điểm tạm tính lấy từ điểm danh, bài tập chưa có.
    expect(lb.newcomers.find((n) => n.learnerId === 7)).toMatchObject({ noStudy: true, noData: false, percent: 100, attendancePercent: 100 });
    const detail = (await loadLearnerDetail(d1, 6, TODAY))!;
    expect(detail.me.noData).toBe(true);
    expect(detail.membership).toMatchObject({ newcomer: true });
  });

  it("người vào sau đủ 6 tuần: xếp hạng bình thường, không bị phạt bài trước ngày vào, có ghi chú rê chuột", async () => {
    const { d1 } = await setup();
    const lb = await loadLeaderboard(d1, TODAY);
    const me = lb.ranked.find((r) => r.learnerId === 3)!;
    expect(me.studyPercent).toBe(100); // bài 1 (trước ngày vào 01/10 + ân hạn = 04/10) không tính
    expect(lb.late[3]).toEqual({ joinedDay: "2026-10-01", eligibleOn: "2026-11-12" });
    expect(lb.late[1]).toBeUndefined(); // người từ đầu: không có ghi chú
  });

  it("điểm đội chỉ tính người đủ điều kiện; danh hiệu tuần không đếm người mới vào", async () => {
    const { d1 } = await setup();
    const lb = await loadLeaderboard(d1, TODAY);
    const t01 = lb.ranked.filter((r) => r.team === "T01");
    expect(t01.map((r) => r.learnerId)).toEqual([1]); // học viên 2 (mới vào) chưa tính vào đội 01
    const awards = await teamAwards(d1, TODAY, lb.ranked);
    expect(Array.isArray(awards)).toBe(true);
  });

  it("chi tiết người mới vào: có điểm riêng, chưa có hạng; người đã rời không có trang", async () => {
    const { d1 } = await setup();
    const d = (await loadLearnerDetail(d1, 2, TODAY))!;
    expect(d.me.rank).toBe(0);
    expect(d.membership).toMatchObject({ newcomer: true, daysLeft: 32, start: "2026-11-13" });
    expect(d.due).toBe(1); // chỉ bài hạn sau ngày bắt đầu
    expect(await loadLearnerDetail(d1, 4, TODAY)).toBeNull();
    const ok = (await loadLearnerDetail(d1, 3, TODAY))!;
    expect(ok.membership).toMatchObject({ newcomer: false, eligibleOn: "2026-11-12" });
  });

  it("chưa có lịch sử thành viên (chưa đồng bộ): tính như trước, mọi người đều xếp hạng", async () => {
    const { d1, raw } = await setup();
    raw.exec("DELETE FROM member_history");
    const lb = await loadLeaderboard(d1, TODAY);
    expect(lb.ranked).toHaveLength(5);
    expect(lb.newcomers).toHaveLength(0);
  });

  it("trang công khai: bảng Mới vào ở cuối, chú thích rê chuột, không lộ số điện thoại", async () => {
    const { d1 } = await setup();
    const env = testEnv(d1);
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-20T05:00:00Z") }); // ngày hôm nay của bản mô phỏng
    const res = await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang"), env);
    const html = await res.text();
    expect(html).toContain("Mới vào · chưa xếp hạng");
    expect(html).toContain("Có 3 thành viên mới vào"); // lời nhắc ở đầu trang
    expect(html).toContain("Chưa có bài tập hay buổi học nào được tính (điểm tính từ ngày 22/11/2026)"); // chú thích rê chuột của người chưa có điểm
    expect(html).toContain("Điểm tích lũy tạm tính: 100% (bài tập 100%, đi học chưa có). Được đưa vào bảng xếp hạng chính từ ngày 22/12/2026 (còn 32 ngày)");
    expect(html).toContain("còn 32 ngày");
    expect(html).toContain("22/12/2026");
    expect(html).toContain("Vào lớp ngày 01/10/2026 (sau khai giảng), được đưa vào bảng xếp hạng từ ngày 12/11/2026");
    expect(html.indexOf("Mới vào · chưa xếp hạng")).toBeGreaterThan(html.indexOf("Học Viên Từ Đầu"));
    expect(html).not.toContain("Học Viên Đã Rời");
    expect(html).not.toContain("0900000002");
    const detail = await (await app.fetch(new Request("https://nskt-hub.invalid/bang-xep-hang/hv/2"), env)).text();
    expect(detail).toContain("mới vào, chưa xếp hạng");
    expect(detail).toContain("Vào lớp ngày 10/11/2026, còn 32 ngày nữa (22/12/2026)");
  });
});

describe("đồng bộ lịch sử thành viên từ Google Sheet", () => {
  async function fakeServiceAccount() {
    const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
    const der = new Uint8Array((await crypto.subtle.exportKey("pkcs8", kp.privateKey)) as ArrayBuffer);
    const b64 = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, "$1\n");
    return JSON.stringify({ client_email: "doc@du-an-gia.iam.gserviceaccount.com", private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n` });
  }
  const SHEET = [
    ["Khoá", "Mã Cư Dân", "Họ và Tên", "Thôn", "Vào lúc", "Rời lúc", "Ghi chú"],
    ["0900000002", "T0102", "A", "T01", "2026-11-10 09:00", "", ""],
    ["0900000099", "T0999", "Không khớp", "T09", "2026-11-10 09:00", "", ""],
  ];
  it("ghép theo số điện thoại, ghi vào member_history, chỉ đọc Google", async () => {
    const { d1, raw } = await setup();
    raw.exec("DELETE FROM member_history");
    const env = testEnv(d1, { SHEET_KYLUAT_ID: "FILE-KY-LUAT", GOOGLE_SERVICE_ACCOUNT_JSON: await fakeServiceAccount() });
    const methods: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.startsWith("https://oauth2.googleapis.com/token")) methods.push(init?.method ?? "GET");
      if (url.startsWith("https://oauth2.googleapis.com/token")) return json({ access_token: "MA-GIA" });
      return json({ values: SHEET });
    }) as typeof fetch;
    const r = await syncMemberHistory(env, new Date("2026-11-20T05:00:00Z"), fetchImpl);
    expect(r).toMatchObject({ status: "ok", members: 2, matched: 1, late: 2, left: 0 });
    expect(methods.every((m) => m === "GET")).toBe(true);
    const rows = raw.prepare("SELECT phone, learner_id FROM member_history ORDER BY phone").all() as { phone: string; learner_id: number | null }[];
    expect(rows).toEqual([{ phone: "0900000002", learner_id: 2 }, { phone: "0900000099", learner_id: null }]);
    expect(await syncMemberHistory(testEnv(d1), new Date(), fetchImpl)).toEqual({ status: "chua-cau-hinh" });
  });
});
