# Đưa nskt-hub lên Cloudflare (lần đầu)

Chưa làm bước nào dưới đây. Chỉ làm khi chủ dự án đồng ý triển khai; Claude sẽ hướng dẫn chi tiết từng bước lúc đó.

Những việc **chỉ chủ dự án làm được** (Claude không có quyền vào Cloudflare):

1. ✅ **Đã làm 11/11/2026:** cơ sở dữ liệu D1 `nskt-hub-db` (mã `66754a8e-7e74-4f88-aea9-bbd4c75b65fd`, vùng châu Á – Thái Bình Dương).
2. ✅ **Đã làm 11/11/2026:** tạo các bảng bằng `docs/d1-tao-bang-lan-dau.sql` (Claude chạy qua khóa API chỉ có quyền D1). Lần sau thêm bảng mới bằng `npx wrangler d1 migrations apply nskt-hub-db --remote`.
3. ✅ **Đã làm 11/11/2026.** **Kết nối repo này với Cloudflare** (Workers Builds) để mỗi lần gộp vào `main` thì tự triển khai worker `nskt-hub`.
4. ✅ **Đã làm 11/11/2026:** Access cho worker (chính sách "Long Mon staging owner only" — chỉ `hktruc@gmail.com`, phiên 1 tuần) và ngoại lệ công khai "nskt-hub - bảng xếp hạng công khai" cho `/bang-xep-hang` (Claude tạo qua API). Thêm email BTC: Zero Trust → Access → Applications → `nskt-hub - Cloudflare Workers` → Policies. Ban đầu: **Bật Cloudflare Access** cho địa chỉ của ứng dụng và chỉ cho phép email của BTC. Gửi lại hai giá trị (không phải bí mật): tên miền nhóm Access (`ACCESS_TEAM_DOMAIN`) và mã AUD của ứng dụng (`ACCESS_AUD`).
5. **Nhập khóa dh3g** vào worker `nskt-hub` dưới dạng secret tên `DH3G_API_KEY`. Không gửi khóa qua chat, không dán vào file nào.
6. **Nhập khóa OpenAI** dưới dạng secret tên `OPENAI_API_KEY` (để AI chấm bài). Nên đặt giới hạn chi tiêu hằng tháng trên trang OpenAI. Mô hình mặc định `gpt-5-nano`; nếu OpenAI báo tên mô hình không hợp lệ, đổi biến `OPENAI_MODEL` trong `wrangler.jsonc`.

Thứ tự an toàn: làm 1–4 trước, kiểm tra trang "Tình trạng dữ liệu" mở được và báo "Chưa nhập khóa dh3g", rồi mới làm bước 5. Khi chưa có khóa, ứng dụng không gọi dh3g.

Sau bước 5: bấm "Tải lại toàn bộ từ đầu khóa" một lần. Dữ liệu về dần, mỗi 5 phút 3 khoảng ngày (khoảng 2 giờ cho lần đầu).

## Nối Google Sheet điểm danh (chủ dự án làm một lần)

Ứng dụng đọc hai file bằng một **tài khoản dịch vụ Google** chỉ có quyền xem: "NSKT2026 - KỶ LUẬT - HỌC VIÊN" (trang `CHECK_IN`) và "NSKT 2026 CHIA THÔN HỌC VIÊN" (trang `DS_CHIA_THON`).

1. Vào https://console.cloud.google.com → chọn hoặc tạo một dự án (ví dụ `nskt-hub`).
2. Mục **APIs & Services → Library** → tìm **Google Sheets API** → **Enable**.
3. Mục **IAM & Admin → Service Accounts → Create service account**: đặt tên `nskt-hub-doc-sheet`, bấm **Done** (không cần cấp vai trò nào).
4. Bấm vào tài khoản vừa tạo → tab **Keys → Add key → Create new key → JSON** → tải về một tệp `.json`. Tệp này là bí mật: không gửi qua chat, không để vào repo.
5. Cloudflare → Workers & Pages → `nskt-hub` → Settings → Variables and Secrets → **Add** → kiểu **Secret**, tên `GOOGLE_SERVICE_ACCOUNT_JSON`, giá trị: mở tệp `.json` bằng Notepad / TextEdit, chép **toàn bộ** nội dung dán vào → Deploy.
6. Trong tệp `.json` có dòng `client_email` (dạng `nskt-hub-doc-sheet@….iam.gserviceaccount.com`). Mở **từng file** Google Sheet ở trên → **Chia sẻ** → dán email đó → quyền **Người xem** → bỏ chọn "Thông báo" → Gửi.
   Nếu Google báo không chia sẻ được ra ngoài tổ chức: quản trị Google Workspace / Drive dùng chung cần cho phép chia sẻ với email này.
7. Mở `/du-lieu` → mục "Điểm danh offline" → bấm **Đọc lại điểm danh ngay**. Thấy "Thành công · N buổi · ghép được …" là xong; sau đó ứng dụng tự đọc mỗi giờ.
