export type Env = {
  APP_NAME: string;
  DB: D1Database;

  // Nguồn dh3g. Khóa là secret trên Cloudflare, không bao giờ nằm trong repo.
  DH3G_API_KEY?: string;
  DH3G_BASE_URL: string;
  DH3G_COMMUNITY_ID: string;
  SYNC_START_DATE: string;

  // Đăng nhập qua Cloudflare Access.
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  // Chỉ có tác dụng khi chạy thử trên máy (localhost).
  LOCAL_DEV_NO_AUTH?: string;
};
