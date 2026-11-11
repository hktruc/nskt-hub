import type { Env } from "./env";

// Đăng nhập qua Cloudflare Access: Access gắn một mã JWT đã ký vào mỗi yêu cầu.
// Ứng dụng tự kiểm tra lại chữ ký và đối tượng (AUD), nên dù ai đó gọi thẳng
// worker mà không qua Access thì vẫn bị từ chối. Thiếu cấu hình thì khóa toàn bộ.

type Jwk = JsonWebKey & { kid?: string };

export type AuthResult = { ok: true; email: string } | { ok: false; status: 401 | 503; message: string };

let cache: { domain: string; keys: Jwk[]; at: number } | null = null;
const CACHE_MS = 3_600_000;

async function accessKeys(domain: string, fetchImpl: typeof fetch, now: number, refresh: boolean): Promise<Jwk[]> {
  if (!refresh && cache && cache.domain === domain && now - cache.at < CACHE_MS) return cache.keys;
  const res = await fetchImpl(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error("certs");
  const body = (await res.json()) as { keys?: Jwk[] };
  cache = { domain, keys: body.keys ?? [], at: now };
  return cache.keys;
}

function b64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function json(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64url(part)));
}

export async function authenticate(
  request: Request,
  env: Env,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
): Promise<AuthResult> {
  const host = new URL(request.url).hostname;
  if (env.LOCAL_DEV_NO_AUTH === "true" && (host === "localhost" || host === "127.0.0.1")) {
    return { ok: true, email: "dev@localhost" };
  }
  const domain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  if (!domain || !aud) {
    return { ok: false, status: 503, message: "Chưa cấu hình đăng nhập (Cloudflare Access)." };
  }
  const denied: AuthResult = { ok: false, status: 401, message: "Cần đăng nhập qua Cloudflare Access." };
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return denied;
  const parts = token.split(".");
  if (parts.length !== 3) return denied;
  const [h, p, s] = parts as [string, string, string];
  try {
    const header = json(h);
    const payload = json(p);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return denied;

    let jwk = (await accessKeys(domain, fetchImpl, now, false)).find((k) => k.kid === header.kid);
    // Access đổi khóa định kỳ: nếu không thấy thì tải lại danh sách một lần.
    if (!jwk) jwk = (await accessKeys(domain, fetchImpl, now, true)).find((k) => k.kid === header.kid);
    if (!jwk) return denied;

    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
    if (!valid) return denied;

    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const nowSec = Math.floor(now / 1000);
    if (!auds.includes(aud)) return denied;
    if (payload.iss !== `https://${domain}`) return denied;
    if (typeof payload.exp !== "number" || payload.exp <= nowSec) return denied;
    if (typeof payload.nbf === "number" && payload.nbf > nowSec + 60) return denied;
    if (typeof payload.email !== "string" || payload.email === "") return denied;
    return { ok: true, email: payload.email };
  } catch {
    return denied;
  }
}

export function resetAuthCacheForTests(): void {
  cache = null;
}
