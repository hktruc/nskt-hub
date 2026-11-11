// Tên đội trên dh3g là "🐟 Đội Cá Chép 01"…"12" (= thôn T01…T12), ngoài ra có đội "BTC".

export type TeamCode = string; // "T01".."T12", "BTC" hoặc "" (chưa có đội)

export function teamCode(name: string | null | undefined): TeamCode {
  if (!name) return "";
  const m = name.match(/c[áa]\s*ch[ée]p\s*0?(\d{1,2})\b/i);
  if (m) return `T${m[1]!.padStart(2, "0")}`;
  if (/^\s*btc\s*$/i.test(name)) return "BTC";
  return "";
}

export function isLearnerTeam(code: TeamCode): boolean {
  return /^T\d\d$/.test(code);
}

export function teamLabel(code: TeamCode): string {
  if (isLearnerTeam(code)) return `Đội ${code.slice(1)}`;
  if (code === "BTC") return "BTC";
  return "Chưa có đội";
}
