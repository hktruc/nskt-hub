// Bộ tiêu chí chấm bài tuần — đúng như docs/TIEU-CHI-CHAM.md (chủ dự án duyệt 12/11/2026).

export type Criterion = { key: string; name: string; one: string; three: string; five: string };

export const VIDEO_CRITERIA: Criterion[] = [
  { key: "a1", name: "A1. Đúng ý, đủ ý", one: "Lạc đề, sai ý chính của câu chuyện / đề bài", three: "Đúng ý chính, thiếu chi tiết quan trọng", five: "Đúng và đủ ý, giữ được tinh thần gốc" },
  { key: "a2", name: "A2. Truyền cảm", one: "Đọc thuộc lòng, đều đều, không nhìn người nghe", three: "Tự nhiên, có cảm xúc ở vài đoạn", five: "Giọng, nhịp, ánh mắt, cử chỉ cuốn người nghe từ đầu đến cuối" },
  { key: "a3", name: "A3. Mạch lạc", one: "Lộn xộn, khó theo dõi", three: "Có mở – thân – kết nhưng còn lan man", five: "Mở hấp dẫn, có cao trào, kết gọn; dễ nhớ" },
  { key: "a4", name: "A4. Đúc kết, thông điệp", one: "Không rút ra được gì", three: "Có bài học nhưng chung chung", five: "Bài học sâu, đa chiều (đạo lý – tâm lý – đám đông), chạm người nghe" },
];

export const DIAGRAM_CRITERION: Criterion = {
  key: "a5",
  name: "A5. Sơ đồ",
  one: "Không liên quan, mờ không đọc được, hoặc chép nguyên văn",
  three: "Có đủ các ý chính nhưng rời rạc, chưa thấy liên kết",
  five: "Rõ ràng, có cấu trúc (ý trung tâm – nhánh), thể hiện mối liên hệ, dùng được để kể hoặc giảng lại",
};

export const B2: Criterion = {
  key: "b2",
  name: "B2. Chiều sâu phần viết",
  one: "Viết cho có",
  three: "Có ý của mình",
  five: "Đa chiều, có trải nghiệm thật và hành động cụ thể",
};

export const FOCUS_OPTIONS = [
  "Truyền cảm hứng theo chiều sâu",
  "Chân thật, tầm nhìn (Ikigai, vector cuộc đời)",
  "Cấu trúc bài giảng (5 tiêu chí)",
  "Câu hỏi đi vào cốt lõi, mở, không phán xét",
  "Lập luận đa chiều, trả lời câu hỏi khó",
  "Truyền đạt rõ, đúng tinh thần",
  "Kèm cặp, lan tỏa",
];
export const DEFAULT_FOCUS = FOCUS_OPTIONS[0]!;

export const FLAGS: Record<string, string> = {
  "khong-xem-duoc": "Không xem được",
  "khong-dung-de": "Không đúng đề",
  "trung-bai-cu": "Trùng bài cũ",
};
export const SPIRIT: Record<string, string> = { "nghiem-tuc": "Nghiêm túc", "binh-thuong": "Bình thường", "doi-pho": "Đối phó" };
export const PROGRESS: Record<string, string> = { "tien-bo": "Tiến bộ", "giu-nguyen": "Giữ nguyên", "di-xuong": "Đi xuống" };

export const QUICK_COMMENTS = ["Kể tự nhiên", "Cần đúc kết sâu hơn", "Nói chậm lại", "Liên hệ bản thân nhiều hơn", "Sơ đồ cần rõ nhánh chính", "Bám sát đề bài"];

export const GRADING = { itemsShare: 0.6, goodFrom: 4, okFrom: 3, dueDays: 3 } as const;

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
