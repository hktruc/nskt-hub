import { describe, expect, it } from "vitest";
import app from "../src/app";
import { rewriteLocation } from "../src/chamcheo/proxy";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

// Trang chấm chéo cũ được giả bằng một Fetcher giả; không gọi trang thật. Dữ liệu giả hoàn toàn.
const OLD = "https://nskt-cham-cheo-stage.hktruc.workers.dev";
const HUB = "https://nskt-hub.invalid";

type Seen = { url: string; method: string; origin: string | null; referer: string | null; cookie: string | null; body: string };

function fakeStage() {
  const seen: Seen[] = [];
  const fetcher = {
    async fetch(req: Request): Promise<Response> {
      seen.push({ url: req.url, method: req.method, origin: req.headers.get("origin"), referer: req.headers.get("referer"), cookie: req.headers.get("cookie"), body: await req.text() });
      const u = new URL(req.url);
      if (u.pathname === "/") return new Response("<html>MAN-HINH-CU</html>", { headers: { "content-type": "text/html" } });
      if (u.pathname === "/api/unlock") {
        const h = new Headers({ location: `${OLD}/` });
        h.append("set-cookie", "nskt_stage=gia-tri-gia; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200");
        return new Response(null, { status: 302, headers: h });
      }
      if (u.pathname === "/api/logout") return new Response(null, { status: 302, headers: { location: "/" } });
      if (u.pathname === "/login") return new Response("<form action=/api/unlock>", { headers: { "content-type": "text/html" } });
      if (u.pathname === "/api/results") return Response.json({ date: u.searchParams.get("date"), items: [] });
      return new Response("tệp:" + u.pathname);
    },
  };
  return { seen, fetcher: fetcher as unknown as Fetcher };
}

async function setup(withStage = true) {
  const { d1 } = createTestDb();
  const stage = fakeStage();
  const env = testEnv(d1, { ...(withStage ? { CHAM_CHEO: stage.fetcher } : {}), CHAM_CHEO_ORIGIN: OLD, ACCESS_TEAM_DOMAIN: "nhom-gia.cloudflareaccess.com", ACCESS_AUD: "aud-gia" });
  const call = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    return app.fetch(new Request(`${HUB}${path}`, { ...init, headers }), env);
  };
  return { call, seen: stage.seen };
}

describe("màn hình chấm chéo gắn vào /cham-cheo", () => {
  it("/cham-cheo chuyển tiếp trang chính của trang cũ, không cần đăng nhập nskt-hub", async () => {
    const { call, seen } = await setup();
    const res = await call("/cham-cheo");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("MAN-HINH-CU");
    expect(seen.map((s) => s.url)).toEqual([`${OLD}/`]);
    expect((await call("/cham-cheo/")).status).toBe(200);
  });

  it("các đường dẫn trang cũ dùng được chuyển tiếp nguyên vẹn, kèm tham số ngày", async () => {
    const { call, seen } = await setup();
    expect(((await (await call("/api/results?date=2026-11-20")).json()) as { date: string }).date).toBe("2026-11-20");
    expect(await (await call("/sim23/app.js")).text()).toBe("tệp:/sim23/app.js");
    expect(await (await call("/assets/roster.json")).text()).toBe("tệp:/assets/roster.json");
    expect((await call("/login")).status).toBe(200);
    expect((await call("/api/session")).status).toBe(200);
    expect(seen.map((s) => s.url.slice(OLD.length))).toEqual(["/api/results?date=2026-11-20", "/sim23/app.js", "/assets/roster.json", "/login", "/api/session"]);
  });

  it("đăng nhập BTC: Origin đổi sang trang cũ, cookie đi qua, chuyển hướng về / thành /cham-cheo", async () => {
    const { call, seen } = await setup();
    const res = await call("/api/unlock", { method: "POST", headers: { origin: HUB, referer: `${HUB}/login`, "content-type": "application/x-www-form-urlencoded", cookie: "a=b" }, body: "code=ma-gia" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/cham-cheo");
    expect(res.headers.get("set-cookie")).toMatch(/^nskt_stage=gia-tri-gia;.*HttpOnly/);
    expect(seen[0]).toMatchObject({ method: "POST", origin: OLD, referer: `${OLD}/`, cookie: "a=b", body: "code=ma-gia" });
    const out = await call("/api/logout", { method: "POST", headers: { origin: HUB } });
    expect(out.headers.get("location")).toBe("/cham-cheo");
  });

  it("POST từ trang khác bị từ chối, không chuyển tiếp", async () => {
    const { call, seen } = await setup();
    expect((await call("/api/unlock", { method: "POST", headers: { origin: "https://ke-xau.invalid" }, body: "code=x" })).status).toBe(403);
    expect((await call("/api/logout", { method: "POST", body: "" })).status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it("không chuyển tiếp những đường dẫn ngoài danh sách (/api/insights, /plan.html, tệp lạ, sai phương thức)", async () => {
    const { call, seen } = await setup();
    for (const [path, method] of [["/api/insights?date=2026-11-20", "GET"], ["/api/insights", "POST"], ["/plan.html", "GET"], ["/assets/khac.json", "GET"], ["/sim23/a/b.js", "GET"], ["/sim23/..%2Fapi", "GET"], ["/api/unlock", "GET"], ["/api/results", "POST"]] as const) {
      const res = await call(path, { method, headers: { origin: HUB }, ...(method === "POST" ? { body: "" } : {}) });
      expect(res.status, path).not.toBe(200);
    }
    expect(seen).toHaveLength(0);
  });

  it("các trang nskt-hub khác vẫn cần đăng nhập; chưa nối trang cũ thì báo 503", async () => {
    const { call } = await setup();
    expect((await call("/")).status).not.toBe(200);
    expect((await call("/nop-bai")).status).not.toBe(200);
    const none = await setup(false);
    expect((await none.call("/cham-cheo")).status).toBe(503);
  });

  it("đổi địa chỉ chuyển hướng", () => {
    expect(rewriteLocation("/", OLD)).toBe("/cham-cheo");
    expect(rewriteLocation(`${OLD}/`, OLD)).toBe("/cham-cheo");
    expect(rewriteLocation(`${OLD}/?date=2026-11-20`, OLD)).toBe("/cham-cheo?date=2026-11-20");
    expect(rewriteLocation("/login", OLD)).toBe("/login");
    expect(rewriteLocation(`${OLD}/login?x=1`, OLD)).toBe("/login?x=1");
    expect(rewriteLocation("https://trang-khac.invalid/", OLD)).toBe("https://trang-khac.invalid/");
  });
});
