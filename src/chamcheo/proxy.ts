// Màn hình chiếu chấm chéo (lớp offline thứ Sáu) là một Worker riêng, `nskt-cham-cheo-stage`, không thuộc repo này.
// Nskt-hub chỉ CHUYỂN TIẾP đúng các đường dẫn mà trang đó dùng (qua service binding CHAM_CHEO) để học viên và BTC
// dùng chung một địa chỉ: nskt-hub.…/cham-cheo. Không sửa, không lưu, không đọc nội dung gì của trang đó.
//
// Trang cũ dùng đường dẫn tuyệt đối từ gốc (/sim23/…, /api/…, /login) nên các đường dẫn đó cũng được chuyển tiếp ở gốc
// của nskt-hub (xem `STAGE_ROUTES`). Đăng nhập BTC bên trong và cookie `nskt_stage` vẫn do trang cũ quản lý.
// Chủ ý KHÔNG chuyển tiếp /api/insights và /plan.html (trang cũ không dùng; GET của /api/insights có ghi dữ liệu nội bộ).

import type { Env } from "../env";

export const STAGE_HOME = "/cham-cheo";
const DEFAULT_ORIGIN = "https://nskt-cham-cheo-stage.hktruc.workers.dev";

/** Danh sách trắng các đường dẫn chuyển tiếp: [phương thức, mẫu đường dẫn]. */
export const STAGE_ROUTES: { method: "GET" | "POST"; path: RegExp }[] = [
  { method: "GET", path: /^\/index\.html$/ },
  { method: "GET", path: /^\/login$/ },
  { method: "GET", path: /^\/sim23\/[A-Za-z0-9._-]+$/ },
  { method: "GET", path: /^\/assets\/roster\.json$/ },
  { method: "GET", path: /^\/api\/session$/ },
  { method: "GET", path: /^\/api\/results$/ },
  { method: "POST", path: /^\/api\/unlock$/ },
  { method: "POST", path: /^\/api\/logout$/ },
];

export const stageOrigin = (env: Env) => (env.CHAM_CHEO_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");

/** Địa chỉ chuyển hướng của trang cũ → địa chỉ trên nskt-hub. Trang chính "/" của trang cũ chính là /cham-cheo. */
export function rewriteLocation(loc: string, origin: string): string {
  let path = loc;
  if (/^https?:\/\//i.test(loc)) {
    let u: URL;
    try {
      u = new URL(loc);
    } catch {
      return loc;
    }
    if (u.origin !== origin) return loc; // đi ra ngoài: giữ nguyên
    path = u.pathname + u.search + u.hash;
  }
  const home = path.match(/^\/([?#].*)?$/);
  return home ? STAGE_HOME + (home[1] ?? "") : path;
}

/** Chuyển một yêu cầu sang trang cũ, `path` là đường dẫn bên trang cũ ("/" cho trang chính). */
export async function forwardToStage(env: Env, req: Request, path: string): Promise<Response> {
  if (!env.CHAM_CHEO) return new Response("Màn hình chấm chéo chưa được nối với nskt-hub.", { status: 503 });
  const origin = stageOrigin(env);
  const target = new URL(path + new URL(req.url).search, origin);
  const headers = new Headers(req.headers);
  headers.delete("host");
  // Trang cũ chỉ biết địa chỉ của nó: đổi Origin / Referer sang địa chỉ đó (nskt-hub đã tự kiểm tra Origin trước khi chuyển POST).
  if (headers.has("origin")) headers.set("origin", origin);
  if (headers.has("referer")) headers.set("referer", `${origin}/`);
  const init: RequestInit = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") init.body = await req.arrayBuffer();
  let res: Response;
  try {
    res = await env.CHAM_CHEO.fetch(new Request(target, init));
  } catch {
    return new Response("Không kết nối được màn hình chấm chéo. Thử lại sau ít phút.", { status: 502 });
  }
  const out = new Response(res.body, res);
  const loc = out.headers.get("location");
  if (loc) out.headers.set("location", rewriteLocation(loc, origin));
  return out;
}
