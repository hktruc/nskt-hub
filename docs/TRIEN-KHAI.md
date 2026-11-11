# Đưa nskt-hub lên Cloudflare (lần đầu)

Chưa làm bước nào dưới đây. Chỉ làm khi chủ dự án đồng ý triển khai; Claude sẽ hướng dẫn chi tiết từng bước lúc đó.

Những việc **chỉ chủ dự án làm được** (Claude không có quyền vào Cloudflare):

1. **Tạo cơ sở dữ liệu D1** tên `nskt-hub-db`, rồi gửi lại *mã cơ sở dữ liệu* (Database ID — không phải bí mật) để điền vào `wrangler.jsonc`.
2. **Tạo các bảng**: mở D1 → `nskt-hub-db` → Console, dán toàn bộ nội dung `docs/d1-tao-bang-lan-dau.sql`, bấm Execute (chỉ làm một lần).
3. **Kết nối repo này với Cloudflare** (Workers Builds) để mỗi lần gộp vào `main` thì tự triển khai worker `nskt-hub`.
4. **Bật Cloudflare Access** cho địa chỉ của ứng dụng và chỉ cho phép email của BTC. Gửi lại hai giá trị (không phải bí mật): tên miền nhóm Access (`ACCESS_TEAM_DOMAIN`) và mã AUD của ứng dụng (`ACCESS_AUD`).
5. **Nhập khóa dh3g** vào worker `nskt-hub` dưới dạng secret tên `DH3G_API_KEY`. Không gửi khóa qua chat, không dán vào file nào.
6. **Nhập khóa OpenAI** dưới dạng secret tên `OPENAI_API_KEY` (để AI chấm bài). Nên đặt giới hạn chi tiêu hằng tháng trên trang OpenAI. Mô hình mặc định `gpt-5-nano`; nếu OpenAI báo tên mô hình không hợp lệ, đổi biến `OPENAI_MODEL` trong `wrangler.jsonc`.

Thứ tự an toàn: làm 1–4 trước, kiểm tra trang "Tình trạng dữ liệu" mở được và báo "Chưa nhập khóa dh3g", rồi mới làm bước 5. Khi chưa có khóa, ứng dụng không gọi dh3g.

Sau bước 5: bấm "Tải lại toàn bộ từ đầu khóa" một lần. Dữ liệu về dần, mỗi 5 phút 3 khoảng ngày (khoảng 2 giờ cho lần đầu).
