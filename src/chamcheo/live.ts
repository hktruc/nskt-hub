// Màn hình chấm chéo bản mới (/cham-cheo-moi): đọc bảng tính "NSKT2026 - CHẤM CHÉO BÀI TẬP" (trang CHAM_CHEO_LOG)
// và danh sách đội từ trang CHECK_IN, rồi trả cho màn hình. CHỈ ĐỌC: không ghi gì vào D1 hay vào bảng tính.
// Cách đọc dựa trên bản bàn giao của màn hình cũ (cột, khoá nhận dạng, kiểm tra đầu bảng).

import { CHECKIN_RANGE, parseCheckIn } from "../attendance/offline";
import { COURSE } from "../course";
import type { Env } from "../env";
import { accessToken, parseServiceAccount, readRange, SheetsError } from "../google/sheets";

export const LOG_RANGE = "CHAM_CHEO_LOG!A1:Z10000";
const HEADERS = ["Thời gian gửi", "Cập nhật lúc", "Số lần sửa", "Mã đợt", "Tên đợt", "Thôn", "Mã người chấm", "Người chấm", "Mã người được chấm", "Người được chấm"];
const CRITERIA = ["Sơ đồ", "Thuyết phục", "Phản biện", "Đặt câu hỏi"];
const TEAM_RE = /^T(0[1-9]|1[0-2])(?=\d)/;
const nfc = (s: unknown) => String(s ?? "").normalize("NFC").trim();

export type StagePerson = { id: string; ten: string; doi: string };
export type StageRecord = {
  khoa: string;
  gui: string;
  ngay: string;
  nguoiCham: StagePerson;
  nguoiNhan: StagePerson;
  tomTat: string;
  tieuChi: { ten: string; diem: string; nhanXet: string }[];
  diemTB: string;
};
export type ParsedLog = { records: StageRecord[]; total: number; dropped: { lyDo: string; soDong: number }[]; merged: number };

const teamOf = (id: string) => (id.toUpperCase().match(TEAM_RE) || [])[0] ?? "";

/** "dd/MM/yyyy …" → "yyyy-MM-dd". */
function dayOfTime(s: string): string {
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : "";
}

/** Mã đợt → ngày học. "CC-T1" là buổi thứ Sáu đầu tiên (02/10/2026); "CC-YYYYMMDD" là ngày ghi sẵn trong mã. */
export function roundDay(round: string): string {
  if (round === "CC-T1") return "2026-10-02";
  const m = round.match(/^CC-(\d{4})(\d{2})(\d{2})$/);
  if (!m) return "";
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day ? day : "";
}

export function parseLog(rows: string[][]): ParsedLog {
  const header = rows[0] ?? [];
  if (HEADERS.some((h, i) => nfc(header[i]) !== h) || nfc(header[24]) !== "Khoá") {
    throw new SheetsError("Bảng chấm chéo đã đổi cột đầu bảng nên màn hình tạm dừng đọc để khỏi hiện sai. Hãy báo người phụ trách.");
  }
  const drop = new Map<string, number>();
  const bad = (why: string) => drop.set(why, (drop.get(why) ?? 0) + 1);
  const byKey = new Map<string, StageRecord>();
  let total = 0;
  let merged = 0;
  for (const r of rows.slice(1)) {
    if (!r.some((c) => nfc(c))) continue;
    total++;
    const fromId = nfc(r[6]).toUpperCase(), toId = nfc(r[8]).toUpperCase();
    const fromName = nfc(r[7]), toName = nfc(r[9]);
    if (!fromId || !toId || !fromName || !toName) { bad("Thiếu mã hoặc tên người chấm / người được chấm"); continue; }
    if (fromId === toId) { bad("Tự chấm chính mình"); continue; }
    const fromTeam = teamOf(fromId), toTeam = teamOf(toId);
    if (!fromTeam || !toTeam) { bad("Mã đội không hợp lệ (ví dụ dòng thử của BTC)"); continue; }
    const round = nfc(r[3]);
    const gui = nfc(r[1]) || nfc(r[0]);
    const khoa = nfc(r[24]) || `${round}|${fromId}|${toId}`;
    const rec: StageRecord = {
      khoa,
      gui,
      ngay: roundDay(round) || dayOfTime(gui) || dayOfTime(nfc(r[0])),
      nguoiCham: { id: fromId, ten: fromName, doi: fromTeam },
      nguoiNhan: { id: toId, ten: toName, doi: toTeam },
      tomTat: nfc(r[10]),
      tieuChi: CRITERIA.map((ten, i) => ({ ten, diem: nfc(r[11 + i * 2]), nhanXet: nfc(r[12 + i * 2]) })),
      diemTB: nfc(r[19]),
    };
    if (byKey.has(khoa)) merged++;
    byKey.set(khoa, rec); // cùng khoá: lấy bản mới nhất
  }
  return { records: [...byKey.values()], total, dropped: [...drop].map(([lyDo, soDong]) => ({ lyDo, soDong })), merged };
}

export type StageRoster = { ma: string; thanhVien: { id: string; ten: string; vang?: boolean }[] }[];

/** Danh sách đội từ trang CHECK_IN. Với BTC: đánh dấu người vắng ở buổi `day` (chỉ khi cột ngày đó đã có người điểm danh). */
export function buildRoster(checkIn: string[][] | null, day: string, withAbsent: boolean): StageRoster {
  if (!checkIn) return [];
  let parsed: ReturnType<typeof parseCheckIn>;
  try { parsed = parseCheckIn(checkIn); } catch { return []; }
  const dayRecords = parsed.records.filter((x) => x.day === day);
  const present = new Map(dayRecords.map((x) => [x.resident, x.code]));
  const teams = new Map<string, { id: string; ten: string; vang?: boolean }[]>();
  for (const id of new Set(parsed.residents)) {
    const team = teamOf(id);
    if (!team) continue;
    const code = present.get(id);
    const member: { id: string; ten: string; vang?: boolean } = { id, ten: parsed.names.get(id) ?? id };
    if (withAbsent && dayRecords.length > 0 && (!code || code === "VANG" || code === "P")) member.vang = true;
    teams.set(team, [...(teams.get(team) ?? []), member]);
  }
  return [...teams].sort(([a], [b]) => a.localeCompare(b)).map(([ma, thanhVien]) => ({ ma, thanhVien }));
}

/** Buổi học thứ mấy: đếm theo tuần kể từ buổi đầu (hồ sơ khóa). Không phải đúng thứ trong tuần thì để trống. */
export function sessionOf(day: string): { so: number; tuan: number } | null {
  const first = COURSE.chamCheo?.firstSessionDay;
  if (!first) return null;
  const diff = (Date.parse(`${day}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000;
  return diff >= 0 && Number.isInteger(diff) && diff % 7 === 0 ? { so: diff / 7 + 1, tuan: diff / 7 + 1 } : null;
}

export type StageSource = { log: string[][]; checkIn: string[][] | null };

/** Câu trả lời cho màn hình. `nguon` (kiểm nguồn) và `vang` chỉ dành cho BTC. */
export function buildDay(source: StageSource, day: string, btc: boolean) {
  const parsed = parseLog(source.log);
  const luot = parsed.records.filter((r) => r.ngay === day).map(({ ngay: _ngay, ...r }) => r);
  return {
    buoi: sessionOf(day),
    doi: buildRoster(source.checkIn, day, btc),
    luot,
    ...(btc
      ? { nguon: { tongDong: parsed.total, hienThi: parsed.records.length, bo: parsed.total - parsed.records.length - parsed.merged, lyDo: parsed.dropped, gop: parsed.merged, trongNgay: luot.length } }
      : {}),
  };
}

// ---- Đọc nguồn, có đệm ngắn để nhiều máy cùng hỏi (mỗi 10 giây) không làm quá tải Google ----
const TTL_MS = 8000;
let cache: { at: number; value: StageSource } | null = null;
let inflight: Promise<StageSource> | null = null;
let token: { value: string; until: number } | null = null;

export type SourceResult = { status: "chua-cau-hinh" } | { status: "ok"; value: StageSource };

export async function loadSource(env: Env, now: Date, fetchImpl: typeof fetch = fetch): Promise<SourceResult> {
  const sa = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!sa || !env.SHEET_CHAMCHEO_ID) return { status: "chua-cau-hinh" };
  if (cache && now.getTime() - cache.at < TTL_MS && now.getTime() >= cache.at) return { status: "ok", value: cache.value };
  if (!inflight) {
    inflight = (async () => {
      if (!token || token.until <= now.getTime()) token = { value: await accessToken(sa, now, fetchImpl), until: now.getTime() + 50 * 60_000 };
      const t = token.value;
      const [log, checkIn] = await Promise.all([
        readRange(t, env.SHEET_CHAMCHEO_ID!, LOG_RANGE, fetchImpl),
        // Danh sách đội lấy từ file điểm danh; không đọc được thì màn hình vẫn chạy, chỉ thiếu danh sách đội.
        env.SHEET_ATTENDANCE_ID ? readRange(t, env.SHEET_ATTENDANCE_ID, CHECKIN_RANGE, fetchImpl).catch(() => null) : Promise.resolve(null),
      ]);
      const value = { log, checkIn };
      cache = { at: now.getTime(), value };
      return value;
    })().catch((e) => { token = null; throw e; }).finally(() => { inflight = null; });
  }
  return { status: "ok", value: await inflight };
}

/** Dùng trong kiểm thử: xoá đệm giữa các lần thử. */
export function resetSourceCache() { cache = null; inflight = null; token = null; }
