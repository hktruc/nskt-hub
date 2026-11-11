# Đưa nskt-hub lên Cloudflare (lần đầu)

Chưa làm bước nào dưới đây. Chỉ làm khi chủ dự án đồng ý triển khai; Claude sẽ hướng dẫn chi tiết từng bước lúc đó.

Những việc **chỉ chủ dự án làm được** (Claude không có quyền vào Cloudflare):

1. **Tạo cơ sở dữ liệu D1** tên `nskt-hub-db`, rồi gửi lại *mã cơ sở dữ liệu* (Database ID — không phải bí mật) để điền vào `wrangler.jsonc`.
2. **Tạo các bảng** bằng nội dung file `migrations/0001_init.sql`.
3. **Kết nối repo này với Cloudflare** (Workers Builds) để mỗi lần gộp vào `main` thì tự triển khai worker `nskt-hub`.
4. **Bật Cloudflare Access** cho địa chỉ của ứng dụng và chỉ cho phép email của BTC. Gửi lại hai giá trị (không phải bí mật): tên miền nhóm Access (`ACCESS_TEAM_DOMAIN`) và mã AUD của ứng dụng (`ACCESS_AUD`).
5. **Nhập khóa dh3g** vào worker `nskt-hub` dưới dạng secret tên `DH3G_API_KEY`. Không gửi khóa qua chat, không dán vào file nào.

Thứ tự an toàn: làm 1–4 trước, kiểm tra trang "Tình trạng dữ liệu" mở được và báo "Chưa nhập khóa dh3g", rồi mới làm bước 5. Khi chưa có khóa, ứng dụng không gọi dh3g.

Sau bước 5: bấm "Tải lại toàn bộ từ đầu khóa" một lần. Dữ liệu về dần, mỗi 5 phút 3 khoảng ngày (khoảng 2 giờ cho lần đầu).

## Điều cần kiểm tra ở lần chạy thật đầu tiên

- Báo cáo điểm danh: khóa hiện tại có được phép gọi không (hệ thống cũ chưa từng gọi).
- Kích thước phản hồi của một ngày có câu trả lời đầy đủ.
- Định dạng thời gian dh3g trả về (có múi giờ hay không).
- Bài tập không có hạn nộp có xuất hiện trong báo cáo theo ngày hay không.
