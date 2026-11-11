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
| 0 | Nền: khung dự án, CLAUDE.md, kiểm thử, CI | Đang chờ duyệt PR |
| 1 | Lấy dữ liệu dh3g + trang "Tình trạng dữ liệu" + cron hàng ngày | Chưa bắt đầu |
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

## Lệnh

```bash
npm install
npm run check   # kiểm tra kiểu + kiểm thử + đóng gói thử (không triển khai)
npm run dev     # chạy thử trên máy
```

## Cấu trúc

- `src/index.tsx` — các đường dẫn của ứng dụng
- `src/layout.tsx` — khung trang chung
- `test/` — kiểm thử
- `wrangler.jsonc` — cấu hình Cloudflare (không chứa secret)
