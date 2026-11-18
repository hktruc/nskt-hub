// Hồ sơ khóa NSKT2026 — "Nhân Sự Kế Thừa 2026", cộng đồng dh3g số 44.
// Mọi quyết định của chủ dự án về khóa này ghi trong CLAUDE.md; con số nằm ở đây.

import type { CourseConfig } from "../../src/course/types";

export const COURSE: CourseConfig = {
  id: "nskt2026",
  brand: {
    name: "Nhân Sự Kế Thừa 2026",
    short: "NSKT 2026",
    tagline: "Cá Chép Vượt Long Môn",
    logo: "/brand/logo.webp",
    themeColor: "#076A8F",
    shareTitle: "Bảng xếp hạng · Nhân Sự Kế Thừa 2026",
    shareDescription: "Thứ hạng học viên NSKT 2026 theo 12 đội, cập nhật hằng ngày.",
    shareImage: "/brand/og-bang-xep-hang.png",
  },
  teams: {
    count: 12,
    // "🐟 Đội Cá Chép 01"…"12" (= thôn T01…T12)
    numberOf: (name) => {
      const m = name.match(/c[áa]\s*ch[ée]p\s*0?(\d{1,2})\b/i);
      return m ? Number(m[1]) : null;
    },
    staffRe: /^\s*btc\s*$/i,
    label: (n) => `Đội ${String(n).padStart(2, "0")}`,
  },
  scoring: {
    startDate: "2026-09-30", // sau khai giảng 29/09/2026
    halfLifeWeeks: 3,
    greenFrom: 80,
    yellowFrom: 50,
    daily: { mandatory: 1, encouragedVideo: 3, encouragedDeepText: 1 },
    weekly: { perVideo: 10, mandatory: 3, idea: 1 },
    lateVideo: 2,
    lateTextFactor: 0.5,
    attendance: { share: 0.5, halfLifeWeeks: 6, points: { OK: 1, M: 0.7, X: 0.6, M1: 0.4, CANH_BAO: 0.5, P: 0.3, VANG: 0 } },
  },
  attendance: {
    checkInFile: "NSKT2026 - KỶ LUẬT - HỌC VIÊN",
    rosterFile: "NSKT 2026 CHIA THÔN HỌC VIÊN",
    checkInRange: "CHECK_IN!A1:AZ400",
    rosterRange: "DS_CHIA_THON!A1:Z400",
    regions: [
      { code: "SG", label: "Đầu Sài Gòn", re: /hcm|hồ chí minh|sài gòn|sai gon|miền nam|mien nam/ },
      { code: "HN", label: "Đầu Hà Nội", re: /hà nội|ha noi|miền bắc|bắc/ },
    ],
  },
  grading: {
    videoCriteria: [
      { key: "a1", name: "A1. Đúng ý, đủ ý", one: "Lạc đề, sai ý chính của câu chuyện / đề bài", three: "Đúng ý chính, thiếu chi tiết quan trọng", five: "Đúng và đủ ý, giữ được tinh thần gốc" },
      { key: "a2", name: "A2. Truyền cảm", one: "Đọc thuộc lòng, đều đều, không nhìn người nghe", three: "Tự nhiên, có cảm xúc ở vài đoạn", five: "Giọng, nhịp, ánh mắt, cử chỉ cuốn người nghe từ đầu đến cuối" },
      { key: "a3", name: "A3. Mạch lạc", one: "Lộn xộn, khó theo dõi", three: "Có mở – thân – kết nhưng còn lan man", five: "Mở hấp dẫn, có cao trào, kết gọn; dễ nhớ" },
      { key: "a4", name: "A4. Đúc kết, thông điệp", one: "Không rút ra được gì", three: "Có bài học nhưng chung chung", five: "Bài học sâu, đa chiều (đạo lý – tâm lý – đám đông), chạm người nghe" },
    ],
    diagram: {
      key: "a5",
      name: "A5. Sơ đồ",
      one: "Không liên quan, mờ không đọc được, hoặc chép nguyên văn",
      three: "Có đủ các ý chính nhưng rời rạc, chưa thấy liên kết",
      five: "Rõ ràng, có cấu trúc (ý trung tâm – nhánh), thể hiện mối liên hệ, dùng được để kể hoặc giảng lại",
    },
    writing: { key: "b2", name: "B2. Chiều sâu phần viết", one: "Viết cho có", three: "Có ý của mình", five: "Đa chiều, có trải nghiệm thật và hành động cụ thể" },
    focusOptions: [
      "Truyền cảm hứng theo chiều sâu",
      "Chân thật, tầm nhìn (Ikigai, vector cuộc đời)",
      "Cấu trúc bài giảng (5 tiêu chí)",
      "Câu hỏi đi vào cốt lõi, mở, không phán xét",
      "Lập luận đa chiều, trả lời câu hỏi khó",
      "Truyền đạt rõ, đúng tinh thần",
      "Kèm cặp, lan tỏa",
    ],
    quickComments: ["Kể tự nhiên", "Cần đúc kết sâu hơn", "Nói chậm lại", "Liên hệ bản thân nhiều hơn", "Sơ đồ cần rõ nhánh chính", "Bám sát đề bài"],
    itemsShare: 0.6,
    goodFrom: 4,
    okFrom: 3,
    dueDays: 3,
  },
  ai: { context: "khóa học NSKT2026 (kể chuyện, rèn tâm trí)" },
  faq: {
    sources: [
      { key: "cau-hoi", label: "Khó khăn & câu hỏi", re: /khó khăn\s*(&|và)\s*câu hỏi/i },
      { key: "cai-thien", label: "Điểm cần cải thiện", re: /điểm cần cải thiện/i },
    ],
  },
  home: "overview",
  // Chưa dùng cho NSKT (chủ dự án chưa định nghĩa "kỷ luật"); bật tính năng "discipline" khi đã chốt.
  discipline: {
    startDate: "2026-09-30",
    weeks: 13,
    zoomLateMinutes: 5,
    points: { nhe: 1, nang: 3 },
    rules: { dailyMissing: "nhe", dailyLate: null, weeklyMissing: "nang", weeklyLate: "nang", zoomLate: "nang", zoomAbsent: "nang", cameraOff: "nang" },
    journalFields: [],
  },
  features: {
    attendance: true,
    grading: true,
    aiGrading: true,
    teamBoard: true,
    teamAwards: true,
    publicLeaderboard: true,
    reports: true,
    leaderboard: true,
    faq: true,
    chamCheo: true,
    discipline: false,
  },
};
