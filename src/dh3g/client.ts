export type ReportKind = "submissions" | "attendance";

const PATHS: Record<ReportKind, string> = {
  submissions: "/hkm-api/public/report/cohort-submissions",
  attendance: "/hkm-api/public/report/cohort-attendance",
};

const MAX_BYTES = 50 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

export type FetchResult =
  | { ok: true; status: number; text: string; bytes: number }
  | { ok: false; status: number | null; error: string };

export type Dh3gConfig = {
  baseUrl: string;
  communityId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
};

/**
 * Gọi một báo cáo dh3g cho một khoảng ngày.
 * Khóa chỉ đi trong tiêu đề X-API-KEY; không bao giờ xuất hiện trong lỗi hay nhật ký.
 */
export async function fetchReport(
  cfg: Dh3gConfig,
  report: ReportKind,
  from: string,
  to: string,
): Promise<FetchResult> {
  const url = new URL(PATHS[report], cfg.baseUrl);
  url.searchParams.set("communityId", cfg.communityId);
  url.searchParams.set("fromDate", from);
  url.searchParams.set("toDate", to);
  if (report === "submissions") url.searchParams.set("includeAnswers", "true");

  let res: Response;
  try {
    res = await (cfg.fetchImpl ?? fetch)(url.href, {
      method: "GET",
      headers: { Accept: "application/json", "X-API-KEY": cfg.apiKey },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { ok: false, status: null, error: name === "TimeoutError" ? "dh3g không trả lời sau 60 giây" : "không kết nối được dh3g" };
  }

  if (res.status !== 200) {
    await res.body?.cancel().catch(() => {});
    return { ok: false, status: res.status, error: describeStatus(res.status) };
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return { ok: false, status: 200, error: "phản hồi dh3g quá lớn (trên 50 MB)" };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(buf);
  } catch {
    return { ok: false, status: 200, error: "phản hồi dh3g không phải văn bản UTF-8" };
  }
  return { ok: true, status: 200, text, bytes: buf.byteLength };
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return `dh3g từ chối khóa (mã ${status})`;
  if (status === 404) return "dh3g báo không có báo cáo này (mã 404)";
  if (status === 429) return "dh3g báo gọi quá nhiều (mã 429)";
  if (status >= 500) return `dh3g đang lỗi (mã ${status})`;
  return `dh3g trả về mã ${status}`;
}
