// Tài khoản nội bộ: tạo, cấp mã kích hoạt, kích hoạt, đăng nhập, phiên, thu hồi, giao đội.
// Mật khẩu và mã kích hoạt chỉ lưu dạng băm PBKDF2-SHA256; mã phiên chỉ lưu dạng băm SHA-256.

import { normPhone } from "../attendance/offline";
import { mondayOf, vietnamDay } from "../dates";

export type Role = "admin" | "btc" | "coach" | "phung_su";
export const ROLES: Role[] = ["admin", "btc", "coach", "phung_su"];
export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", btc: "BTC", coach: "Coach", phung_su: "Ban phụng sự" };

export type User = { id: number; name: string; phone: string; role: Role; teams: string[]; viaAccess?: boolean };

const ITER = 100_000; // giới hạn tối đa của Cloudflare Workers cho PBKDF2
const CODE_DAYS = 7;
const SESSION_DAYS = 30;
const MAX_FAILS = 5;
const LOCK_MIN = 15;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // bỏ chữ dễ nhầm: I, L, O, 0, 1

export const SESSION_COOKIE = "nskt_s";
export const SESSION_MAX_AGE = SESSION_DAYS * 86_400;

const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (b: Uint8Array) => b64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function pbkdf2(secret: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
}

export async function hashSecret(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await pbkdf2(secret, salt, ITER))}`;
}

export async function verifySecret(secret: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = await pbkdf2(secret, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}

async function sha256(s: string): Promise<string> {
  return b64(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

export function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function cleanPhone(raw: string): string | null {
  const p = normPhone(raw);
  return /^0\d{9,10}$/.test(p) ? p : null;
}

type UserRow = {
  id: number;
  phone: string;
  name: string;
  role: Role;
  password_hash: string | null;
  code_hash: string | null;
  code_expires_at: string | null;
  active: number;
  failed_count: number;
  locked_until: string | null;
  created_at: string;
  last_login_at: string | null;
};

export class AccountError extends Error {}

/** Đội được giao cho người chấm trong tuần `week` (thứ Hai): lần giao gần nhất có hiệu lực từ tuần đó trở về trước. */
export async function teamsFor(db: D1Database, userId: number, week: string): Promise<string[]> {
  const r = await db
    .prepare("SELECT teams_json FROM grader_team_plans WHERE user_id = ? AND from_week <= ? ORDER BY from_week DESC LIMIT 1")
    .bind(userId, week)
    .first<{ teams_json: string }>();
  return r ? (JSON.parse(r.teams_json) as string[]).sort() : [];
}
export const thisWeek = (now: Date) => mondayOf(vietnamDay(now));
async function teamsOf(db: D1Database, userId: number): Promise<string[]> {
  return teamsFor(db, userId, thisWeek(new Date()));
}

/** Admin tạo tài khoản; trả về mã kích hoạt (chỉ hiện một lần). */
export async function createUser(db: D1Database, input: { phone: string; name: string; role: string }, by: string, now: Date): Promise<string> {
  const phone = cleanPhone(input.phone);
  const name = input.name.trim();
  if (!phone) throw new AccountError("Số điện thoại không hợp lệ.");
  if (!name) throw new AccountError("Cần nhập họ tên.");
  if (!ROLES.includes(input.role as Role)) throw new AccountError("Vai trò không hợp lệ.");
  if (await db.prepare("SELECT 1 FROM users WHERE phone = ?").bind(phone).first()) throw new AccountError("Số điện thoại này đã có tài khoản.");
  const code = newCode();
  await db
    .prepare("INSERT INTO users (phone, name, role, code_hash, code_expires_at, created_at, created_by) VALUES (?,?,?,?,?,?,?)")
    .bind(phone, name, input.role, await hashSecret(normCode(code)), new Date(now.getTime() + CODE_DAYS * 86_400_000).toISOString(), now.toISOString(), by)
    .run();
  return code;
}

/** Cấp lại mã (quên mật khẩu, hoặc mã cũ hết hạn): mật khẩu cũ và mọi phiên bị hủy. */
export async function reissueCode(db: D1Database, userId: number, now: Date): Promise<string> {
  const code = newCode();
  await db.batch([
    db
      .prepare("UPDATE users SET code_hash = ?, code_expires_at = ?, password_hash = NULL, failed_count = 0, locked_until = NULL WHERE id = ?")
      .bind(await hashSecret(normCode(code)), new Date(now.getTime() + CODE_DAYS * 86_400_000).toISOString(), userId),
    db.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId),
  ]);
  return code;
}

export async function setActive(db: D1Database, userId: number, active: boolean): Promise<void> {
  const stmts = [db.prepare("UPDATE users SET active = ? WHERE id = ?").bind(active ? 1 : 0, userId)];
  if (!active) stmts.push(db.prepare("DELETE FROM user_sessions WHERE user_id = ?").bind(userId));
  await db.batch(stmts);
}

export async function setRole(db: D1Database, userId: number, role: string): Promise<void> {
  if (!ROLES.includes(role as Role)) throw new AccountError("Vai trò không hợp lệ.");
  await db.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, userId).run();
}

/** Giao đội từ tuần `fromWeek` (thứ Hai) trở đi; các tuần sau giữ nguyên cho tới lần giao kế tiếp. */
export async function setTeams(db: D1Database, userId: number, teams: string[], by: string, now: Date, fromWeek = thisWeek(now)): Promise<void> {
  const clean = [...new Set(teams.filter((t) => /^T(0[1-9]|1[0-2])$/.test(t)))].sort();
  await db
    .prepare(
      `INSERT INTO grader_team_plans (user_id, from_week, teams_json, set_by, set_at) VALUES (?,?,?,?,?)
       ON CONFLICT(user_id, from_week) DO UPDATE SET teams_json=excluded.teams_json, set_by=excluded.set_by, set_at=excluded.set_at`,
    )
    .bind(userId, mondayOf(fromWeek), JSON.stringify(clean), by, now.toISOString())
    .run();
}

async function registerFail(db: D1Database, u: UserRow, now: Date) {
  const fails = u.failed_count + 1;
  const lock = fails >= MAX_FAILS ? new Date(now.getTime() + LOCK_MIN * 60_000).toISOString() : null;
  await db.prepare("UPDATE users SET failed_count = ?, locked_until = ? WHERE id = ?").bind(lock ? 0 : fails, lock, u.id).run();
}

const LOCKED = `Nhập sai nhiều lần, tài khoản tạm khóa ${LOCK_MIN} phút. Thử lại sau.`;
const WRONG = "Số điện thoại hoặc mật khẩu không đúng.";

async function findForLogin(db: D1Database, rawPhone: string, now: Date): Promise<UserRow> {
  const phone = cleanPhone(rawPhone);
  const u = phone ? await db.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first<UserRow>() : null;
  if (!u || !u.active) throw new AccountError(WRONG);
  if (u.locked_until && u.locked_until > now.toISOString()) throw new AccountError(LOCKED);
  return u;
}

async function startSession(db: D1Database, userId: number, now: Date): Promise<string> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await db.batch([
    db.prepare("DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?").bind(userId, now.toISOString()),
    db
      .prepare("INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)")
      .bind(await sha256(token), userId, now.toISOString(), new Date(now.getTime() + SESSION_MAX_AGE * 1000).toISOString()),
    db.prepare("UPDATE users SET failed_count = 0, locked_until = NULL, last_login_at = ? WHERE id = ?").bind(now.toISOString(), userId),
  ]);
  return token;
}

/** Kích hoạt lần đầu (hoặc sau khi được cấp lại mã): đặt mật khẩu, trả về mã phiên. */
export async function activate(db: D1Database, input: { phone: string; code: string; password: string; confirm: string }, now: Date): Promise<string> {
  if (input.password.length < 8) throw new AccountError("Mật khẩu cần ít nhất 8 ký tự.");
  if (input.password !== input.confirm) throw new AccountError("Hai lần nhập mật khẩu không giống nhau.");
  const u = await findForLogin(db, input.phone, now);
  const valid = u.code_hash && u.code_expires_at && u.code_expires_at > now.toISOString() && (await verifySecret(normCode(input.code), u.code_hash));
  if (!valid) {
    await registerFail(db, u, now);
    throw new AccountError("Mã kích hoạt không đúng hoặc đã hết hạn. Nhờ admin cấp mã mới.");
  }
  await db.prepare("UPDATE users SET password_hash = ?, code_hash = NULL, code_expires_at = NULL WHERE id = ?").bind(await hashSecret(input.password), u.id).run();
  return startSession(db, u.id, now);
}

export async function login(db: D1Database, phone: string, password: string, now: Date): Promise<string> {
  const u = await findForLogin(db, phone, now);
  if (!u.password_hash) throw new AccountError("Tài khoản chưa kích hoạt. Vào trang Kích hoạt và nhập mã admin đã gửi.");
  if (!(await verifySecret(password, u.password_hash))) {
    await registerFail(db, u, now);
    throw new AccountError(WRONG);
  }
  return startSession(db, u.id, now);
}

export async function changePassword(db: D1Database, userId: number, input: { current: string; password: string; confirm: string }): Promise<void> {
  if (input.password.length < 8) throw new AccountError("Mật khẩu mới cần ít nhất 8 ký tự.");
  if (input.password !== input.confirm) throw new AccountError("Hai lần nhập mật khẩu mới không giống nhau.");
  const u = await db.prepare("SELECT password_hash FROM users WHERE id = ?").bind(userId).first<{ password_hash: string | null }>();
  if (!(await verifySecret(input.current, u?.password_hash ?? null))) throw new AccountError("Mật khẩu hiện tại không đúng.");
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashSecret(input.password), userId).run();
}

export async function sessionUser(db: D1Database, token: string | undefined, now: Date): Promise<User | null> {
  if (!token || token.length < 20) return null;
  const u = await db
    .prepare(
      `SELECT u.id, u.name, u.phone, u.role FROM user_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1 AND u.password_hash IS NOT NULL`,
    )
    .bind(await sha256(token), now.toISOString())
    .first<{ id: number; name: string; phone: string; role: Role }>();
  return u ? { ...u, teams: await teamsOf(db, u.id) } : null;
}

export async function logout(db: D1Database, token: string | undefined): Promise<void> {
  if (token) await db.prepare("DELETE FROM user_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export type UserListItem = UserRow & { teams: string[]; plans: { fromWeek: string; teams: string[] }[]; status: "cho-kich-hoat" | "dang-dung" | "thu-hoi" };

export async function listUsers(db: D1Database): Promise<UserListItem[]> {
  const [users, teams] = await db.batch([
    db.prepare("SELECT * FROM users ORDER BY active DESC, CASE role WHEN 'admin' THEN 0 WHEN 'btc' THEN 1 WHEN 'coach' THEN 2 ELSE 3 END, name"),
    db.prepare("SELECT user_id, from_week, teams_json FROM grader_team_plans ORDER BY from_week"),
  ]);
  const week = thisWeek(new Date());
  const plans = new Map<number, { fromWeek: string; teams: string[] }[]>();
  for (const t of (teams?.results ?? []) as { user_id: number; from_week: string; teams_json: string }[])
    plans.set(t.user_id, [...(plans.get(t.user_id) ?? []), { fromWeek: t.from_week, teams: JSON.parse(t.teams_json) as string[] }]);
  const current = (id: number) => [...(plans.get(id) ?? [])].reverse().find((p) => p.fromWeek <= week)?.teams ?? [];
  return ((users?.results ?? []) as UserRow[]).map((u) => ({
    ...u,
    teams: current(u.id),
    plans: plans.get(u.id) ?? [],
    status: !u.active ? "thu-hoi" : u.password_hash ? "dang-dung" : "cho-kich-hoat",
  }));
}

/** Nhãn ghi vào lịch sử thao tác (vd. điểm sửa tay). */
export function userLabel(u: User): string {
  return u.viaAccess ? u.name : `${u.name} (${ROLE_LABEL[u.role]}, …${u.phone.slice(-4)})`;
}

/** Ban phụng sự chỉ dùng bàn chấm; các vai trò khác dùng mọi trang nội bộ. */
export function canUseFullApp(u: User): boolean {
  return u.role !== "phung_su";
}
