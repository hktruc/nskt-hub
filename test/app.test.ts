import { describe, expect, it } from "vitest";
import app from "../src/app";
import { createTestDb } from "./helpers/d1";
import { FAKE_KEY, testEnv } from "./helpers/fixtures";

const local = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);

describe("ứng dụng", () => {
  it("/health trả về ok mà không cần đăng nhập", async () => {
    const res = await app.fetch(new Request("https://app.invalid/health"), testEnv(createTestDb().d1));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, app: "nskt-hub" });
  });

  it("thiếu cấu hình đăng nhập thì khóa mọi trang", async () => {
    const env = testEnv(createTestDb().d1);
    for (const path of ["/", "/du-lieu", "/khong-co"]) {
      const res = await app.fetch(new Request(`https://app.invalid${path}`), env);
      expect(res.status).toBe(503);
    }
  });

  it("cờ bỏ đăng nhập chỉ có tác dụng trên localhost", async () => {
    const env = testEnv(createTestDb().d1, { LOCAL_DEV_NO_AUTH: "true" });
    expect((await app.fetch(new Request("https://app.invalid/"), env)).status).toBe(503);
    expect((await app.fetch(local("/"), env)).status).toBe(200);
  });

  it("trang Tình trạng dữ liệu hiển thị được khi chưa có gì, và không lộ khóa", async () => {
    const env = testEnv(createTestDb().d1, { LOCAL_DEV_NO_AUTH: "true" });
    const res = await app.fetch(local("/du-lieu"), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Tình trạng dữ liệu");
    expect(html).toContain("Chưa có lần nào");
    expect(html).not.toContain(FAKE_KEY);
  });

  it("báo rõ khi chưa nhập khóa dh3g", async () => {
    const env = testEnv(createTestDb().d1, { LOCAL_DEV_NO_AUTH: "true", DH3G_API_KEY: undefined });
    const html = await (await app.fetch(local("/du-lieu"), env)).text();
    expect(html).toContain("Chưa nhập khóa dh3g");
  });

  it("nút đồng bộ xếp việc vào hàng đợi; yêu cầu từ trang khác bị từ chối", async () => {
    const { d1, raw } = createTestDb();
    const env = testEnv(d1, { LOCAL_DEV_NO_AUTH: "true" });
    const body = new URLSearchParams({ "pham-vi": "gan-day" });

    const foreign = await app.fetch(local("/du-lieu/dong-bo", { method: "POST", body, headers: { Origin: "https://ke-xau.invalid" } }), env);
    expect(foreign.status).toBe(403);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM sync_jobs").get()).toEqual({ n: 0 });

    const ok = await app.fetch(local("/du-lieu/dong-bo", { method: "POST", body, headers: { Origin: "http://localhost" } }), env);
    expect(ok.status).toBe(303);
    expect(ok.headers.get("location")).toBe("/du-lieu?tb=da-xep");
    const n = (raw.prepare("SELECT COUNT(*) AS n FROM sync_jobs WHERE status='pending'").get() as { n: number }).n;
    expect(n).toBeGreaterThan(20);
  });

  it("đường dẫn lạ trả về 404", async () => {
    const env = testEnv(createTestDb().d1, { LOCAL_DEV_NO_AUTH: "true" });
    expect((await app.fetch(local("/khong-co"), env)).status).toBe(404);
  });
});
