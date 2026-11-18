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
| `faq` | Câu hỏi học viên gửi BTC → AI biên tập thành FAQ (trang BTC `/faq`) + mục Câu hỏi thường gặp cuối bảng xếp hạng |
| `discipline` | Kỷ luật: lỗi nhẹ / lỗi nặng (bài tập, Zoom, camera), trưởng nhóm, BTC duyệt miễn, nhật ký nhóm |

Các trường khác trong hồ sơ: `home` (trang chủ `overview` hay `discipline`), `publicPath` (link công khai của phần kỷ luật, vd. `/45ngaydonghanh`), `discipline` (quy tắc lỗi, `zoomCheckinTime`, `zoomLateMinutes`, điểm lỗi, các mục nhật ký nhóm), `faq.sources` (câu nào của bài tuần là nguồn FAQ), `teams` (số đội, cách đọc tên đội trên dh3g), `brand`, `scoring`, `grading`, `attendance`. Hồ sơ mới có thể kế thừa hồ sơ có sẵn (`...NSKT`) rồi chỉ ghi đè phần khác, như `courses/45n-k2/course.ts`.

**Trước khi viết hồ sơ:** gọi dh3g cho cộng đồng mới (chỉ đếm số lượng, đọc đề bài, không in dữ liệu cá nhân) để biết các khóa trong cộng đồng (`courseId`), tên đội, loại bài, cấu trúc câu hỏi, có điểm danh Zoom hay không. Một cộng đồng có thể chứa nhiều khóa (như cộng đồng 47 có K01 và K02).

## Các khóa đang có

| Khóa | Hồ sơ | Cấu hình | Link |
|---|---|---|---|
| NSKT2026 (dh3g 44) | `courses/nskt2026/` | `wrangler.jsonc` | nskt-hub.hktruc.workers.dev |
| 45N K02 (dh3g 47) | `courses/45n-k2/` | `courses/45n-k2/wrangler.jsonc` | 45n-hub.hktruc.workers.dev |

Tắt tính năng nào thì trang đó ẩn khỏi menu, đường dẫn trả "không dùng tính năng này", cron không chạy phần đó.

## Các bước (Claude làm, chủ dự án đồng ý từng bước)

1. Chép `courses/nskt2026/` thành `courses/<mã-khóa>/`, sửa hồ sơ theo khóa mới.
2. Chép `courses/45n-k2/wrangler.jsonc` sang thư mục khóa mới, sửa tên worker, D1, `DH3G_COMMUNITY_ID`; thêm lệnh đóng gói thử vào `npm run build`.
3. Tạo D1 mới **ở châu Á** (`primary_location_hint: "apac"`; không chỉ định thì có thể bị đặt ở Mỹ, trang chậm), chạy toàn bộ `migrations/` lên D1 đó. Từ đó mọi migration mới phải chạy lên D1 của mọi khóa trước khi gộp.
3b. Tạo ứng dụng Cloudflare Access riêng cho `<tên-worker>.hktruc.workers.dev/quan-tri`, dùng lại chính sách "Long Mon staging owner only"; ghi `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` vào cấu hình khóa.
3c. Thêm hồ sơ kiểm thử `vitest.<mã>.config.ts` và thư mục `test/<mã>/` nếu khóa có tính năng riêng; đưa vào `npm test`.
4. Chủ dự án nhập secret cho worker mới (`DH3G_API_KEY`, và nếu dùng: `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`).
5. Triển khai: `npx wrangler deploy -c courses/<mã-khóa>/wrangler.jsonc`; admin tạo tài khoản BTC cho khóa ở `/quan-tri`.

Kiểm thử: `npm test` chạy hai lượt, một với hồ sơ NSKT (`vitest.config.ts`), một với hồ sơ 45N (`vitest.45n.config.ts`, thư mục `test/45n/`).

## Triển khai tự động (Workers Builds), làm một lần cho mỗi khóa

NSKT2026 và mỗi khóa khác là một Workers Builds riêng, cùng nối với repo `hktruc/nskt-hub`; gộp vào `main` là mọi khóa cùng cập nhật.

Chủ dự án làm trên dash.cloudflare.com (Claude không có quyền tạo worker):

1. **Workers & Pages → Create → Import a repository** → chọn `hktruc/nskt-hub`.
2. **Project name**: đúng tên worker trong cấu hình khóa (vd. `45n-hub`).
3. **Build command**: để trống. **Deploy command**: `npx wrangler deploy -c courses/<mã-khóa>/wrangler.jsonc`. **Root directory**: `/`. Nhánh: `main`.
4. Bấm **Deploy**. Xong thì vào worker → **Settings → Variables and Secrets** → **Add** → Type **Secret**, Name `DH3G_API_KEY`, Value = khóa dh3g (giống NSKT).
5. Vào `https://<tên-worker>.hktruc.workers.dev/quan-tri` (đăng nhập Cloudflare Access bằng email chủ dự án) → tạo tài khoản số điện thoại cho mình (admin), BTC, trưởng nhóm.

Phần Claude làm trước: tạo D1 **đặt ở châu Á** (API: `primary_location_hint: "apac"`; không chỉ định thì Cloudflare đặt gần máy tạo, có thể ở Mỹ, trang sẽ chậm), chạy migrations, tạo ứng dụng Cloudflare Access cho `/quan-tri` (dùng lại chính sách "chỉ email chủ dự án"), ghi mã D1 và AUD vào `courses/<mã-khóa>/wrangler.jsonc`.
