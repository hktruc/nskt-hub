// Đọc Google Sheet bằng tài khoản dịch vụ Google (chỉ quyền xem).
// Khóa của tài khoản dịch vụ là secret GOOGLE_SERVICE_ACCOUNT_JSON trên Cloudflare, không nằm trong repo.

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export class SheetsError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\\n/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function parseServiceAccount(json: string | undefined): ServiceAccount | null {
  if (!json) return null;
  try {
    const sa = JSON.parse(json) as Partial<ServiceAccount>;
    return sa.client_email && sa.private_key ? (sa as ServiceAccount) : null;
  } catch {
    return null;
  }
}

export async function accessToken(sa: ServiceAccount, now: Date, fetchImpl: typeof fetch = fetch): Promise<string> {
  const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const iat = Math.floor(now.getTime() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat, exp: iat + 3600 }),
  )}`;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch {
    throw new SheetsError("Khóa tài khoản dịch vụ Google không đọc được (kiểm tra lại nội dung tệp JSON đã dán).");
  }
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const res = await fetchImpl(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new SheetsError(`Google từ chối tài khoản dịch vụ (mã ${res.status}).`, res.status);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new SheetsError("Google không trả mã truy cập.");
  return body.access_token;
}

/** Đọc một vùng ô, trả về các dòng (mỗi dòng là mảng chữ). */
export async function readRange(token: string, spreadsheetId: string, range: string, fetchImpl: typeof fetch = fetch): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 403 || res.status === 404) {
    throw new SheetsError(`Không mở được file (mã ${res.status}). File đã được chia sẻ quyền xem cho tài khoản dịch vụ chưa?`, res.status);
  }
  if (!res.ok) throw new SheetsError(`Đọc Google Sheet lỗi (mã ${res.status}).`, res.status);
  const body = (await res.json()) as { values?: unknown[][] };
  return (body.values ?? []).map((r) => r.map((v) => (v === null || v === undefined ? "" : String(v))));
}
