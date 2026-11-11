// Mọi con số của quy tắc điểm nằm ở đây để chủ dự án dễ chỉnh. Xem CLAUDE.md, mục "Quy tắc điểm".

export const SCORING = {
  /** Chỉ tính bài có hạn nộp từ ngày này (sau khai giảng 29/09/2026). */
  startDate: "2026-09-30",
  /** Điểm của bài cách đây `halfLifeWeeks` tuần chỉ còn tính một nửa. */
  halfLifeWeeks: 3,
  /** Ngưỡng màu, theo % điểm đạt được so với tối đa (sau khi đã làm mờ). */
  greenFrom: 80,
  yellowFrom: 50,

  daily: { mandatory: 1, encouragedVideo: 3, encouragedDeepText: 1 },
  weekly: { perVideo: 10, mandatory: 3, idea: 1 },
  /** Nộp trễ: mỗi video được bấy nhiêu điểm (thay cho điểm video đúng hạn). */
  lateVideo: 2,
  /** Nộp trễ: câu trả lời bằng chữ (kể cả ảnh) được bấy nhiêu phần điểm; AI vẫn kiểm tra nội dung. */
  lateTextFactor: 0.5,
} as const;

export type Color = "xanh" | "vang" | "do";

export function colorOf(percent: number): Color {
  if (percent >= SCORING.greenFrom) return "xanh";
  if (percent >= SCORING.yellowFrom) return "vang";
  return "do";
}

export const COLOR_LABEL: Record<Color, string> = { xanh: "Xanh", vang: "Vàng", do: "Đỏ" };
