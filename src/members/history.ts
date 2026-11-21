// Lịch sử thành viên: đọc tab THANH_VIEN của file "NSKT2026 — KỶ LUẬT TỔNG" (chỉ đọc), ghép với học viên theo SỐ ĐIỆN THOẠI
// (định danh chính thức), rồi lưu ngày vào / ngày rời vào bảng `member_history`.
// Một người có thể có nhiều dòng (chuyển đội thì đổi mã Cư Dân): ngày vào = lần xuất hiện đầu tiên, ngày rời = của dòng cuối nếu có.

import { normPhone } from "../attendance/offline";
import type { Env } from "../env";
import { accessToken, parseServiceAccount, readRange, SheetsError } from "../google/sheets";
import { SCORING } from "../scoring/config";

export const MEMBER_RANGE = "THANH_VIEN!A1:G1500";
const norm = (s: unknown) => String(s ?? "").normalize("NFC").trim().toLowerCase();

export type MemberSpan = { phone: string; code: string; joinedAt: string; leftAt: string | null };

/** Gộp các dòng của cùng một số điện thoại. */
export function parseMemberHistory(rows: string[][]): MemberSpan[] {
  const hi = rows.findIndex((r) => r.some((c) => norm(c) === "vào lúc"));
  if (hi < 0) throw new SheetsError('Tab THANH_VIEN không có cột "Vào lúc".');
  const h = rows[hi]!.map(norm);
  const col = (...names: string[]) => h.findIndex((x) => names.includes(x));
  const cKey = col("khoá", "khóa"), cCode = col("mã cư dân"), cJoin = col("vào lúc"), cLeft = col("rời lúc");
  if (cKey < 0 || cCode < 0 || cLeft < 0) throw new SheetsError("Tab THANH_VIEN đổi cột đầu bảng nên tạm dừng đọc lịch sử thành viên.");
  const by = new Map<string, { code: string; vao: string; roi: string }[]>();
  for (const r of rows.slice(hi + 1)) {
    const phone = normPhone(r[cKey]);
    const vao = String(r[cJoin] ?? "").trim();
    if (phone.length < 9 || !/^\d{4}-\d{2}-\d{2}/.test(vao)) continue;
    by.set(phone, [...(by.get(phone) ?? []), { code: String(r[cCode] ?? "").trim().toUpperCase(), vao, roi: String(r[cLeft] ?? "").trim() }]);
  }
  return [...by.entries()].map(([phone, list]) => {
    const sorted = [...list].sort((a, b) => a.vao.localeCompare(b.vao) || (a.roi ? 0 : 1) - (b.roi ? 0 : 1));
    const last = sorted[sorted.length - 1]!;
    return { phone, code: last.code, joinedAt: sorted[0]!.vao, leftAt: last.roi || null };
  });
}

export type MemberSyncResult =
  | { status: "chua-cau-hinh" }
  | { status: "loi"; message: string }
  | { status: "ok"; members: number; matched: number; late: number; left: number };

export async function syncMemberHistory(env: Env, now: Date, fetchImpl: typeof fetch = fetch): Promise<MemberSyncResult> {
  const sa = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!sa || !env.SHEET_KYLUAT_ID) return { status: "chua-cau-hinh" };
  try {
    const token = await accessToken(sa, now, fetchImpl);
    const spans = parseMemberHistory(await readRange(token, env.SHEET_KYLUAT_ID, MEMBER_RANGE, fetchImpl));
    if (spans.length === 0) throw new SheetsError("Tab THANH_VIEN không có dòng thành viên nào, giữ nguyên dữ liệu cũ.");
    const learners = (await env.DB.prepare("SELECT id, phone FROM learners").all<{ id: number; phone: string | null }>()).results;
    const byPhone = new Map<string, number>();
    for (const l of learners) {
      const p = normPhone(l.phone);
      if (p && !byPhone.has(p)) byPhone.set(p, l.id);
    }
    // Không khớp số điện thoại (ví dụ đã đổi số): thử theo mã Cư Dân hiện tại trong dữ liệu điểm danh.
    const byCode = new Map<string, number>();
    for (const r of (await env.DB.prepare("SELECT DISTINCT learner_id, resident_code FROM offline_attendance").all<{ learner_id: number; resident_code: string }>()).results) {
      byCode.set(r.resident_code, r.learner_id);
    }
    const iso = now.toISOString();
    const rows = spans.map((s) => [s.phone, byPhone.get(s.phone) ?? byCode.get(s.code) ?? null, s.joinedAt, s.leftAt, s.code]);
    const stmts = [env.DB.prepare("DELETE FROM member_history")];
    for (let i = 0; i < rows.length; i += 400) {
      stmts.push(
        env.DB.prepare(
          `INSERT OR REPLACE INTO member_history (phone, learner_id, joined_at, left_at, last_code, synced_at)
           SELECT json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]'), json_extract(value,'$[4]'), ?
           FROM json_each(?)`,
        ).bind(iso, JSON.stringify(rows.slice(i, i + 400))),
      );
    }
    await env.DB.batch(stmts);
    return {
      status: "ok",
      members: spans.length,
      matched: rows.filter((r) => r[1] !== null).length,
      late: spans.filter((s) => s.joinedAt.slice(0, 10) > (SCORING.newcomer?.openingDay ?? "9999")).length,
      left: spans.filter((s) => s.leftAt).length,
    };
  } catch (e) {
    return { status: "loi", message: e instanceof SheetsError ? e.message : "Không đọc được lịch sử thành viên." };
  }
}
