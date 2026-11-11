import { mediaOfAnswers, type Answer } from "../domain/media";
import { SCORING } from "./config";

// Cấu trúc câu hỏi của một bài tập: mỗi câu thuộc loại nào, tối đa bao nhiêu điểm.
//
// Bài ngày: dh3g ghi sẵn nhãn trong đề, ví dụ "BTVN/ngày (bắt buộc) (X1)", "(khuyến khích) (X3)".
// Bài tuần: đề đổi theo tuần. Câu góp ý cho BTC nhận theo cụm từ; câu yêu cầu video nhận theo
// dữ liệu nộp thật (đa số người nộp có video ở câu đó), số video tối đa = mức 75% người nộp đạt.

export type QuestionKind = "bat-buoc" | "khuyen-khich" | "video" | "gop-y";

export type QuestionSpec = {
  index: number;
  question: string;
  kind: QuestionKind;
  /** Điểm tối đa của câu. */
  max: number;
  /** Chỉ với câu video: số video được tính tối đa. */
  expectedVideos?: number;
  /** Câu yêu cầu nộp ảnh: có ảnh là đạt, không cần AI. */
  wantsImage?: boolean;
};

export type AssignmentSpec = { type: "NORMAL" | "WEEK"; questions: QuestionSpec[] };

const IDEA_RE = /điểm tốt cần phát huy|điểm cần cải thiện|đóng góp giúp lớp|khó khăn\s*(&|và)\s*câu hỏi|góp ý (cho|với) (btc|ban tổ chức)/i;
const IMAGE_RE = /nộp ảnh|\(ảnh\)|chụp ảnh/i;

export function labelPoints(question: string): number | null {
  const m = question.match(/\(\s*X\s*(\d+)\s*\)/i);
  return m ? Number(m[1]) : null;
}

export function buildDailySpec(questions: string[]): AssignmentSpec {
  return {
    type: "NORMAL",
    questions: questions.map((q, index) => {
      const encouraged = /khuyến khích/i.test(q);
      return encouraged
        ? { index, question: q, kind: "khuyen-khich", max: labelPoints(q) ?? SCORING.daily.encouragedVideo }
        : { index, question: q, kind: "bat-buoc", max: labelPoints(q) ?? SCORING.daily.mandatory };
    }),
  };
}

/** `submitted[i]` là danh sách câu trả lời của từng người đã nộp (cùng thứ tự câu hỏi). */
export function buildWeeklySpec(questions: string[], submitted: Answer[][]): AssignmentSpec {
  return {
    type: "WEEK",
    questions: questions.map((q, index) => {
      if (IDEA_RE.test(q)) return { index, question: q, kind: "gop-y", max: SCORING.weekly.idea };
      const counts = submitted
        .map((ans) => mediaOfAnswers(JSON.stringify(ans[index] ? [ans[index]] : [])).videos)
        .sort((a, b) => a - b);
      const withVideo = counts.filter((c) => c > 0).length;
      if (counts.length > 0 && withVideo / counts.length >= 0.5) {
        const p75 = counts[Math.floor(0.75 * (counts.length - 1))] ?? 1;
        const expectedVideos = Math.max(1, p75);
        return { index, question: q, kind: "video", max: expectedVideos * SCORING.weekly.perVideo, expectedVideos };
      }
      return { index, question: q, kind: "bat-buoc", max: SCORING.weekly.mandatory, wantsImage: IMAGE_RE.test(q) };
    }),
  };
}

export function specMax(spec: AssignmentSpec): number {
  return spec.questions.reduce((s, q) => s + q.max, 0);
}
