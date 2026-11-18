// "Hồ sơ khóa học": mọi thứ riêng của một khóa. Mã nguồn chung (xương sống) đọc hồ sơ này;
// mỗi khóa một tệp `courses/<mã>/course.ts`, chọn lúc đóng gói qua bí danh "@course" (wrangler.jsonc → alias, theo từng môi trường).
// Thêm khóa mới: xem docs/KHOA-HOC-MOI.md.

export type Feature =
  | "attendance" // điểm danh offline từ Google Sheet, tính vào điểm xếp hạng
  | "grading" // bàn chấm bài tuần cho ban phụng sự / coach
  | "aiGrading" // AI chấm gợi ý các câu cần đọc hiểu
  | "teamBoard" // bảng xếp hạng đồng đội
  | "teamAwards" // danh hiệu tuần của đội
  | "publicLeaderboard" // bảng xếp hạng công khai (tắt: phải đăng nhập mới xem)
  | "reports" // mục Báo cáo thống kê
  | "leaderboard" // bảng xếp hạng theo điểm % (bài tập + đi học)
  | "faq" // tổng hợp câu hỏi học viên gửi BTC (AI biên tập) + FAQ công khai cuối bảng xếp hạng
  | "discipline"; // kỷ luật: lỗi nhẹ / lỗi nặng (bài tập, Zoom, camera), trưởng nhóm, BTC duyệt miễn

/** Mức lỗi: nhẹ, nặng, hoặc không tính. */
export type Severity = "nhe" | "nang" | null;

export type Criterion = { key: string; name: string; one: string; three: string; five: string };

export type CourseConfig = {
  id: string;
  brand: {
    name: string; // "Nhân Sự Kế Thừa 2026"
    short: string; // "NSKT 2026" (tiêu đề tab)
    tagline: string; // dòng nhỏ trên bảng xếp hạng
    logo: string; // đường dẫn ảnh trong thư mục public của khóa
    themeColor: string;
    shareTitle: string;
    shareDescription: string;
    shareImage: string; // ảnh 1200×630 khi gửi link bảng xếp hạng
  };
  teams: {
    count: number; // số đội học viên
    /** Tên đội trên dh3g → số thứ tự đội (1…count). */
    numberOf: (name: string) => number | null;
    /** Tên đội của ban tổ chức (không xếp hạng). */
    staffRe: RegExp;
    label: (n: number) => string; // "Đội 03"
  };
  scoring: {
    startDate: string;
    halfLifeWeeks: number;
    greenFrom: number;
    yellowFrom: number;
    daily: { mandatory: number; encouragedVideo: number; encouragedDeepText: number };
    weekly: { perVideo: number; mandatory: number; idea: number };
    lateVideo: number;
    lateTextFactor: number;
    attendance: { share: number; halfLifeWeeks: number; points: Record<string, number> };
  };
  attendance: {
    checkInFile: string; // tên file Google Sheet (chỉ để hiển thị)
    rosterFile: string;
    checkInRange: string;
    rosterRange: string;
    regions: { code: string; label: string; re: RegExp }[]; // vd. đầu HN / đầu SG theo cột "Khu Vực"
  };
  grading: {
    videoCriteria: Criterion[];
    diagram: Criterion;
    writing: Criterion;
    focusOptions: string[];
    quickComments: string[];
    itemsShare: number;
    goodFrom: number;
    okFrom: number;
    dueDays: number;
  };
  ai: { context: string }; // mô tả khóa học cho AI chấm
  /** Câu góp ý không bắt buộc của bài tập tuần dùng làm nguồn câu hỏi FAQ (nhận theo nội dung đề). */
  faq: { sources: { key: string; label: string; re: RegExp }[] };
  /** Trang chủ "/": tổng quan điểm (NSKT) hay tổng quan kỷ luật. */
  home: "overview" | "discipline";
  /** Đường dẫn trang công khai cho học viên, không cần đăng nhập (vd. "/45ngaydonghanh"). Không đặt: không có trang công khai kỷ luật. */
  publicPath?: string;
  discipline: {
    startDate: string; // chỉ tính bài có hạn / buổi Zoom từ ngày này
    weeks: number; // số tuần của hành trình (biểu đồ tiến độ)
    /** Giờ bắt đầu tính điểm danh Zoom ("HH:MM", giờ VN). Không đặt thì dùng giờ bắt đầu buổi trên dh3g. */
    zoomCheckinTime?: string;
    zoomLateMinutes: number; // vào sau giờ bắt đầu tính điểm danh quá số phút này = vào trễ
    points: { nhe: number; nang: number }; // điểm lỗi
    rules: {
      dailyMissing: Severity; // bài ngày: qua hạn mà chưa nộp
      dailyLate: Severity; // bài ngày: nộp sau hạn
      weeklyMissing: Severity; // bài tuần / bài thi: qua hạn mà chưa nộp
      weeklyLate: Severity; // bài tuần / bài thi: nộp sau hạn
      zoomLate: Severity;
      zoomAbsent: Severity;
      cameraOff: Severity;
    };
    journalFields: { key: string; label: string }[]; // các mục nhật ký nhóm hằng tuần
  };
  features: Record<Feature, boolean>;
};
