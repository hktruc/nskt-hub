// Quỹ gieo hạt: số tiền học viên đã bị trừ dần (do vi phạm kỷ luật) từ số tiền cam kết đã đóng khi vào khóa.
// Nguồn: file Google Sheet "NSKT2026 — KỶ LUẬT TỔNG", tab TONG_HOP (tự cập nhật 15 phút một lần, do hệ thống kỷ luật của BTC quản lý).
// CHỈ ĐỌC. Không lưu gì vào D1: tên và số tiền của học viên chỉ đi từ bảng tính tới màn hình BTC.

import type { Env } from "../env";
import { accessToken, parseServiceAccount, readRange, SheetsError } from "../google/sheets";

export const FUND_RANGE = "TONG_HOP!A1:Z3000";
const TEAM_RE = /^T(0[1-9]|1[0-2])$/;
const norm = (s: unknown) => String(s ?? "").normalize("NFC").trim().toLowerCase();

export type FundMember = {
  team: string;
  id: string;
  name: string;
  status: string;
  personal: number; // trừ vì lỗi của chính mình
  byTeam: number; // trừ theo vì đồng đội cùng đội vi phạm
  total: number;
};
export type FundData = { updatedText: string; members: FundMember[]; skipped: number };

/** "1.125.000", "1,125,000", "1125000 đ", "-25.000" → số nguyên đồng. Ô trống hoặc chữ → 0. */
export function parseMoney(raw: unknown): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const negative = /^[-−–]/.test(s);
  const digits = s.replace(/\D/g, "");
  return digits ? (negative ? -1 : 1) * Number(digits) : 0;
}

/** Dòng 1 của tab có dạng "Cập nhật 11:03 20/11/2026 · …": lấy phần giờ và ngày. */
function updatedOf(rows: string[][]): string {
  for (const r of rows.slice(0, 3)) {
    const m = String(r[0] ?? "").match(/(\d{1,2}:\d{2})\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (m) return `${m[1]} ${m[2]}`;
  }
  return "";
}

export function parseFund(rows: string[][]): FundData {
  const hi = rows.findIndex((r) => r.some((c) => norm(c) === "mã cư dân"));
  const header = (hi >= 0 ? rows[hi]! : []).map(norm);
  const col = (name: string) => header.indexOf(norm(name));
  const need = { team: col("Thôn"), id: col("Mã Cư Dân"), name: col("Họ và Tên"), status: col("Trạng thái"), personal: col("Trừ cá nhân (đ)"), byTeam: col("Trừ do đội (đ)"), total: col("Tổng trừ (đ)") };
  if (hi < 0 || Object.values(need).some((i) => i < 0)) {
    throw new SheetsError("Tab TONG_HOP của bảng kỷ luật đã đổi cột đầu bảng nên trang tạm dừng đọc để khỏi hiện sai. Hãy báo người phụ trách.");
  }
  const members: FundMember[] = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const id = String(r[need.id] ?? "").trim().toUpperCase();
    if (!id) continue;
    const team = String(r[need.team] ?? "").trim().toUpperCase();
    if (!TEAM_RE.test(team)) { skipped++; continue; } // dòng không thuộc 12 đội (ví dụ BTC)
    const personal = parseMoney(r[need.personal]);
    const byTeam = parseMoney(r[need.byTeam]);
    const total = parseMoney(r[need.total]);
    members.push({ team, id, name: String(r[need.name] ?? "").trim() || id, status: String(r[need.status] ?? "").trim(), personal, byTeam, total });
  }
  return { updatedText: updatedOf(rows), members, skipped };
}

// ---- Tổng hợp ----
export type TeamRow = { team: string; members: number; paying: number; personal: number; byTeam: number; total: number; share: number };
export type FundSummary = { total: number; personal: number; byTeam: number; members: number; paying: number; teams: TeamRow[] };

export function summarize(members: FundMember[]): FundSummary {
  const total = members.reduce((n, m) => n + m.total, 0);
  const by = new Map<string, TeamRow>();
  for (const m of members) {
    const t = by.get(m.team) ?? { team: m.team, members: 0, paying: 0, personal: 0, byTeam: 0, total: 0, share: 0 };
    t.members++;
    if (m.total > 0) t.paying++;
    t.personal += m.personal;
    t.byTeam += m.byTeam;
    t.total += m.total;
    by.set(m.team, t);
  }
  const teams = [...by.values()].sort((a, b) => a.team.localeCompare(b.team));
  for (const t of teams) t.share = total ? Math.round((1000 * t.total) / total) / 10 : 0;
  return {
    total,
    personal: members.reduce((n, m) => n + m.personal, 0),
    byTeam: members.reduce((n, m) => n + m.byTeam, 0),
    members: members.length,
    paying: members.filter((m) => m.total > 0).length,
    teams,
  };
}

// ---- Đọc nguồn (đệm 60 giây để nhiều BTC cùng mở không làm nặng Google) ----
const TTL_MS = 60_000;
let cache: { at: number; value: FundData } | null = null;
export type FundResult = { status: "chua-cau-hinh" } | { status: "ok"; data: FundData };

export async function loadFund(env: Env, now: Date, fetchImpl: typeof fetch = fetch): Promise<FundResult> {
  const sa = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  if (!sa || !env.SHEET_KYLUAT_ID) return { status: "chua-cau-hinh" };
  if (cache && now.getTime() >= cache.at && now.getTime() - cache.at < TTL_MS) return { status: "ok", data: cache.value };
  const token = await accessToken(sa, now, fetchImpl);
  const data = parseFund(await readRange(token, env.SHEET_KYLUAT_ID, FUND_RANGE, fetchImpl));
  cache = { at: now.getTime(), value: data };
  return { status: "ok", data };
}
/** Dùng trong kiểm thử. */
export function resetFundCache() { cache = null; }
