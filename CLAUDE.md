# nskt-hub

Web app quản lý học tập NSKT2026 cho BTC: lấy dữ liệu từ dh3g.vn, theo dõi nộp bài, chấm điểm, xếp hạng, báo cáo thống kê. Chủ dự án không phải lập trình viên — báo cáo và giao diện viết bằng tiếng Việt dễ hiểu.

## Quy tắc làm việc (bắt buộc)

- Làm trên nhánh riêng, mở pull request. **Không gộp vào `main`** khi chủ dự án chưa đồng ý.
- Mỗi đợt nhỏ, kiểm tra được; PR ghi rõ cách chủ dự án tự kiểm tra.
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
| 1 | Lấy dữ liệu dh3g + trang "Tình trạng dữ liệu" + cron hàng ngày | Mã xong, thử bằng dữ liệu giả; đang chờ duyệt PR. **Chưa triển khai, chưa chạy với dh3g thật** |
| 2 | Bảng theo dõi nộp bài | Chưa bắt đầu |
| 3 | Đọc bài và chấm điểm | Chưa bắt đầu |
| 4 | Bảng xếp hạng | Chưa bắt đầu |
| 5 | Báo cáo thống kê | Chưa bắt đầu |
| 6 | Đưa vào dùng thật | Chưa bắt đầu |

Cập nhật bảng này ở cuối mỗi đợt.

## Nguồn dữ liệu dh3g (ghi nhận từ hệ thống cũ)

- Địa chỉ đã dùng: `GET https://api.dh3g.vn/hkm-api/public/report/cohort-submissions` với `communityId=44`, `fromDate`, `toDate` (lọc theo hạn nộp bài), `includeAnswers`.
- Trả về: bài tập (tên, loại NORMAL/WEEK/EXAM, hạn nộp, khóa học); học viên (họ tên, điện thoại, email, khóa, đội); bài nộp (trạng thái DONE/LATE/OVERDUE/NOT_SUBMITTED, thời điểm nộp, số lần sửa); câu trả lời; nhận xét và điểm của người chấm.
- dh3g có khai báo báo cáo điểm danh nhưng hệ thống cũ chưa từng gọi. Cần thử ở Đợt 1 xem khóa hiện tại có được phép không.
- Hệ thống cũ gọi theo từng khoảng 1–2 ngày để tránh phản hồi quá lớn. Giữ cách này.

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
