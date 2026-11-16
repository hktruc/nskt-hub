# Thêm một khóa học mới ("xương cá")

Một bộ mã nguồn dùng chung (xương lớn) cho nhiều khóa học (xương con). Mỗi khóa có:

- **Hồ sơ khóa học** `courses/<mã-khóa>/course.ts` — tên, logo, số đội và cách đọc tên đội trên dh3g, quy tắc điểm, tiêu chí chấm, file Google Sheet, và **bật/tắt tính năng**.
- **Ảnh, logo** `courses/<mã-khóa>/public/`.
- **Cấu hình Cloudflare riêng** `courses/<mã-khóa>/wrangler.jsonc` (riêng NSKT2026 dùng `wrangler.jsonc` ở gốc): worker riêng (link riêng `<tên>.hktruc.workers.dev`), D1 riêng, secret riêng, mã cộng đồng dh3g riêng (`DH3G_COMMUNITY_ID`). Wrangler không cho đổi hồ sơ khóa (`alias`) theo `env`, nên mỗi khóa một tệp cấu hình.

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
| `leaderboard` | Bảng xếp hạng theo điểm % (bài tập + đi học) |
| `discipline` | Kỷ luật: lỗi nhẹ / lỗi nặng (bài tập, Zoom, camera), trưởng nhóm, BTC duyệt miễn, nhật ký nhóm |

## Các khóa đang có

| Khóa | Hồ sơ | Cấu hình | Link |
|---|---|---|---|
| NSKT2026 (dh3g 44) | `courses/nskt2026/` | `wrangler.jsonc` | nskt-hub.hktruc.workers.dev |
| 45N K02 (dh3g 47) | `courses/45n-k2/` | `courses/45n-k2/wrangler.jsonc` | 45n-hub.hktruc.workers.dev (chưa triển khai) |

Tắt tính năng nào thì trang đó ẩn khỏi menu, đường dẫn trả "không dùng tính năng này", cron không chạy phần đó.

## Các bước (Claude làm, chủ dự án đồng ý từng bước)

1. Chép `courses/nskt2026/` thành `courses/<mã-khóa>/`, sửa hồ sơ theo khóa mới.
2. Chép `courses/45n-k2/wrangler.jsonc` sang thư mục khóa mới, sửa tên worker, D1, `DH3G_COMMUNITY_ID`; thêm lệnh đóng gói thử vào `npm run build`.
3. Tạo D1 mới, chạy toàn bộ `migrations/` lên D1 đó.
4. Chủ dự án nhập secret cho worker mới (`DH3G_API_KEY`, và nếu dùng: `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`).
5. Triển khai: `npx wrangler deploy -c courses/<mã-khóa>/wrangler.jsonc`; admin tạo tài khoản BTC cho khóa ở `/quan-tri`.

Kiểm thử: `npm test` chạy hai lượt, một với hồ sơ NSKT (`vitest.config.ts`), một với hồ sơ 45N (`vitest.45n.config.ts`, thư mục `test/45n/`).
