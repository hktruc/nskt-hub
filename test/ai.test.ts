import { describe, expect, it } from "vitest";
import { buildMessages, reviewItems } from "../src/ai/openai";

const KEY = "KHOA-OPENAI-GIA";
const item = { index: 3, task: "sau-sac" as const, question: "Câu khuyến khích", answer: "Em đúc kết được bài học" };

function fakeOpenAI(handler: (body: any) => Response) {
  const calls: { url: string; auth: string | null; body: any }[] = [];
  const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), auth: new Headers(init?.headers).get("authorization"), body });
    return handler(body);
  }) as typeof fetch;
  return { fetchImpl, calls };
}
const reply = (content: unknown) =>
  new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200 });

describe("AI chấm bài qua OpenAI", () => {
  it("gửi đúng mô hình, khóa ở tiêu đề, yêu cầu JSON theo mẫu; đọc kết quả", async () => {
    const ai = fakeOpenAI(() => reply({ items: [{ index: 3, ok: true, nonsense: false, note: "có đúc kết" }] }));
    const out = await reviewItems({ apiKey: KEY, model: "gpt-5-nano", reasoningEffort: "minimal", fetchImpl: ai.fetchImpl }, [item]);
    expect(out).toEqual({ ok: true, verdicts: [{ index: 3, ok: true, nonsense: false, note: "có đúc kết" }] });
    const c = ai.calls[0]!;
    expect(c.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(c.auth).toBe(`Bearer ${KEY}`);
    expect(c.body.model).toBe("gpt-5-nano");
    expect(c.body.reasoning_effort).toBe("minimal");
    expect(c.body.response_format.json_schema.strict).toBe(true);
    expect(JSON.stringify(c.body)).not.toContain(KEY);
  });

  it("đối phó thì không bao giờ đạt", async () => {
    const ai = fakeOpenAI(() => reply({ items: [{ index: 3, ok: true, nonsense: true, note: "gõ đại" }] }));
    const out = await reviewItems({ apiKey: KEY, model: "m", fetchImpl: ai.fetchImpl }, [item]);
    expect(out.ok && out.verdicts[0]).toMatchObject({ ok: false, nonsense: true });
  });

  it("báo lỗi rõ và dừng lượt khi khóa sai hoặc hết hạn mức", async () => {
    for (const [status, text] of [[401, "từ chối khóa"], [429, "429"], [400, "mã 400"]] as const) {
      const ai = fakeOpenAI(() => new Response(JSON.stringify({ error: { message: "bad model" } }), { status }));
      const out = await reviewItems({ apiKey: KEY, model: "m", fetchImpl: ai.fetchImpl }, [item]);
      expect(out.ok).toBe(false);
      if (!out.ok) {
        expect(out.error).toContain(text);
        expect(out.stop).toBe(true);
        expect(out.error).not.toContain(KEY);
      }
    }
  });

  it("trả thiếu mục thì coi là lỗi, không chấm bừa", async () => {
    const ai = fakeOpenAI(() => reply({ items: [] }));
    expect((await reviewItems({ apiKey: KEY, model: "m", fetchImpl: ai.fetchImpl }, [item])).ok).toBe(false);
  });

  it("câu trả lời quá dài được cắt ở 4.000 ký tự", () => {
    const m = buildMessages([{ ...item, answer: "a".repeat(5000) }]);
    expect(m[1]!.content).toContain("[…]");
    expect(m[1]!.content.length).toBeLessThan(4600);
  });
});
