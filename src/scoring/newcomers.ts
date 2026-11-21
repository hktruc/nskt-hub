// Người vào sau khai giảng và người đã rời lớp: quy tắc công bằng cho bảng xếp hạng (chủ dự án duyệt 20–21/11/2026).
//  - Chỉ tính bài và buổi học từ NGÀY VÀO + ân hạn (ngày vào là "mới vào lớp", `graceDays` ngày sau là ân hạn, từ ngày kế tiếp mới tính).
//  - Chưa đủ `rankAfterDays` (6 tuần) kể từ ngày vào thì chưa xếp hạng, và chưa tính vào điểm đội: hiện ở bảng "Mới vào".
//  - Người đã rời lớp bị bỏ khỏi bảng xếp hạng (cá nhân lẫn đội).
// Người không có dữ liệu trong lịch sử thành viên được xử lý như trước (không áp quy tắc nào).

import { addDays } from "../dates";
import { SCORING } from "./config";

export type MemberRow = { learner_id: number; joined_at: string; left_at: string | null };

export type MemberInfo = {
  joinedDay: string; // yyyy-mm-dd
  start: string; // ngày đầu tiên được tính điểm
  eligibleOn: string; // ngày được đưa vào bảng xếp hạng chính
  newcomer: boolean; // hôm nay còn "mới vào" (chưa tới eligibleOn)
  daysLeft: number; // số ngày nữa tới eligibleOn
};

const dayOf = (s: string) => s.slice(0, 10);
const daysBetween = (a: string, b: string) => Math.floor((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Quy tắc của một thành viên tại ngày `today` (yyyy-mm-dd). `late` = vào sau khai giảng. */
export function membershipOf(m: MemberRow, today: string, cfg = SCORING.newcomer): { late: MemberInfo | null; left: boolean } {
  if (!cfg) return { late: null, left: false };
  const left = m.left_at !== null && dayOf(m.left_at) <= today;
  const joinedDay = dayOf(m.joined_at);
  if (joinedDay <= cfg.openingDay) return { late: null, left };
  const eligibleOn = addDays(joinedDay, cfg.rankAfterDays);
  return {
    left,
    late: {
      joinedDay,
      start: addDays(joinedDay, cfg.graceDays + 1),
      eligibleOn,
      newcomer: today < eligibleOn,
      daysLeft: Math.max(0, daysBetween(today, eligibleOn)),
    },
  };
}

/** Lọc bài và buổi học theo ngày vào, bỏ người đã rời. Trả thêm tập người đang "mới vào" và thông tin từng người vào sau. */
export function applyMembership<R extends { learner_id: number; due_at: string }, A extends { learner_id: number; session_day: string }>(
  rows: R[],
  att: A[],
  members: MemberRow[],
  today: string,
) {
  const info = new Map<number, MemberInfo>();
  const leavers = new Set<number>();
  const newcomers = new Set<number>();
  for (const m of members) {
    const { late, left } = membershipOf(m, today);
    if (left) leavers.add(m.learner_id);
    if (late) {
      info.set(m.learner_id, late);
      if (late.newcomer) newcomers.add(m.learner_id);
    }
  }
  const startOf = (id: number) => info.get(id)?.start;
  return {
    rows: rows.filter((r) => !leavers.has(r.learner_id) && !(startOf(r.learner_id) && dayOf(r.due_at) < startOf(r.learner_id)!)),
    att: att.filter((a) => !leavers.has(a.learner_id) && !(startOf(a.learner_id) && a.session_day < startOf(a.learner_id)!)),
    info,
    newcomers,
    leavers,
  };
}
