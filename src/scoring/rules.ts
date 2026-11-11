import { findMedia, isVideo, type Answer } from "../domain/media";
import { SCORING } from "./config";
import type { AssignmentSpec, QuestionSpec } from "./spec";

// Chấm một bài nộp theo quy tắc của chủ dự án. Phần cần đọc hiểu do AI quyết định;
// khi AI chưa chấm, dùng quy tắc tạm theo độ dài và đánh dấu "tạm".

/** Việc AI cần đánh giá cho một câu. */
export type AiTask = "sau-sac" | "dat-yeu-cau" | "gop-y";

export type AiVerdict = { index: number; ok: boolean; nonsense: boolean; note?: string };

export type QuestionScore = {
  index: number;
  kind: QuestionSpec["kind"];
  earned: number;
  max: number;
  videos: number;
  source: "quy-tac" | "ai" | "tam";
  note?: string;
};

export type SubmissionScore = {
  earned: number;
  max: number;
  onTimeVideos: number;
  hoursEarly: number | null;
  provisional: boolean;
  flags: { index: number; reason: string }[];
  detail: QuestionScore[];
};

const URL_RE = /https?:\/\/\S+/gi;

/** Phần chữ của câu trả lời, đã bỏ link. */
export function textOf(answer: string | null): string {
  return (answer ?? "").replace(URL_RE, " ").replace(/\s+/g, " ").trim();
}

/** Nhận biết câu trả lời đối phó bằng quy tắc: quá ngắn, không có chữ, ký tự lặp, gõ đại. */
export function looksNonsense(text: string): string | null {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  if (text.length === 0) return null; // để trống: không cảnh báo, chỉ 0 điểm
  if (letters === 0) return "chỉ có ký hiệu, không có chữ";
  if (/(.)\1{5,}/u.test(text)) return "lặp ký tự";
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (words.length <= 2 && text.length < 15) return "quá ngắn";
  if (words.length > 0 && words.every((w) => !/[aeiouyàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(w)))
    return "gõ đại, không thành từ";
  return null;
}

function tempOk(task: AiTask, text: string): boolean {
  if (looksNonsense(text)) return false;
  if (task === "sau-sac") return text.length >= 80;
  if (task === "dat-yeu-cau") return text.length >= 30;
  return text.length >= 10;
}

function hours(a: string, b: string): number {
  return (Date.parse(`${a.slice(0, 19)}Z`) - Date.parse(`${b.slice(0, 19)}Z`)) / 3_600_000;
}

/** Danh sách câu cần AI đọc (câu đã nộp, có chữ, không quyết định được bằng quy tắc). */
export function aiTasks(spec: AssignmentSpec, answers: Answer[]): { index: number; task: AiTask; question: string; answer: string }[] {
  const out: { index: number; task: AiTask; question: string; answer: string }[] = [];
  for (const q of spec.questions) {
    const a = answers[q.index];
    const text = textOf(a?.answer ?? null);
    if (!text) continue;
    const media = findMedia(a?.answer);
    if (q.kind === "khuyen-khich" && !media.some((m) => isVideo(m.kind))) out.push({ index: q.index, task: "sau-sac", question: q.question, answer: a!.answer! });
    if (q.kind === "bat-buoc" && spec.type === "WEEK" && !(q.wantsImage && media.length > 0))
      out.push({ index: q.index, task: "dat-yeu-cau", question: q.question, answer: a!.answer! });
    if (q.kind === "gop-y") out.push({ index: q.index, task: "gop-y", question: q.question, answer: a!.answer! });
  }
  return out;
}

export function scoreSubmission(input: {
  spec: AssignmentSpec;
  answers: Answer[];
  status: string | null;
  submittedAt: string | null;
  dueAt: string;
  ai?: AiVerdict[] | null;
}): SubmissionScore {
  const { spec, answers } = input;
  const submitted = input.status === "DONE" || input.status === "OVERDUE" || input.status === "LATE";
  const late = input.status === "OVERDUE" || input.status === "LATE";
  const ai = new Map((input.ai ?? []).map((v) => [v.index, v]));
  const detail: QuestionScore[] = [];
  const flags: SubmissionScore["flags"] = [];
  let provisional = false;
  let onTimeVideos = 0;

  for (const q of spec.questions) {
    const base: QuestionScore = { index: q.index, kind: q.kind, earned: 0, max: q.max, videos: 0, source: "quy-tac" };
    const a = submitted ? answers[q.index] : undefined;
    if (!a) {
      detail.push(base);
      continue;
    }
    const media = findMedia(a.answer);
    const videos = media.filter((m) => isVideo(m.kind)).length;
    const text = textOf(a.answer);
    const judge = (task: AiTask): { ok: boolean; source: QuestionScore["source"]; note?: string } => {
      const v = ai.get(q.index);
      if (v) {
        if (v.nonsense) flags.push({ index: q.index, reason: v.note || "AI: trả lời đối phó" });
        return { ok: v.ok && !v.nonsense, source: "ai", note: v.note };
      }
      provisional = true;
      return { ok: tempOk(task, text), source: "tam" };
    };
    const rule = q.kind !== "bat-buoc" || spec.type === "WEEK" ? looksNonsense(text) : null;
    // Cảnh báo theo quy tắc chỉ khi AI chưa xét câu này (AI xét rồi thì theo AI).
    if (rule && !ai.has(q.index) && videos === 0 && !(q.wantsImage && media.length > 0)) flags.push({ index: q.index, reason: rule });

    if (q.kind === "bat-buoc" && spec.type === "NORMAL") {
      detail.push({ ...base, earned: text || media.length ? q.max : 0 });
    } else if (q.kind === "khuyen-khich") {
      if (videos > 0) {
        const n = Math.min(videos, 1);
        if (!late) onTimeVideos += n;
        detail.push({ ...base, videos, earned: late ? n * SCORING.lateVideo : q.max });
      } else if (text) {
        const j = judge("sau-sac");
        detail.push({ ...base, earned: j.ok ? SCORING.daily.encouragedDeepText : 0, source: j.source, note: j.note });
      } else detail.push(base);
    } else if (q.kind === "video") {
      const n = Math.min(videos, q.expectedVideos ?? 1);
      if (!late) onTimeVideos += n;
      detail.push({ ...base, videos, earned: n * (late ? SCORING.lateVideo : SCORING.weekly.perVideo) });
    } else if (q.kind === "bat-buoc") {
      if (q.wantsImage && media.length > 0) detail.push({ ...base, earned: q.max });
      else if (text) {
        const j = judge("dat-yeu-cau");
        detail.push({ ...base, earned: j.ok ? q.max : 0, source: j.source, note: j.note });
      } else detail.push(base);
    } else {
      if (text) {
        const j = judge("gop-y");
        detail.push({ ...base, earned: j.ok ? q.max : 0, source: j.source, note: j.note });
      } else detail.push(base);
    }
  }

  const earned = detail.reduce((s, d) => s + d.earned, 0);
  const max = detail.reduce((s, d) => s + d.max, 0);
  const hoursEarly = onTimeVideos > 0 && input.submittedAt ? hours(input.dueAt, input.submittedAt) : null;
  return { earned, max, onTimeVideos, hoursEarly, provisional, flags, detail };
}
