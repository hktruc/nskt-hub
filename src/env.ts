export type Env = {
  APP_NAME: string;
  DB: D1Database;

  // Nguồn dh3g. Khóa là secret trên Cloudflare, không bao giờ nằm trong repo.
  DH3G_API_KEY?: string;
  DH3G_BASE_URL: string;
  DH3G_COMMUNITY_ID: string;
  SYNC_START_DATE: string;

  // AI chấm bài (OpenAI của chủ dự án). Khóa là secret, không nằm trong repo.
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_REASONING_EFFORT?: string;
  OPENAI_BASE_URL?: string;

  // Điểm danh offline từ Google Sheet: id file (không bí mật) + khóa tài khoản dịch vụ (secret).
  SHEET_ATTENDANCE_ID?: string;
  SHEET_ROSTER_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;

  // Đăng nhập qua Cloudflare Access.
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  // Chỉ có tác dụng khi chạy thử trên máy (localhost).
  LOCAL_DEV_NO_AUTH?: string;
};
