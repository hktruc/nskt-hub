# nskt-hub

Web app quản lý học tập NSKT2026 cho BTC: lấy dữ liệu từ dh3g.vn, theo dõi nộp bài, chấm điểm, xếp hạng, báo cáo thống kê. Chủ dự án không phải lập trình viên — báo cáo và giao diện viết bằng tiếng Việt dễ hiểu.

## Quy tắc làm việc (bắt buộc)

- Làm trên nhánh riêng, mở pull request. **Không gộp vào `main`** khi chủ dự án chưa đồng ý.
- Mỗi đợt nhỏ, kiểm tra được; PR ghi rõ cách chủ dự án tự kiểm tra.
- Dữ liệu thật để phát triển (chủ dự án cho phép 2026-11-11): chỉ tải về thư mục tạm của phiên làm việc, **ngoài repo**; khi phân tích chỉ in số lượng và cấu trúc, không in tên, điện thoại, email, bài làm. Khóa dh3g cho phiên làm việc nằm trong môi trường Claude `nskt-hub` (mục Network secrets, máy chủ `api.dh3g.vn`, tiêu đề `X-API-KEY`); Claude không thấy giá trị.
- **Không in, không lưu, không commit khóa API** hay bất kỳ secret nào. Khóa dh3g chỉ tồn tại dưới dạng secret trên Cloudflare (`DH3G_API_KEY`), do chủ dự án tự nhập.
- Không commit dữ liệu thật của học viên (tên, số điện thoại, email, bài làm). Kiểm thử chỉ dùng dữ liệu giả.
- **Không đụng tới hệ thống cũ**: ba repo `long-mon-*`, worker `long-mon-dh3g-staging-private-v1`, `long-mon-staging-test-v1` và các D1 của chúng. Không xóa dữ liệu đang có. Chỉ tắt hệ thống cũ khi chủ dự án yêu cầu.
- Không triển khai lên Cloudflare khi chưa được đồng ý.
- Trước khi mở PR: `npm run check` phải qua.

## Quyết định đã chốt

| Ngày | Quyết định |
|---|---|
| 2026-11-11 | Dự án mới hoàn toàn, tên `nskt-hub`, repo riêng. Không có brief cũ nào là chuẩn. |
| 2026-11-11 | Viết lại phần lấy dữ liệu dh3g trong dự án này, lưu vào D1 mới. Hệ thống cũ để yên làm bản lưu. |
| 2026-11-11 | Phiên bản đầu gồm: bảng theo dõi nộp bài, đọc bài và chấm điểm, bảng xếp hạng, báo cáo thống kê (học tập, kỷ luật, điểm danh…). |
| 2026-11-11 | Được phép gọi dh3g thật để phát triển và đối chiếu ngay từ đầu, không chỉ dùng dữ liệu giả. |
| 2026-11-11 | Kỹ thuật: một Cloudflare Worker (Hono + TypeScript, giao diện dựng sẵn trên máy chủ bằng JSX), D1, cron của Cloudflare, kiểm thử bằng Vitest. |

Mặc định đang dùng, chủ dự án chưa xác nhận rõ:

- Người dùng chỉ là BTC, đăng nhập qua Cloudflare Access. Chưa có trang cho học viên.
- D1 mới tải lại dữ liệu từ dh3g kể từ 2026-09-23.

## Còn chờ chủ dự án quyết

- Tiêu chí chấm và thang điểm cho từng loại bài (thường / tuần / thi) — chặn Đợt 3.
- Công thức xếp hạng: cộng điểm, trừ điểm trễ hạn, đồng hạng — chặn Đợt 4.
- Định nghĩa "kỷ luật" và các chỉ số cần có trong báo cáo — chặn Đợt 5.

## Tiến độ

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| 0 | Nền: khung dự án, CLAUDE.md, kiểm thử, CI | Xong (đã gộp 2026-11-11) |
| 1 | Lấy dữ liệu dh3g + trang "Tình trạng dữ liệu" + cron hàng ngày | Mã xong; đã chạy trên máy với dữ liệu dh3g thật và số liệu khớp (185 học viên, 13 đội, 44 bài tập, 8.140 bài nộp). Đang chờ duyệt PR. **Chưa triển khai lên Cloudflare** |
| 2 | Bảng theo dõi nộp bài | Chưa bắt đầu |
| 3 | Đọc bài và chấm điểm | Chưa bắt đầu |
| 4 | Bảng xếp hạng | Chưa bắt đầu |
| 5 | Báo cáo thống kê | Chưa bắt đầu |
| 6 | Đưa vào dùng thật | Chưa bắt đầu |

Cập nhật bảng này ở cuối mỗi đợt.

## Nguồn dữ liệu dh3g (đã đối chiếu với dữ liệu thật ngày 2026-11-11)

- Bài nộp: `GET https://api.dh3g.vn/hkm-api/public/report/cohort-submissions` với `communityId=44`, `fromDate`, `toDate` (lọc theo **hạn nộp**, tối đa 62 ngày), `includeAnswers=true`. Khóa gửi trong tiêu đề `X-API-KEY`.
- Điểm danh: `.../cohort-attendance` gọi được với khóa hiện tại, nhưng **dh3g chưa có buổi học nào** (danh sách `sessions` rỗng cho cả khóa). Chưa có dữ liệu điểm danh để làm báo cáo.
- **Thời gian dh3g là giờ Việt Nam, không ghi múi giờ** (ví dụ `2026-11-07T23:00:00`). Không được coi là UTC.
- Quy mô (23/09 → 18/11/2026): 185 học viên (23 người không có khóa `cohort`, 41 người không có đội), 13 đội (4–13 người), 44 bài tập (30 bài ngày NORMAL, 9 bài tuần WEEK, 5 bài thi EXAM), 8.140 dòng bài nộp. Hạn nộp thường 23:00; 17/57 ngày không có bài.
- Mỗi lần gọi trả về **đủ 185 học viên** và một dòng cho mỗi bài trong khoảng ngày, kể cả chưa nộp.
- Trạng thái (`status` / nhãn dh3g / `rawStatus`):
  - `DONE` / "Done" / SUBMITTED hoặc REVIEWED — nộp trước hạn.
  - `OVERDUE` / "Nộp trễ" / SUBMIT_LATER — **đã nộp nhưng sau hạn** (không phải "chưa nộp và quá hạn").
  - `LATE` / "Nộp muộn" / REVIEWED — rất hiếm (4 dòng), nộp sau hạn.
  - `NOT_SUBMITTED` / "Chưa nộp" — gồm cả bài **chưa tới hạn**; `submissionId`, `answers` là null.
- Câu trả lời: `type` là "Trắc nghiệm" hoặc "Tự luận" (đôi khi null). Bài nộp lớn nhất khoảng 80 KB; một ngày lớn nhất 1,4 MB.
- Nhận xét (`feedbacks`): do **học viên chấm chéo nhau**, điểm `grade` thang 0–100; mới có ở khoảng 6% bài đã nộp.
- `gracePeriodMinutes` luôn bằng 0. Không có bài nào thiếu hạn nộp.

## Cách đồng bộ dh3g hoạt động

- Bảng `sync_jobs` vừa là hàng đợi vừa là nhật ký: mỗi dòng là một lần gọi dh3g cho một khoảng ngày.
- Cron `15 0 * * *` (07:15 giờ VN): xếp việc cho các bài có hạn nộp từ 14 ngày trước đến 7 ngày tới. Lần đầu tiên và mỗi thứ Hai: xếp toàn bộ từ `SYNC_START_DATE`.
- Cron `*/5 * * * *`: xử lý tối đa 3 việc, ngày mới nhất trước. Không có khóa thì không làm gì.
- Bài nộp: mỗi khoảng 1 ngày (theo hạn nộp), luôn kèm câu trả lời. Điểm danh: mỗi khoảng 7 ngày.
- Lỗi tạm thời thử lại tối đa 3 lần. Khóa bị từ chối (401/403) hoặc bị giới hạn (429): dừng lượt, việc vẫn nằm trong hàng đợi.
- Mỗi cặp (học viên, bài tập) là một dòng trong `submissions`; câu trả lời, nhận xét, lịch sử sửa lưu dạng JSON trong dòng đó. `changed_at` chỉ đổi khi nội dung thật sự khác; `answers_hash` để Đợt 3 biết bài đã bị sửa sau khi chấm.
- Bản gốc nén của lần gọi mới nhất cho mỗi khoảng ngày nằm ở `raw_responses` / `raw_chunks`.
- Ghi nhiều dòng bằng một câu lệnh qua `json_each` để tốn ít lượt gọi D1.

## Bảo mật

- Mọi trang trừ `/health` phải có mã Cloudflare Access hợp lệ; ứng dụng tự kiểm tra chữ ký và AUD (`src/auth.ts`). Thiếu `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` thì khóa toàn bộ.
- `LOCAL_DEV_NO_AUTH=true` chỉ có tác dụng trên localhost; chỉ đặt trong `.dev.vars` (không commit).
- Thao tác ghi (POST) kiểm tra tiêu đề `Origin`.

## Lệnh

```bash
npm install
npm run check   # kiểm tra kiểu + kiểm thử + đóng gói thử (không triển khai)
npm run dev     # chạy thử trên máy (cần .dev.vars và `npx wrangler d1 migrations apply nskt-hub-db --local`)
```

Kiểm thử dùng SQLite có sẵn trong Node để giả lập D1 (`test/helpers/d1.ts`) và dh3g giả (`test/helpers/fixtures.ts`).

## Cấu trúc

- `src/index.tsx` — điểm vào của worker: trang web và cron
- `src/app.tsx` — các đường dẫn; `src/layout.tsx` — khung trang; `src/pages/` — từng trang
- `src/auth.ts` — kiểm tra đăng nhập Cloudflare Access
- `src/dh3g/` — gọi dh3g (`client`), đọc phản hồi (`parse`), ghi D1 (`store`)
- `src/sync/queue.ts` — lên kế hoạch và xử lý hàng đợi đồng bộ
- `migrations/` — cấu trúc D1 (chỉ thêm file mới, không sửa file đã áp dụng)
- `docs/TRIEN-KHAI.md` — các bước đưa lên Cloudflare
- `test/` — kiểm thử
- `wrangler.jsonc` — cấu hình Cloudflare (không chứa secret)
