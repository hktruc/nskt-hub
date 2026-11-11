import { beforeEach, describe, expect, it } from "vitest";
import { authenticate, resetAuthCacheForTests } from "../src/auth";
import { createTestDb } from "./helpers/d1";
import { testEnv } from "./helpers/fixtures";

const DOMAIN = "nhom-thu.cloudflareaccess.com";
const AUD = "aud-thu";
const NOW = Date.parse("2026-11-11T00:00:00Z");

const b64 = (b: Uint8Array | string) =>
  btoa(typeof b === "string" ? unescape(encodeURIComponent(b)) : String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function makeKey(kid: string) {
  const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid };
  const sign = async (payload: object, header: object = { alg: "RS256", kid }) => {
    const data = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(payload))}`;
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(data));
    return `${data}.${b64(new Uint8Array(sig))}`;
  };
  return { jwk, sign };
}

const claims = (over: object = {}) => ({ aud: [AUD], iss: `https://${DOMAIN}`, exp: NOW / 1000 + 600, email: "btc@example.invalid", ...over });
const certs = (...keys: object[]) => (async () => new Response(JSON.stringify({ keys }))) as unknown as typeof fetch;
const req = (token?: string) => new Request("https://app.invalid/", { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });
const env = () => testEnv(createTestDb().d1, { ACCESS_TEAM_DOMAIN: DOMAIN, ACCESS_AUD: AUD });

describe("đăng nhập Cloudflare Access", () => {
  beforeEach(() => resetAuthCacheForTests());

  it("mã hợp lệ thì vào được", async () => {
    const k = await makeKey("k1");
    expect(await authenticate(req(await k.sign(claims())), env(), NOW, certs(k.jwk))).toEqual({ ok: true, email: "btc@example.invalid" });
  });

  it("không có mã thì từ chối", async () => {
    const k = await makeKey("k1");
    expect((await authenticate(req(), env(), NOW, certs(k.jwk))).ok).toBe(false);
  });

  it("từ chối mã hết hạn, sai đối tượng, sai nơi phát hành", async () => {
    const k = await makeKey("k1");
    for (const bad of [{ exp: NOW / 1000 - 1 }, { aud: ["khac"] }, { iss: "https://ke-xau.invalid" }, { email: "" }]) {
      const r = await authenticate(req(await k.sign(claims(bad))), env(), NOW, certs(k.jwk));
      expect(r).toMatchObject({ ok: false, status: 401 });
    }
  });

  it("từ chối mã ký bằng khóa khác hoặc không ký", async () => {
    const real = await makeKey("k1");
    const fake = await makeKey("k1");
    expect((await authenticate(req(await fake.sign(claims())), env(), NOW, certs(real.jwk))).ok).toBe(false);
    const unsigned = `${b64(JSON.stringify({ alg: "none", kid: "k1" }))}.${b64(JSON.stringify(claims()))}.`;
    expect((await authenticate(req(unsigned), env(), NOW, certs(real.jwk))).ok).toBe(false);
  });

  it("Access đổi khóa thì tự tải lại danh sách khóa", async () => {
    const old = await makeKey("k1");
    const next = await makeKey("k2");
    const e = env();
    await authenticate(req(await old.sign(claims())), e, NOW, certs(old.jwk));
    expect((await authenticate(req(await next.sign(claims())), e, NOW, certs(old.jwk, next.jwk))).ok).toBe(true);
  });
});
