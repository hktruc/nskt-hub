import { describe, expect, it } from "vitest";
import app from "../src/app";
import { collectFaqItems, meaningful } from "../src/faq/collect";
import { faqTick, requestRun } from "../src/faq/store";
import { CHUNK, SYSTEM_MERGE, groupFaq } from "../src/faq/ai";
import type { FaqItem } from "../src/faq/collect";
import { createUser } from "../src/users/accounts";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

// Dữ liệu giả hoàn toàn.
const ORIGIN = "https://nskt-hub.invalid";
const form = (o: Record<string, string>) => new URLSearchParams(o);
const Q_ASK = "Bạn có khó khăn & câu hỏi gì đến BTC/Thầy?";
const Q_FIX = "03 điểm cần cải thiện trong lớp học là gì?";
const Q_GOOD = "01 điểm tốt cần phát huy trong lớp học là gì?";

async function setup() {
  const { d1, raw } = createTestDb();
  const env = testEnv(d1, { OPENAI_API_KEY: "khoa-gia", ACCESS_TEAM_DOMAIN: "nhom-gia.cloudflareaccess.com", ACCESS_AUD: "aud-gia" });
  const t = "2026-11-01T00:00:00Z";
  const ans = (a: string, b: string, c: string) => JSON.stringify([{ question: "Video tuần", answer: "https://youtu.be/x" }, { question: Q_GOOD, answer: c }, { question: Q_FIX, answer: b }, { question: Q_ASK, answer: a }]).replace(/'/g, "''");
  raw.exec(`
    INSERT INTO teams VALUES (1,'🐟 Đội Cá Chép 01','${t}','${t}'), (2,'🐟 Đội Cá Chép 02','${t}','${t}'), (3,'BTC','${t}','${t}');
    INSERT INTO learners VALUES (1,'Học Viên Một',NULL,NULL,1,1,'${t}','${t}'), (2,'Học Viên Hai',NULL,NULL,1,2,'${t}','${t}'), (3,'Người BTC',NULL,NULL,1,3,'${t}','${t}');
    INSERT INTO assignments (id,title,type,due_at,first_seen_at,last_seen_at) VALUES
      (50,'Bài tập tuần 05 (X10)','WEEK','2026-11-05T23:00:00','${t}','${t}'), (60,'Bài tập tuần 06 (X10)','WEEK','2026-11-12T23:00:00','${t}','${t}'), (61,'Bài ngày','NORMAL','2026-11-12T23:00:00','${t}','${t}');
    INSERT INTO submissions (learner_id,assignment_id,status,answers_json,content_hash,first_seen_at,changed_at,last_seen_at) VALUES
      (1,50,'DONE','${ans("Web nộp bài bị lỗi không tải được ảnh", "Không", "Thầy giảng hay")}','h','${t}','${t}','${t}'),
      (2,50,'DONE','${ans("không có", "Nên gửi lịch học sớm hơn", "Tốt")}','h','${t}','${t}','${t}'),
      (1,60,'DONE','${ans("Em không tải được ảnh lên web", "ko", "ok")}','h','${t}','${t}','${t}'),
      (3,60,'DONE','${ans("Câu hỏi của BTC không tính", "x", "x")}','h','${t}','${t}','${t}');
  `);
  const now = new Date();
  const coachCode = await createUser(d1, { phone: "0900000111", name: "Coach Giả", role: "coach" }, "test", now);
  const psCode = await createUser(d1, { phone: "0900000222", name: "Phụng Sự Giả", role: "phung_su" }, "test", now);
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set("cookie", init.cookie);
    if (init.method === "POST") headers.set("origin", ORIGIN);
    return app.fetch(new Request(`${ORIGIN}${path}`, { ...init, headers }), env);
  };
  const login = async (phone: string, code: string) => {
    const res = await call("/kich-hoat", { method: "POST", body: form({ sdt: phone, ma: code, mk: "matkhau-gia-1", mk2: "matkhau-gia-1" }) });
    return (res.headers.get("set-cookie") ?? "").split(";")[0]!;
  };
  return { env, raw, d1, call, coach: await login("0900000111", coachCode), ps: await login("0900000222", psCode) };
}

/** OpenAI giả: gộp hai câu về lỗi tải ảnh thành một câu hỏi cấp bách; câu còn lại để AI bỏ qua. */
function fakeOpenAi(seen: string[]) {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
    const user = body.messages[1]!.content;
    seen.push(user);
    const ids = [...user.matchAll(/\{"id":(\d+),"nguon":"[^"]*","noi_dung":"([^"]*)"\}/g)].filter((m) => /ảnh/.test(m[2]!)).map((m) => Number(m[1]));
    const content = JSON.stringify({ groups: [{ question: "Không tải được ảnh lên web thì làm sao?", summary: "Lỗi tải ảnh khi nộp bài.", topic: "Kỹ thuật – web/app", urgency: "cap-bach", ids }] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  }) as unknown as typeof fetch;
}

describe("câu hỏi học viên → FAQ", () => {
  it("lọc câu không có nội dung", () => {
    for (const t of ["không", "Không có.", "ko", "chưa có gì", "...", "ok"]) expect(meaningful(t), t).toBe(false);
    expect(meaningful("Nên gửi lịch học sớm hơn")).toBe(true);
  });

  it("chỉ lấy câu góp ý gửi BTC của bài tuần, của học viên 12 đội", async () => {
    const { d1 } = await setup();
    const items = await collectFaqItems(d1);
    expect(items.map((i) => [i.learnerId, i.assignmentId, i.source])).toEqual([
      [1, 50, "cau-hoi"],
      [2, 50, "cai-thien"],
      [1, 60, "cau-hoi"],
    ]);
    expect(await collectFaqItems(d1, { assignmentId: 60 })).toHaveLength(1);
  });

  it("AI biên tập chạy nền; trang BTC hiện câu hỏi gộp, chữ nhỏ ai hỏi, bấm xem câu gốc; không gửi tên cho AI", async () => {
    const { env, call, coach } = await setup();
    let html = await (await call("/faq", { cookie: coach })).text();
    expect(html).toContain("Chưa có bản biên tập AI");
    expect(html).toContain("Web nộp bài bị lỗi không tải được ảnh"); // câu gốc vẫn xem được
    expect((await call("/faq/bien-tap", { method: "POST", cookie: coach, body: form({ tuan: "" }) })).headers.get("location")).toContain("tb=da-xep");
    // Bấm lần nữa khi đang chờ: không xếp trùng.
    expect((await call("/faq/bien-tap", { method: "POST", cookie: coach, body: form({ tuan: "" }) })).headers.get("location")).toContain("tb=dang-chay");
    expect(await (await call("/faq", { cookie: coach })).text()).toContain("Đang biên tập");
    const seen: string[] = [];
    const r = await faqTick(env, new Date(), { fetchImpl: fakeOpenAi(seen) });
    expect(r.status).toBe("done");
    expect(seen[0]).not.toContain("Học Viên");
    html = await (await call("/faq", { cookie: coach })).text();
    expect(html).toContain("Không tải được ảnh lên web thì làm sao?");
    expect(html).toContain("Cấp bách");
    expect(html).toMatch(/2 lượt · 1 học viên · Đội 01 · tuần 05, 06/);
    expect(html).toContain('href="/bai?hv=1&amp;bt=50"');
    expect(html).toContain("Các câu AI chưa xếp nhóm");
    expect(html).toContain("Nên gửi lịch học sớm hơn");
    expect(html).toContain("/faq/dang?cauhoi=");
    // Lọc theo tuần.
    html = await (await call("/faq?tuan=60", { cookie: coach })).text();
    expect(html).toContain("Tuần 06 (1)");
    expect(html).toContain("Chưa có bản biên tập AI cho tuần 06");
  });

  it("tự biên tập mỗi ngày khi có câu mới; không chạy lại khi không đổi", async () => {
    const { env, d1 } = await setup();
    const seen: string[] = [];
    await faqTick(env, new Date("2026-11-13T00:00:00Z"), { auto: true, fetchImpl: fakeOpenAi(seen) });
    // Lượt 1 xếp cả "từ đầu khóa" lẫn tuần mới nhất; mỗi lượt chạy một.
    await faqTick(env, new Date("2026-11-13T00:05:00Z"), { fetchImpl: fakeOpenAi(seen) });
    expect(seen).toHaveLength(2);
    await faqTick(env, new Date("2026-11-14T06:00:00Z"), { auto: true, fetchImpl: fakeOpenAi(seen) });
    expect(seen).toHaveLength(2);
    expect(await requestRun(d1, { scope: "all" }, "test", new Date())).toBe(true);
  });

  it("BTC đăng câu trả lời; chỉ câu công khai hiện cuối bảng xếp hạng; ban phụng sự không vào được", async () => {
    const { call, coach, ps } = await setup();
    expect((await call("/faq/dang", { method: "POST", cookie: coach, body: form({ cauhoi: "Nộp trễ có được tính điểm?", traloi: "Có, mỗi video 2 điểm.", thutu: "1", cong_khai: "1" }) })).status).toBe(303);
    expect((await call("/faq/dang", { method: "POST", cookie: coach, body: form({ cauhoi: "Câu nháp", traloi: "Chưa đăng", thutu: "2" }) })).status).toBe(303);
    expect((await call("/faq/dang", { method: "POST", cookie: coach, body: form({ cauhoi: "", traloi: "x" }) })).status).toBe(400);
    const pub = await (await call("/bang-xep-hang")).text();
    expect(pub).toContain("Câu hỏi thường gặp");
    expect(pub).toContain("Nộp trễ có được tính điểm?");
    expect(pub).toContain("Có, mỗi video 2 điểm.");
    expect(pub).not.toContain("Câu nháp");
    expect(pub).not.toContain("Coach Giả");
    expect((await call("/faq", { cookie: ps })).status).toBe(403);
    expect((await call("/faq")).status).not.toBe(200);
    expect((await call("/faq/dang", { method: "POST", body: form({ cauhoi: "x", traloi: "y" }) })).status).not.toBe(303);
  });

  it("nhiều câu: gộp từng phần rồi nối nhóm trùng vấn đề giữa các phần", async () => {
    const n = CHUNK * 2 + 5;
    const items: FaqItem[] = Array.from({ length: n }, (_, i) => ({
      key: `${i}:1:0`, learnerId: i, name: `HV ${i}`, team: "T01", assignmentId: 1, assignmentTitle: "Bài tập tuần 01", dueAt: "2026-10-01", source: "cau-hoi",
      text: i % 2 ? "Không tải được ảnh khi nộp bài" : "Muốn có lịch học sớm hơn",
    }));
    const calls: { system: string; effort?: string; user: string }[] = [];
    const fake = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)) as { messages: { content: string }[]; reasoning_effort?: string };
      const system = b.messages[0]!.content;
      const user = b.messages[1]!.content;
      calls.push({ system, effort: b.reasoning_effort, user });
      let out: unknown;
      if (system === SYSTEM_MERGE) {
        // Nối các nhóm cùng câu hỏi.
        const gs = [...user.matchAll(/\{"id":(\d+),"cau_hoi":"([^"]*)"/g)].map((m) => ({ id: Number(m[1]), q: m[2]! }));
        const byQ = new Map<string, number[]>();
        for (const g of gs) byQ.set(g.q, [...(byQ.get(g.q) ?? []), g.id]);
        out = { groups: [...byQ].map(([q, parts]) => ({ question: q, summary: "", topic: "", urgency: "thuong", parts })) };
      } else {
        const rows = [...user.matchAll(/\{"id":(\d+),"nguon":"[^"]*","noi_dung":"([^"]*)"\}/g)];
        const g = (re: RegExp, q: string, u: string) => ({ question: q, summary: "", topic: "", urgency: u, ids: rows.filter((m) => re.test(m[2]!)).map((m) => Number(m[1])) });
        out = { groups: [g(/ảnh/, "Không tải được ảnh?", "cap-bach"), g(/lịch/, "Lịch học sớm hơn?", "thuong")] };
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(out) } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await groupFaq({ apiKey: "k", model: "m", reasoningEffort: "minimal", fetchImpl: fake }, items, (k) => k);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(calls.filter((c) => c.system !== SYSTEM_MERGE)).toHaveLength(3); // 3 phần
    expect(calls.filter((c) => c.system === SYSTEM_MERGE).map((c) => c.effort)).toEqual(["low"]);
    expect(r.groups.map((g) => [g.question, g.urgency, g.ids.length])).toEqual([
      ["Không tải được ảnh?", "cap-bach", 82],
      ["Lịch học sớm hơn?", "thuong", 83],
    ]);
    // Mọi câu đều nằm đúng một nhóm, số thứ tự toàn cục.
    expect(new Set(r.groups.flatMap((g) => g.ids)).size).toBe(n);
    expect(Math.max(...r.groups.flatMap((g) => g.ids))).toBe(n);
  });
});
