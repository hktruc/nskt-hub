import { COURSE } from "@course";
import type { Feature } from "./types";

export { COURSE };
export type { CourseConfig, Feature } from "./types";

/** Tính năng có bật cho khóa này không. */
export const featureOn = (f: Feature): boolean => COURSE.features[f];

/** Trang nội bộ thuộc tính năng nào (để chặn khi tính năng tắt). */
export function featureOfPath(path: string): Feature | null {
  if (path === "/cham" || path.startsWith("/cham/") || path === "/bao-cao/nguoi-cham") return "grading";
  if (path === "/bao-cao/buoi-hoc" || path === "/du-lieu/diem-danh") return "attendance";
  if (path === "/bao-cao" || path.startsWith("/bao-cao/")) return "reports";
  return null;
}
