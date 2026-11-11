# Hệ thống giao diện nskt-hub

Chốt ngày 2026-11-11: **mobile first, phương án A** (xanh ngọc, bo tròn, phẳng). Tham khảo bộ dữ liệu thiết kế `nextlevelbuilder/ui-ux-pro-max-skill` (giấy phép MIT): nhóm "Productivity Tool / Online Course", phong cách "Flat Design + Accessible & Ethical", cặp chữ "Vietnamese Friendly". Không chép mã từ repo đó.

Mã nguồn của các giá trị dưới đây: `src/layout.tsx` (biến CSS trên `:root`).

## Nguyên tắc

1. **Điện thoại trước.** Thiết kế ở bề rộng 360–390 px, rồi mới mở rộng cho máy tính. Không có thanh cuộn ngang trên trang; bảng rộng thì cuộn trong khung riêng.
2. **Một việc chính mỗi màn hình.** Người chấm mở ra là thấy ngay bài cần chấm, không phải tìm.
3. **Bấm được thì phải to.** Nút và ô nhập cao tối thiểu 44 px; khoảng cách giữa hai nút tối thiểu 8 px.
4. **Chữ dễ đọc.** Chữ thân tối thiểu 16 px; chữ phụ 13–14 px chỉ cho thông tin không quan trọng.
5. **Không chỉ dựa vào màu.** Trạng thái luôn có chữ (và biểu tượng nếu cần): "Đúng hạn", "Nộp trễ", "Chưa nộp".
6. **Nhẹ và nhanh.** Không bóng đổ nặng, không hiệu ứng chuyển động dài (tối đa 200 ms, tắt khi máy đặt "giảm chuyển động"). Ảnh tải chậm (`loading="lazy"`), video YouTube chỉ hiện ảnh bìa cho đến khi bấm.
7. **Biểu tượng bằng SVG**, không dùng emoji làm biểu tượng.
8. **Có chế độ tối** theo cài đặt của máy.

## Màu

| Vai trò | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--bg` | `#F0FDFA` | `#0F1C1B` | Nền trang |
| `--card` | `#FFFFFF` | `#172826` | Thẻ, thanh trên |
| `--fg` | `#134E4A` | `#E6F4F1` | Chữ chính |
| `--muted` | `#475569` | `#9DB3B0` | Chữ phụ |
| `--line` | `#CCEFEA` | `#2A403D` | Viền |
| `--soft` | `#E6F6F3` | `#1D3532` | Nền nút phụ, ô nổi |
| `--accent` | `#0D9488` | `#2DD4BF` | Nút chính, mục đang chọn, liên kết |
| `--on-accent` | `#FFFFFF` | `#04201D` | Chữ trên nút chính |
| `--ok-*` | xanh lá | | "Đúng hạn", lưu thành công |
| `--warn-*` | cam `#9A3412` trên `#FFF1E7` | | "Nộp trễ", cảnh báo |
| `--bad-*` | đỏ `#B91C1C` trên `#FDECEC` | | "Chưa nộp", lỗi |

Màu thương hiệu bên ngoài giữ nguyên: YouTube đỏ, Facebook xanh, để người chấm nhận ra ngay loại link.

## Chữ

- Phông **Be Vietnam Pro** (Google Fonts), dự phòng `system-ui`.
- Tiêu đề trang 22 px đậm 700; tiêu đề mục 18 px đậm 600; chữ thân 16 px; chữ phụ 13–14 px.
- Số liệu dùng `tabular-nums` để cột số thẳng hàng.

## Hình khối và khoảng cách

- Bo góc: thẻ và nút 12 px; chip / nhãn trạng thái bo tròn hẳn.
- Khoảng cách cơ bản 4 px; lề trang 16 px; khoảng giữa các thẻ 12 px.
- Thẻ có viền 1 px, không bóng đổ.

## Thành phần dùng chung

| Thành phần | Mô tả |
|---|---|
| Thanh trên | Tên trang + dòng phụ (bối cảnh: bài nào, ai đang chấm) |
| Chip lọc | Lọc theo đội / trạng thái, kèm số lượng; cuộn ngang được trên điện thoại |
| Ô số liệu | Số to + nhãn nhỏ (đã nộp, video, ảnh…) |
| Thẻ bài nộp | Người nộp, đội, giờ nộp, nhãn trạng thái; nút media; xem trước video/ảnh; trích đoạn trả lời + "Xem toàn bộ" |
| Nút media | YouTube / Facebook / TikTok / Ảnh (kèm số lượng) / Tệp — biểu tượng riêng, mở ngay |
| Khối chấm điểm | Theo tiêu chí (chờ BTC), ô nhận xét, nút "Lưu nháp" và "Chốt điểm" |
| Thanh điều hướng dưới | Trên điện thoại: 3–4 mục chính ở đáy màn hình, trong tầm ngón cái (từ Đợt 2) |

## Bàn chấm bài (bản phác thảo đã duyệt)

Thứ tự trên màn hình điện thoại:

1. Thanh trên: "Bàn chấm bài", bài tập đang chấm, các đội được phân công.
2. Chip lọc: từng đội (kèm số bài), "Chưa chấm", "Đã chấm".
3. Ba ô số liệu: đã nộp, số video, số ảnh.
4. Danh sách thẻ bài nộp; bấm vào một thẻ thì mở khối chấm điểm ngay bên dưới.

Phát hiện media: tìm link trong nội dung trả lời, phân loại YouTube / Facebook / TikTok / Google Drive / ảnh hoặc tệp tải lên dh3g (`s3.sunteco.app`) / khác. Không dùng `mediaCount` của dh3g.
