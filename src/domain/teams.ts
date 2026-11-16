// Đội học viên: mã T01…Txx theo hồ sơ khóa học (vd. NSKT2026: "🐟 Đội Cá Chép 01"…"12" = T01…T12), ngoài ra có đội ban tổ chức "BTC".

import { COURSE } from "../course";

export type TeamCode = string; // "T01"…, "BTC" hoặc "" (chưa có đội)

export function teamCode(name: string | null | undefined): TeamCode {
  if (!name) return "";
  const n = COURSE.teams.numberOf(name);
  if (n !== null && n >= 1 && n <= COURSE.teams.count) return `T${String(n).padStart(2, "0")}`;
  if (COURSE.teams.staffRe.test(name)) return "BTC";
  return "";
}

/** Mọi mã đội học viên của khóa: T01…Txx. */
export function teamCodes(): TeamCode[] {
  return Array.from({ length: COURSE.teams.count }, (_, i) => `T${String(i + 1).padStart(2, "0")}`);
}

export function isLearnerTeam(code: TeamCode): boolean {
  if (!/^T\d\d$/.test(code)) return false;
  const n = Number(code.slice(1));
  return n >= 1 && n <= COURSE.teams.count;
}

export function teamLabel(code: TeamCode): string {
  if (isLearnerTeam(code)) return COURSE.teams.label(Number(code.slice(1)));
  if (code === "BTC") return "BTC";
  return "Chưa có đội";
}
