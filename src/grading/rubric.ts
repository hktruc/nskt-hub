// Bộ tiêu chí chấm bài tuần — đúng như docs/TIEU-CHI-CHAM.md (chủ dự án duyệt 12/11/2026).

import { COURSE } from "../course";
export type { Criterion } from "../course/types";

// Tiêu chí riêng từng khóa nằm trong hồ sơ khóa học.
export const VIDEO_CRITERIA = COURSE.grading.videoCriteria;
export const DIAGRAM_CRITERION = COURSE.grading.diagram;
export const B2 = COURSE.grading.writing;
export const FOCUS_OPTIONS = COURSE.grading.focusOptions;
export const DEFAULT_FOCUS = FOCUS_OPTIONS[0]!;

export const FLAGS: Record<string, string> = {
  "khong-xem-duoc": "Không xem được",
  "khong-dung-de": "Không đúng đề",
  "trung-bai-cu": "Trùng bài cũ",
};
export const SPIRIT: Record<string, string> = { "nghiem-tuc": "Nghiêm túc", "binh-thuong": "Bình thường", "doi-pho": "Đối phó" };
export const PROGRESS: Record<string, string> = { "tien-bo": "Tiến bộ", "giu-nguyen": "Giữ nguyên", "di-xuong": "Đi xuống" };

export const QUICK_COMMENTS = COURSE.grading.quickComments;

const { itemsShare, goodFrom, okFrom, dueDays } = COURSE.grading;
export const GRADING = { itemsShare, goodFrom, okFrom, dueDays };

export type ItemScore = { kind: "video" | "so-do"; a1?: number | null; a2?: number | null; a3?: number | null; a4?: number | null; a5?: number | null; flag?: string | null };

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Điểm một thẻ (null nếu bị đánh dấu hoặc chưa chấm đủ). */
export function itemScore(i: ItemScore): number | null {
  if (i.flag) return null;
  const xs = (i.kind === "video" ? [i.a1, i.a2, i.a3, i.a4] : [i.a5]).filter((x): x is number => typeof x === "number");
  if (xs.length !== (i.kind === "video" ? 4 : 1)) return null;
  return avg(xs);
}

/** Điểm chất lượng tuần = 60% phần riêng + 40% trung bình (B1, B2), thang 5. */
export function weekScore(items: ItemScore[], b1: number | null, b2: number | null): number | null {
  const parts = items.map(itemScore).filter((x): x is number => x !== null);
  const own = avg(parts);
  const common = avg([b1, b2].filter((x): x is number => typeof x === "number"));
  if (own === null && common === null) return null;
  const s = own === null ? common! : common === null ? own : GRADING.itemsShare * own + (1 - GRADING.itemsShare) * common;
  return Math.round(s * 10) / 10;
}

export type Quality = "tot" | "kha" | "can-kem";
export function qualityOf(score: number | null, spirit?: string | null): Quality | null {
  if (spirit === "doi-pho") return "can-kem";
  if (score === null) return null;
  return score >= GRADING.goodFrom ? "tot" : score >= GRADING.okFrom ? "kha" : "can-kem";
}
export const QUALITY_LABEL: Record<Quality, string> = { tot: "Tốt", kha: "Khá", "can-kem": "Cần kèm" };
export const QUALITY_COLOR: Record<Quality, "xanh" | "vang" | "do"> = { tot: "xanh", kha: "vang", "can-kem": "do" };
