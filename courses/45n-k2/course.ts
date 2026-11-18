// Hồ sơ khóa 45N-K02 — "Hành trình 45 ngày Gắn kết & Nâng tầm đội ngũ", cộng đồng dh3g số 47, khai giảng 11/11/2026.
// Yêu cầu của BTC 45N: phiếu "Tieu chi XD dashboard HT45N K2" (Google Docs). Trọng tâm: kỷ luật (lỗi nhẹ / lỗi nặng),
// điểm danh Zoom, bài tập ngày / tuần, kết quả cá nhân – trưởng nhóm – 7 nhóm. Không có bảng xếp hạng điểm %, không công khai.

import type { CourseConfig } from "../../src/course/types";
import { COURSE as NSKT } from "../nskt2026/course";

export const COURSE: CourseConfig = {
  ...NSKT, // các phần không dùng ở khóa này (điểm %, tiêu chí chấm video) giữ như NSKT cho đủ cấu trúc
  id: "45n-k2",
  brand: {
    name: "45 Ngày Gắn kết & Nâng tầm đội ngũ",
    short: "Dashboard", // chủ dự án 17/11: tên trang là "Dashboard"
    tagline: "Gắn kết & Nâng tầm đội ngũ",
    logo: "/brand/logo.svg",
    themeColor: "#0F766E",
    shareTitle: "Dashboard · 45 Ngày Gắn kết & Nâng tầm đội ngũ",
    shareDescription: "Dashboard theo dõi 45 Ngày Gắn kết & Nâng tầm đội ngũ.",
    shareImage: "/brand/logo.svg",
  },
  teams: {
    count: 7,
    // "Nhóm 1-K2"…"Nhóm 7-K2". Khóa K01 (đã xong) không chia nhóm nên không bị lẫn.
    numberOf: (name) => {
      const m = name.match(/nh[óo]m\s*0?(\d{1,2})\s*-\s*k\s*0?2\b/i);
      return m ? Number(m[1]) : null;
    },
    // Ban tổ chức và mentor: không tính lỗi, không xếp hạng.
    staffRe: /^\s*(btc|mentor)/i,
    label: (n) => `Nhóm ${n}`,
  },
  scoring: { ...NSKT.scoring, startDate: "2026-11-12" },
  ai: { context: "hành trình 45 ngày Gắn kết & Nâng tầm đội ngũ" },
  home: "discipline",
  // Chủ dự án 17/11: link công khai gửi học viên (chỉ xem Dashboard, Zoom, Bài tập, Nhóm, Từng thành viên).
  publicPath: "/45ngaydonghanh",
  discipline: {
    startDate: "2026-11-11", // ngày khai giảng K02: buổi Zoom khai giảng là buổi 1/6; bài tập đầu tiên hạn 12/11
    weeks: 6,
    // Chủ dự án 17/11: giờ bắt đầu tính điểm danh 20:00 (dh3g ghi buổi bắt đầu 19:45), vào sau 20:15 là trễ.
    zoomCheckinTime: "20:00",
    zoomLateMinutes: 15,
    points: { nhe: 1, nang: 3 },
    rules: {
      dailyMissing: "nhe", // "Không làm bài tập ngày sau deadline: 1 lỗi nhẹ"
      dailyLate: null, // nộp bù bài ngày: ghi "nộp trễ" nhưng không tính lỗi
      weeklyMissing: "nang", // "Nộp trễ / không làm bài tập tuần sau deadline: 1 lỗi nặng"
      weeklyLate: "nang",
      zoomLate: "nang",
      zoomAbsent: "nang",
      cameraOff: "nang",
    },
    journalFields: [
      { key: "tinh_hinh", label: "Tình hình chung của nhóm tuần này" },
      { key: "diem_tot", label: "Điểm tốt, gương sáng" },
      { key: "kho_khan", label: "Khó khăn, thành viên cần hỗ trợ" },
      { key: "de_xuat", label: "Đề xuất với BTC" },
      { key: "ke_hoach", label: "Kế hoạch tuần tới" },
    ],
  },
  features: {
    attendance: false, // không có điểm danh offline (Google Sheet)
    grading: false, // bộ tiêu chí chấm hiện tại dành cho video / sơ đồ của NSKT
    aiGrading: false,
    teamBoard: false,
    teamAwards: false,
    publicLeaderboard: false,
    reports: false, // thay bằng các trang Kỷ luật (tổng quan, Zoom, bài tập, cá nhân, nhóm)
    leaderboard: false,
    faq: false,
    discipline: true,
  },
};
