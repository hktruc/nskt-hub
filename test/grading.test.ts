import { describe, expect, it } from "vitest";
import app from "../src/app";
import { weekScore, qualityOf } from "../src/grading/rubric";
import { extractItems } from "../src/grading/store";
import { createUser } from "../src/users/accounts";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

// Dữ liệu GIẢ: một bài tuần, hai đội, link video / ảnh giả.
const ORIGIN = "https://nskt-hub.invalid";
const Q = [
  "Kể lại 4 câu chuyện (nộp link video)",
  "Đúc kết công thức kể chuyện (nộp ảnh sơ đồ)",
  "Viết nhật ký đúc kết của bạn",
  "Bạn có khó khăn & câu hỏi gì đến BTC?",
];
const SPEC = {
  type: "WEEK",
  questions: [
    { kind: "video", max: 20, expectedVideos: 2 },
    { kind: "bat-buoc", max: 3 },
    { kind: "bat-buoc", max: 3 },
    { kind: "gop-y", max: 1 },
  ],
};
const answers = (v: string[], img: string) =>
  JSON.stringify([
    { question: Q[0], type: "Tự luận", answer: v.join("\n") },
    { question: Q[1], type: "Tự luận", answer: img },
    { question: Q[2], type: "Tự luận", answer: "Em học được cách lắng nghe sâu khi kể chuyện." },
    { question: Q[3], type: "Tự luận", answer: "Mong BTC gửi slide sớm https://youtu.be/khongcham" },
  ]);

async function setup() {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1, { ACCESS_TEAM_DOMAIN: "nhom-gia.cloudflareaccess.com", ACCESS_AUD: "aud-gia" });
  const iso = "2026-11-01T00:00:00Z";
  raw.prepare("INSERT INTO teams (id, name, first_seen_at, last_seen_at) VALUES (3, 'Đội Cá Chép 03', ?, ?), (4, 'Đội Cá Chép 04', ?, ?)").run(iso, iso, iso, iso);
  raw.prepare("INSERT INTO assignments (id, title, type, due_at, first_seen_at, last_seen_at) VALUES (900, 'Bài tuần 05 (X10)', 'WEEK', '2026-11-08T23:00:00', ?, ?)").run(iso, iso);
  raw.prepare("INSERT INTO assignment_specs (assignment_id, questions_hash, spec_json, updated_at, checked_at) VALUES (900, 'h', ?, ?, ?)").run(JSON.stringify(SPEC), iso, iso);
  const learner = (id: number, team: number, status: string, ans: string | null) => {
    raw.prepare("INSERT INTO learners (id, full_name, phone, team_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, `Học Viên ${id}`, `09000${id}`, team, iso, iso);
    raw.prepare(
      "INSERT INTO submissions (learner_id, assignment_id, status, submitted_at, answers_json, answers_hash, content_hash, first_seen_at, changed_at, last_seen_at) VALUES (?, 900, ?, '2026-11-08T20:00:00', ?, ?, 'c', ?, ?, ?)",
    ).run(id, status, ans, ans ? `h${id}` : null, iso, iso, iso);
  };
  learner(31, 3, "DONE", answers(["https://youtu.be/aaaaaaaaaaa", "https://www.tiktok.com/@gia/video/1"], "https://s3.sunteco.app/f/sodo.jpg"));
  learner(32, 3, "OVERDUE", answers(["https://youtu.be/bbbbbbbbbbb"], "https://s3.sunteco.app/f/sodo.pdf"));
  learner(33, 3, "NOT_SUBMITTED", null);
  learner(41, 4, "DONE", answers(["https://youtu.be/ccccccccccc"], ""));
  const now = new Date();
  const ps = await createUser(d1, { phone: "0911000001", name: "Phụng Sự Giả", role: "phung_su" }, "test", now);
  const coach = await createUser(d1, { phone: "0911000002", name: "Coach Giả", role: "coach" }, "test", now);
  const psId = (raw.prepare("SELECT id FROM users WHERE phone='0911000001'").get() as { id: number }).id;
  raw.prepare("INSERT INTO grader_teams (user_id, team_code, assigned_at) VALUES (?, 'T03', ?)").run(psId, iso);
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const h = new Headers(init.headers);
    if (init.cookie) h.set("cookie", init.cookie);
    if (init.method === "POST") h.set("origin", ORIGIN);
    return app.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers: h }), env);
  };
  const login = async (phone: string, code: string) => {
    const f = new URLSearchParams({ sdt: phone, ma: code, mk: "matkhau-gia-1", mk2: "matkhau-gia-1" });
    const res = await call("/kich-hoat", { method: "POST", body: f });
    return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
  };
  return { raw, call, psCookie: await login("0911000001", ps), coachCookie: await login("0911000002", coach) };
}

const fullSheet = (o: Record<string, string> = {}) =>
  new URLSearchParams({
    hv: "31", bt: "900",
    k0: "0:https://youtu.be/aaaaaaaaaaa", t0: "video", a1_0: "5", a2_0: "4", a3_0: "4", a4_0: "5", f_0: "",
    k1: "0:https://www.tiktok.com/@gia/video/1", t1: "video", f_1: "khong-xem-duoc",
    k2: "1:https://s3.sunteco.app/f/sodo.jpg", t2: "so-do", a5_2: "3", f_2: "",
    b1: "4", b2: "4", spirit: "nghiem-tuc", progress: "tien-bo", comment: "", featured: "0:https://youtu.be/aaaaaaaaaaa",
    ...o,
  });

describe("bộ tiêu chí và cách tính điểm tuần", () => {
  it("tách từng video / sơ đồ thành thẻ riêng; bỏ câu góp ý BTC", () => {
    const items = extractItems(JSON.parse(answers(["https://youtu.be/x1", "https://fb.watch/y2"], "https://s3.sunteco.app/f/a.png https://s3.sunteco.app/f/b.pdf")), SPEC as never);
    expect(items.map((i) => [i.kind, i.qIndex])).toEqual([["video", 0], ["video", 0], ["so-do", 1], ["so-do", 1]]);
  });

  it("60% phần riêng + 40% phần chung; thẻ bị đánh dấu không tính; đối phó luôn cần kèm", () => {
    const s = weekScore([{ kind: "video", a1: 5, a2: 4, a3: 4, a4: 5 }, { kind: "video", flag: "khong-xem-duoc" }, { kind: "so-do", a5: 3 }], 4, 4);
    // riêng = (4,5 + 3)/2 = 3,75 → 0,6×3,75 + 0,4×4 = 3,85 → 3,9
    expect(s).toBe(3.9);
    expect(qualityOf(s)).toBe("kha");
    expect(qualityOf(4.6, "doi-pho")).toBe("can-kem");
    expect(weekScore([], 5, 3)).toBe(4);
  });
});

describe("bàn chấm", () => {
  it("ban phụng sự chỉ thấy đội được giao; chấm xong chuyển sang người tiếp theo", async () => {
    const { raw, call, psCookie } = await setup();
    const q = await (await call("/cham", { cookie: psCookie })).text();
    expect(q).toContain("Học Viên 31");
    expect(q).toContain("Học Viên 33"); // chưa nộp vẫn hiện để không sót
    expect(q).not.toContain("Học Viên 41"); // đội 04 không được giao
    expect((await call("/cham/bai?hv=41&bt=900", { cookie: psCookie })).status).toBe(403);

    const sheet = await (await call("/cham/bai?hv=31&bt=900", { cookie: psCookie })).text();
    expect(sheet).toContain("Thẻ 1: Video");
    expect(sheet).toContain("Thẻ 3: Sơ đồ");
    expect(sheet).toContain("Mở ảnh to");
    expect(sheet).not.toContain("Thẻ 4"); // link trong câu góp ý BTC không thành thẻ chấm
    expect(sheet).toContain("Góp ý cho BTC (1 câu, không chấm)");
    expect(sheet).not.toContain("AI gợi ý"); // chưa chấm thì không hiện gợi ý AI

    const saved = await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet() });
    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe("/cham/bai?hv=32&bt=900");
    expect(raw.prepare("SELECT score, spirit, grader_label FROM week_reviews WHERE learner_id=31").get()).toMatchObject({ score: 3.9, spirit: "nghiem-tuc" });
    expect(raw.prepare("SELECT item_key, a1, flag FROM item_reviews WHERE learner_id=31 ORDER BY item_key").all()).toEqual([
      { item_key: "0:https://www.tiktok.com/@gia/video/1", a1: null, flag: "khong-xem-duoc" },
      { item_key: "0:https://youtu.be/aaaaaaaaaaa", a1: 5, flag: null },
      { item_key: "1:https://s3.sunteco.app/f/sodo.jpg", a1: null, flag: null },
    ]);
  });

  it("thiếu sao, hoặc điểm thấp / đối phó mà không nhận xét: báo lỗi, giữ lại những gì đã chọn", async () => {
    const { raw, call, psCookie } = await setup();
    const missing = await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet({ a2_0: "" }) });
    expect(missing.status).toBe(400);
    const html = await missing.text();
    expect(html).toContain("Thẻ 1 (video) chưa chấm đủ sao");
    expect(html).toMatch(/name="a1_0" value="5" checked/);
    const low = await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet({ spirit: "doi-pho" }) });
    expect(await low.text()).toContain("cần viết nhận xét");
    expect(raw.prepare("SELECT COUNT(*) n FROM week_reviews").get()).toEqual({ n: 0 });
  });

  it("coach thấy mọi đội, tô màu theo chất lượng, đổi được trọng tâm tuần; ban phụng sự thì không", async () => {
    const { call, psCookie, coachCookie } = await setup();
    await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet() });
    const q = await (await call("/cham", { cookie: coachCookie })).text();
    expect(q).toContain("Học Viên 41");
    expect(q).toMatch(/class="rank-row q-row vang"[^>]*title="Người chấm: Phụng Sự Giả/);
    expect((await call("/cham/trong-tam", { method: "POST", cookie: psCookie, body: new URLSearchParams({ bt: "900", tt: "Kèm cặp, lan tỏa" }) })).status).toBe(403);
    await call("/cham/trong-tam", { method: "POST", cookie: coachCookie, body: new URLSearchParams({ bt: "900", tt: "Kèm cặp, lan tỏa" }) });
    expect(await (await call("/cham/bai?hv=32&bt=900", { cookie: coachCookie })).text()).toContain("B1. Trọng tâm tuần: Kèm cặp, lan tỏa");
  });

  it("học viên sửa bài sau khi chấm: báo cho người chấm", async () => {
    const { raw, call, psCookie } = await setup();
    await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet() });
    raw.prepare("UPDATE submissions SET answers_hash='moi' WHERE learner_id=31").run();
    expect(await (await call("/cham", { cookie: psCookie })).text()).toContain("Học viên sửa bài sau khi chấm");
  });

  it("cửa sổ chi tiết (công khai) hiện điểm chất lượng nhưng không tên người chấm, không nhận xét", async () => {
    const { raw, call, psCookie } = await setup();
    raw.prepare(
      "INSERT INTO scores (learner_id, assignment_id, due_at, earned, max, on_time_videos, hours_early, provisional, flags_json, detail_json, computed_at) VALUES (31, 900, '2026-11-08T23:00:00', 20, 26, 1, 3, 0, '[]', '[]', '2026-11-09T00:00:00Z')",
    ).run();
    await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet({ comment: "Nhận xét riêng chỉ BTC thấy" }) });
    // Trang công khai: không gửi cookie.
    const pub = await (await call("/bang-xep-hang/hv/31?p=1")).text();
    expect(pub).toContain("Chất lượng bài tuần");
    expect(pub).toContain("3,9★");
    expect(pub).toContain("mạnh nhất: <strong>Đúng ý, đủ ý");
    expect(pub).not.toContain("Phụng Sự Giả");
    expect(pub).not.toContain("Nhận xét riêng");
  });

  it("trang năng lực người chấm: coach xem được, ban phụng sự thì không", async () => {
    const { call, psCookie, coachCookie } = await setup();
    await call("/cham/luu", { method: "POST", cookie: psCookie, body: fullSheet() });
    expect((await call("/bao-cao/nguoi-cham", { cookie: psCookie })).status).toBe(403);
    const html = await (await call("/bao-cao/nguoi-cham", { cookie: coachCookie })).text();
    expect(html).toContain("Phụng Sự Giả");
    expect(html).toContain("Đội 03");
    expect(html).toMatch(/<strong>1<\/strong> bài/);
  });

  it("bài tuần đang mở (chưa tới hạn) cũng hiện trên bàn chấm, ai nộp rồi chấm được ngay", async () => {
    const { raw, call, coachCookie } = await setup();
    const iso = "2026-11-01T00:00:00Z";
    const due = new Date(Date.now() + 7 * 3_600_000 + 86_400_000).toISOString().slice(0, 19); // mai, giờ VN
    raw.prepare("INSERT INTO assignments (id, title, type, due_at, first_seen_at, last_seen_at) VALUES (901, 'Bài tuần 06 (X10)', 'WEEK', ?, ?, ?)").run(due, iso, iso);
    raw.prepare(
      "INSERT INTO submissions (learner_id, assignment_id, status, submitted_at, answers_json, answers_hash, content_hash, first_seen_at, changed_at, last_seen_at) VALUES (31, 901, 'DONE', ?, ?, 'x', 'c', ?, ?, ?)",
    ).run(due, answers(["https://youtu.be/ddddddddddd"], ""), iso, iso, iso);
    const html = await (await call("/cham", { cookie: coachCookie })).text();
    expect(html).toContain("Bài tuần 06 · đang mở");
    expect(html).toContain("Bài đang mở");
    expect(html).toContain('/cham/bai?hv=31&amp;bt=901');
    expect((await call("/cham/bai?hv=31&bt=901", { cookie: coachCookie })).status).toBe(200);
  });

  it("hiện 3 nút tuần gần nhất, các tuần trước nữa nằm trong danh sách xổ xuống", async () => {
    const { raw, call, coachCookie } = await setup();
    const iso = "2026-11-01T00:00:00Z";
    for (const [id, d] of [[897, "2026-10-18"], [898, "2026-10-25"], [899, "2026-11-01"]] as const) {
      raw.prepare("INSERT INTO assignments (id, title, type, due_at, first_seen_at, last_seen_at) VALUES (?, ?, 'WEEK', ?, ?, ?)").run(id, `Bài tuần ${id} (X10)`, `${d}T23:00:00`, iso, iso);
    }
    const html = await (await call("/cham", { cookie: coachCookie })).text();
    const nav = html.slice(html.indexOf('aria-label="Chọn bài tuần"'), html.indexOf("</nav>", html.indexOf('aria-label="Chọn bài tuần"')));
    expect((nav.match(/class="chip/g) ?? []).length).toBe(3);
    expect(html).toContain('<option value="897">Bài tuần 897');
    const old = await (await call("/cham?bt=897", { cookie: coachCookie })).text();
    expect(old).toContain('<option value="897" selected="">');
  });
});
