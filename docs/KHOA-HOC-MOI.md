# Thêm một khóa học mới ("xương cá")

Một bộ mã nguồn dùng chung (xương lớn) cho nhiều khóa học (xương con). Mỗi khóa có:

- **Hồ sơ khóa học** `courses/<mã-khóa>/course.ts` — tên, logo, số đội và cách đọc tên đội trên dh3g, quy tắc điểm, tiêu chí chấm, file Google Sheet, và **bật/tắt tính năng**.
- **Ảnh, logo** `courses/<mã-khóa>/public/`.
- **Bản chạy riêng trên Cloudflare**: worker riêng (link riêng `<tên>.hktruc.workers.dev`), D1 riêng, secret riêng, mã cộng đồng dh3g riêng (`DH3G_COMMUNITY_ID`).

Dữ liệu các khóa **không lẫn vào nhau** (mỗi khóa một D1). Sửa lỗi hay thêm tính năng ở xương lớn thì mọi khóa cùng được hưởng.

## Các tính năng bật/tắt được

| Khóa (`features`) | Tính năng |
|---|---|
| `attendance` | Điểm danh offline từ Google Sheet (tính 50% điểm xếp hạng, báo cáo buổi học) |
| `grading` | Bàn chấm bài tuần, năng lực người chấm |
| `aiGrading` | Chấm câu chữ bằng AI (OpenAI) |
| `teamBoard` | Bảng xếp hạng đồng đội |
| `teamAwards` | 5 danh hiệu tuần của đội |
| `publicLeaderboard` | Bảng xếp hạng công khai (tắt: phải đăng nhập mới xem) |
| `reports` | Báo cáo thống kê |

Tắt tính năng nào thì trang đó ẩn khỏi menu, đường dẫn trả "không dùng tính năng này", cron không chạy phần đó.

## Các bước (Claude làm, chủ dự án đồng ý từng bước)

1. Chép `courses/nskt2026/` thành `courses/<mã-khóa>/`, sửa hồ sơ theo khóa mới.
2. Thêm môi trường trong `wrangler.jsonc` (`env.<mã-khóa>`): tên worker, D1 mới, `alias` `@course` trỏ tới hồ sơ mới, thư mục `assets`, biến `DH3G_COMMUNITY_ID`.
3. Tạo D1 mới, chạy toàn bộ `migrations/` lên D1 đó.
4. Chủ dự án nhập secret cho worker mới (`DH3G_API_KEY`, và nếu dùng: `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`).
5. Triển khai worker mới; admin tạo tài khoản BTC cho khóa ở `/quan-tri`.
