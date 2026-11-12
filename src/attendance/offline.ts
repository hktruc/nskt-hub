// Điểm danh offline: đọc trang CHECK_IN (file "NSKT2026 - KỶ LUẬT - HỌC VIÊN") và trang DS_CHIA_THON
// (file "NSKT 2026 CHIA THÔN HỌC VIÊN"), ghép Mã Cư Dân → số điện thoại → học viên dh3g.
// Số điện thoại là định danh chính thức; Mã Cư Dân chỉ dùng để nối hai trang trong cùng một lần đọc.

import { vietnamDay } from "../dates";
import { isLearnerTeam, teamCode } from "../domain/teams";
import type { Env } from "../env";
import { accessToken, parseServiceAccount, readRange, SheetsError } from "../google/sheets";
import { SCORING } from "../scoring/config";

export type AttCode = "OK" | "M" | "X" | "M1" | "CANH_BAO" | "P" | "PD" | "VANG" | "KHAC";

/** Ký hiệu trong file → mã lưu trong D1. Ô trống → null (chưa điểm danh). */
export function normalizeCode(cell: string): AttCode | null {
  const s = cell.replace(/️/g, "").trim().toUpperCase();
  if (!s) return null;
  if (s === "✅" || s === "✔" || s === "V") return "OK";
  if (s === "M") return "M";
  if (s === "X") return "X";
  if (s === "M1") return "M1";
  if (s === "⚠") return "CANH_BAO";
  if (s === "P") return "P";
  if (s === "PD") return "PD";
  if (s === "❌" || s === "✖" || s === "✗") return "VANG";
  return "KHAC";
}

export function normPhone(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("84") && d.length >= 11) d = `0${d.slice(2)}`;
  if (d.length === 9) d = `0${d}`;
  return d;
}

const norm = (s: string) => s.normalize("NFC").trim().toLowerCase();

/** Tiêu đề cột "09-10" → "2026-10-09". Khóa học bắt đầu tháng 9: tháng < 9 tính sang năm sau. */
export function headerDay(h: string, startYear = Number(SCORING.startDate.slice(0, 4))): string | null {
  const m = h.trim().match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  const y = mo < 9 ? startYear + 1 : startYear;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export type CheckInRecord = { resident: string; day: string; code: AttCode };

/** Đọc trang CHECK_IN. Cột "KHAI GIANG" không có ngày nên không tính (điểm tính từ 30/09). */
/** Khóa so tên: chữ thường, gộp khoảng trắng. `loose`: bỏ cả dấu tiếng Việt. */
export function nameKey(name: string, loose = false): string {
  let s = name.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  if (loose) s = s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
  return s;
}

export function parseCheckIn(rows: string[][]): { residents: string[]; records: CheckInRecord[]; names: Map<string, string> } {
  const hi = rows.findIndex((r) => r.some((c) => norm(c) === "mã cư dân"));
  if (hi < 0) throw new SheetsError('Trang CHECK_IN không có cột "Mã Cư Dân".');
  const header = rows[hi]!;
  const col = header.findIndex((c) => norm(c) === "mã cư dân");
  const cName = header.findIndex((c) => norm(c) === "họ và tên" || norm(c) === "họ tên");
  const names = new Map<string, string>();
  const dayCols = header.map((h, i) => ({ i, day: headerDay(h) })).filter((x): x is { i: number; day: string } => x.day !== null);
  const residents: string[] = [];
  const records: CheckInRecord[] = [];
  for (const r of rows.slice(hi + 1)) {
    const resident = (r[col] ?? "").trim().toUpperCase();
    if (!/^T\d{4}$/.test(resident)) continue;
    residents.push(resident);
    if (cName >= 0 && r[cName]) names.set(resident, r[cName]!);
    for (const { i, day } of dayCols) {
      const code = normalizeCode(r[i] ?? "");
      if (code) records.push({ resident, day, code });
    }
  }
  return { residents, records, names };
}

/** Đọc trang DS_CHIA_THON: Mã Cư Dân → số điện thoại. */
export function parseRoster(rows: string[][]): Map<string, string> {
  const hi = rows.findIndex((r) => r.some((c) => norm(c) === "mã cư dân"));
  if (hi < 0) throw new SheetsError('Trang DS_CHIA_THON không có cột "Mã Cư Dân".');
  const header = rows[hi]!.map(norm);
  const cRes = header.indexOf("mã cư dân");
  const cPhone = header.findIndex((h) => h.startsWith("sđt") || h.includes("điện thoại"));
  if (cPhone < 0) throw new SheetsError("Trang DS_CHIA_THON không có cột số điện thoại.");
  const map = new Map<string, string>();
  for (const r of rows.slice(hi + 1)) {
    const res = (r[cRes] ?? "").trim().toUpperCase();
    const phone = normPhone(r[cPhone]);
    if (/^T\d{4}$/.test(res) && phone.length >= 9) map.set(res, phone);
  }
  return map;
}

export type SyncResult =
  | { status: "chua-cau-hinh" }
  | { status: "loi"; message: string }
  | { status: "ok"; sessions: number; residents: number; matched: number; unmatched: string[]; byName: string[]; rows: number };

export const CHECKIN_RANGE = "CHECK_IN!A1:AZ400";
export const ROSTER_RANGE = "DS_CHIA_THON!A1:Z400";

export async function syncOfflineAttendance(env: Env, now: Date, fetchImpl: typeof fetch = fetch): Promise<SyncResult> {
  const sa = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!sa || !env.SHEET_ATTENDANCE_ID || !env.SHEET_ROSTER_ID) return { status: "chua-cau-hinh" };
  const iso = now.toISOString();
  const log = (r: SyncResult) =>
    env.DB.prepare("INSERT INTO sheet_syncs (at, status, sessions, rows_total, matched, unmatched_json, by_name_json, message) VALUES (?,?,?,?,?,?,?,?)")
      .bind(
        iso,
        r.status,
        r.status === "ok" ? r.sessions : null,
        r.status === "ok" ? r.residents : null,
        r.status === "ok" ? r.matched : null,
        r.status === "ok" ? JSON.stringify(r.unmatched) : null,
        r.status === "ok" ? JSON.stringify(r.byName) : null,
        r.status === "loi" ? r.message : null,
      )
      .run();
  try {
    const token = await accessToken(sa, now, fetchImpl);
    const [checkIn, roster] = await Promise.all([
      readRange(token, env.SHEET_ATTENDANCE_ID, CHECKIN_RANGE, fetchImpl),
      readRange(token, env.SHEET_ROSTER_ID, ROSTER_RANGE, fetchImpl),
    ]);
    const { residents, records, names } = parseCheckIn(checkIn);
    const phoneOf = parseRoster(roster);
    const learners = (
      await env.DB.prepare("SELECT l.id, l.phone, l.full_name, t.name AS team_name FROM learners l LEFT JOIN teams t ON t.id = l.team_id").all<{
        id: number;
        phone: string | null;
        full_name: string | null;
        team_name: string | null;
      }>()
    ).results;
    const byPhone = new Map<string, number>();
    for (const l of learners) {
      const p = normPhone(l.phone);
      // Ưu tiên người thuộc 12 đội khi trùng số.
      if (p && (!byPhone.has(p) || isLearnerTeam(teamCode(l.team_name)))) byPhone.set(p, l.id);
    }
    // 1) Ghép theo số điện thoại (định danh chính thức).
    const learnerOf = new Map<string, number>();
    const pending: string[] = [];
    for (const res of new Set(residents)) {
      const id = byPhone.get(phoneOf.get(res) ?? "");
      if (id === undefined) pending.push(res);
      else learnerOf.set(res, id);
    }
    // 2) Còn lại: ghép theo họ tên, CHỈ trong cùng đội (T03xx ↔ Đội Cá Chép 03), chỉ với người dh3g
    //    chưa được ghép, và chỉ khi có đúng một người trùng tên (chủ dự án cho phép 12/11/2026:
    //    một số học viên đăng nhập dh3g bằng số cũ từ các khóa trước).
    const taken = new Set(learnerOf.values());
    const byName: string[] = [];
    const unmatched: string[] = [];
    for (const res of pending) {
      const name = names.get(res);
      const team = res.slice(0, 3);
      let id: number | undefined;
      for (const loose of [false, true]) {
        if (!name) break;
        const key = nameKey(name, loose);
        const cands = learners.filter(
          (l) => !taken.has(l.id) && teamCode(l.team_name) === team && l.full_name && nameKey(l.full_name, loose) === key,
        );
        if (cands.length === 1) id = cands[0]!.id;
        if (cands.length > 0) break; // trùng nhiều người: không đoán
      }
      if (id === undefined) unmatched.push(res);
      else {
        learnerOf.set(res, id);
        taken.add(id);
        byName.push(res);
      }
    }
    const today = vietnamDay(now);
    const keep = records.filter((r) => r.day >= SCORING.startDate && r.day <= today && learnerOf.has(r.resident));
    const rows = keep.map((r) => [learnerOf.get(r.resident)!, r.day, r.code, r.resident]);
    // Thay toàn bộ trong một lượt để không bao giờ còn nửa cũ nửa mới.
    const stmts = [env.DB.prepare("DELETE FROM offline_attendance")];
    for (let i = 0; i < rows.length; i += 500) {
      stmts.push(
        env.DB.prepare(
          `INSERT OR REPLACE INTO offline_attendance (learner_id, session_day, code, resident_code, synced_at)
           SELECT json_extract(value,'$[0]'), json_extract(value,'$[1]'), json_extract(value,'$[2]'), json_extract(value,'$[3]'), ?
           FROM json_each(?)`,
        ).bind(iso, JSON.stringify(rows.slice(i, i + 500))),
      );
    }
    await env.DB.batch(stmts);
    const result: SyncResult = {
      status: "ok",
      sessions: new Set(keep.map((r) => r.day)).size,
      residents: new Set(residents).size,
      matched: learnerOf.size,
      unmatched: unmatched.sort(),
      byName: byName.sort(),
      rows: rows.length,
    };
    await log(result);
    return result;
  } catch (e) {
    const result: SyncResult = { status: "loi", message: e instanceof SheetsError ? e.message : `Lỗi không rõ: ${String(e).slice(0, 200)}` };
    await log(result);
    return result;
  }
}

/** Mỗi giờ một lần (ở lượt cron 5 phút đầu tiên của giờ). */
export function isHourlySlot(now: Date): boolean {
  return now.getUTCMinutes() < 5;
}
