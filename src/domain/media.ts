// Phát hiện video / ảnh / tệp trong nội dung trả lời của học viên.
// Không dùng mediaCount của dh3g: nó không tách video với ảnh và nhiều bài có link nhưng ghi 0.

export type MediaKind = "youtube" | "facebook" | "tiktok" | "video-file" | "image" | "drive" | "file" | "link";

export type MediaItem = { kind: MediaKind; url: string };

export type MediaSummary = {
  items: MediaItem[];
  videos: number;
  images: number;
  files: number;
};

const URL_RE = /https?:\/\/[^\s"'<>()[\]{}]+/gi;
const TRAILING = /[.,;:!?…]+$/;

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv)(\?|#|$)/i;

export function classify(url: string): MediaKind {
  let host: string;
  let path: string;
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
    path = u.pathname;
  } catch {
    return "link";
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host === "fb.watch" || host.endsWith("facebook.com") || host === "fb.com") return "facebook";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (VIDEO_EXT.test(path)) return "video-file";
  if (IMAGE_EXT.test(path) || host.endsWith("fbcdn.net")) return "image";
  if (host === "drive.google.com" || host === "docs.google.com") return "drive";
  // Tệp học viên tải thẳng lên dh3g (ảnh đã bắt ở trên; còn lại là pdf, tài liệu…).
  if (host.endsWith("sunteco.app")) return "file";
  return "link";
}

export function isVideo(kind: MediaKind): boolean {
  return kind === "youtube" || kind === "facebook" || kind === "tiktok" || kind === "video-file";
}

export function findMedia(text: string | null | undefined): MediaItem[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const raw of text.match(URL_RE) ?? []) {
    const url = raw.replace(TRAILING, "");
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ kind: classify(url), url });
  }
  return out;
}

export function summarize(items: MediaItem[]): MediaSummary {
  let videos = 0;
  let images = 0;
  let files = 0;
  for (const m of items) {
    if (isVideo(m.kind)) videos++;
    else if (m.kind === "image") images++;
    else if (m.kind === "drive" || m.kind === "file") files++;
  }
  return { items, videos, images, files };
}

export type Answer = { question: string | null; type: string | null; answer: string | null };

export function parseAnswers(json: string | null | undefined): Answer[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((a) => ({
      question: typeof a?.question === "string" ? a.question : null,
      type: typeof a?.type === "string" ? a.type : null,
      answer: typeof a?.answer === "string" ? a.answer : null,
    }));
  } catch {
    return [];
  }
}

/** Chỉ đọc link trong câu trả lời, không đọc trong đề bài (đề bài cũng có ảnh slide, link Drive). */
export function mediaOfAnswers(answersJson: string | null | undefined): MediaSummary {
  return summarize(parseAnswers(answersJson).flatMap((a) => findMedia(a.answer)));
}
