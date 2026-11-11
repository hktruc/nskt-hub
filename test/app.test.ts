import { describe, expect, it } from "vitest";
import app from "../src/index";

const env = { APP_NAME: "nskt-hub" };

describe("khung ứng dụng", () => {
  it("/health trả về ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, app: "nskt-hub" });
  });

  it("trang chủ là HTML tiếng Việt", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html lang="vi">');
    expect(html).toContain("nskt-hub");
  });

  it("đường dẫn lạ trả về 404", async () => {
    const res = await app.request("/khong-co", {}, env);
    expect(res.status).toBe(404);
  });
});
