// Mọi con số của quy tắc điểm nằm ở đây để chủ dự án dễ chỉnh. Xem CLAUDE.md, mục "Quy tắc điểm".

import { COURSE } from "../course";

/** Quy tắc điểm của khóa đang chạy (hồ sơ khóa học: courses/<mã>/course.ts). */
export const SCORING = COURSE.scoring;

export type Color = "xanh" | "vang" | "do";

export function colorOf(percent: number): Color {
  if (percent >= SCORING.greenFrom) return "xanh";
  if (percent >= SCORING.yellowFrom) return "vang";
  return "do";
}

export const COLOR_LABEL: Record<Color, string> = { xanh: "Xanh", vang: "Vàng", do: "Đỏ" };
