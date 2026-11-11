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
| 2026-11-11 | 12 thôn = 12 đội, ký hiệu T01–T12; trên dh3g tên là "Đội Cá Chép 01…12" (dh3g còn một đội "BTC"). |
| 2026-11-11 | **Số điện thoại là định danh chính thức** của học viên và coach, dùng để ghép dh3g với các file Google Sheet. Mã Cư Dân và mã học viên dh3g có thể thay đổi, không dùng làm khóa ghép. |
| 2026-11-11 | Vai trò: **admin** (chủ dự án), **BTC**, **coach** — toàn quyền; **phụng sự** (học viên được BTC giao vai trò) — chỉ chấm các đội được phân công. |
| 2026-11-11 | Đăng nhập người chấm: **số điện thoại + mật khẩu tự đặt**, kích hoạt lần đầu bằng **mã dùng một lần do admin cấp**; admin thu hồi quyền / cấp lại mã bất cứ lúc nào. Không dùng OTP SMS/Zalo. |
| 2026-11-11 | Bàn chấm bài: phân loại theo đội; nút bấm rõ ràng mở video/ảnh/tệp ngay; tự phát hiện link YouTube / Facebook / TikTok… trong nội dung bài, kể cả khi dh3g ghi 0 tệp; tệp tải thẳng lên dh3g cũng được tính; thống kê số video, số ảnh theo học viên / đội. |
| 2026-11-11 | Giao diện: **mobile first**, phương án **A** (xanh ngọc, bo tròn, phẳng, phông Be Vietnam Pro) — chi tiết ở `docs/THIET-KE.md`. Chủ dự án giao Claude tự thiết kế UI/UX theo các nhu cầu trên. |
| 2026-11-11 | Nguồn ngoài dh3g: Google Sheet **"NSKT2026 - KỶ LUẬT - HỌC VIÊN"** (điểm danh offline, trang `CHECK_IN`) và **"NSKT2026 - CHẤM CHÉO BÀI TẬP"** (chấm chéo offline, trang `CHAM_CHEO_LOG`). Khác với chấm chéo trên dh3g. |
| 2026-11-11 | Điểm và bảng xếp hạng **tính từ sau ngày khai giảng 29/09/2026**. |
| 2026-11-11 | **Bảng xếp hạng công khai** (không cần đăng nhập), gồm toàn bộ học viên khóa, lọc được theo đội; ba màu xanh / vàng / đỏ = tốt / trung bình / tệ. |
| 2026-11-11 | Điểm cộng dồn cả hành trình nhưng **điểm cũ mờ dần**, để người cố gắng về sau vẫn lên được màu xanh. |
| 2026-11-11 | Chấm bằng AI qua **API OpenAI của chủ dự án**, dùng mô hình rẻ nhất vừa đủ đọc hiểu: mặc định `gpt-5-nano` (đặt trong biến `OPENAI_MODEL`, đổi được). Khóa là secret `OPENAI_API_KEY` trên Cloudflare, chủ dự án tự nhập. |
| 2026-11-11 | Nộp trễ (OVERDUE/LATE): **mỗi video được 2 điểm** (thay cho 3 / 10 điểm khi đúng hạn), tính vào **đúng tuần của bài tập đó**. **Câu chữ nộp trễ được một nửa điểm**, AI vẫn kiểm tra nội dung (chủ dự án chốt 11/11). Đồng điểm: ai **nộp đủ video sớm hơn và đúng hạn** xếp trên. |
| 2026-11-11 | Bảng xếp hạng công khai hiện: **họ tên, đội, điểm, màu**. Không hiện số điện thoại, email, cảnh báo. **Mỗi người một dòng, cả dòng tô theo màu**, không ghi chữ "Xanh/Vàng/Đỏ" hay chấm màu. |
| 2026-11-11 | Ngưỡng **xanh từ 80%**. |
| 2026-11-11 | Bắt đầu tính từ bài có hạn **30/09/2026** (không tính bài cam kết khai giảng 29/09). |
| 2026-11-11 | Nguồn danh sách học viên ↔ số điện thoại: Google Sheet **"NSKT 2026 CHIA THÔN HỌC VIÊN"** (tab `DS_HV` chỉ có 6 số cuối; tab `DS_CHIA_THON` và `DS_UP_DH3G` có đủ số, `DS_UP_DH3G` có cả Team Code và mã dh3g). |
| 2026-11-11 | **Tiếp tục dùng khóa dh3g hiện tại** (đội chủ dự án quyết định), dù khóa đang có trong file Google Sheet "NSKT 2026 CHIA THÔN HỌC VIÊN". |
| 2026-11-11 | Cloudflare: gói **Workers Paid**; chạy ở địa chỉ miễn phí **`nskt-hub.<tài-khoản>.workers.dev`** (không dùng tên miền riêng). |
| 2026-11-11 | Kỹ thuật: một Cloudflare Worker (Hono + TypeScript, giao diện dựng sẵn trên máy chủ bằng JSX), D1, cron của Cloudflare, kiểm thử bằng Vitest. |

Mặc định đang dùng, chủ dự án chưa xác nhận rõ:

- D1 mới tải lại dữ liệu từ dh3g kể từ 2026-09-23. Chưa có trang cho học viên.
- (Claude hiểu) Cloudflare Access trong Đợt 1 chỉ là lớp khóa tạm khi chưa có đăng nhập riêng; khi làm đăng nhập bằng số điện thoại (cùng Đợt 3), Access sẽ bỏ hoặc chỉ giữ cho trang quản trị.

## Còn chờ chủ dự án quyết

- Tiêu chí chấm và thang điểm cho từng loại bài (thường / tuần / thi) — chặn Đợt 3.
- Duyệt **độ mờ dần (nửa đời 3 tuần)** và **ngưỡng vàng 50%** (ngưỡng xanh đã chốt 80%).
- Định nghĩa "kỷ luật" và các chỉ số cần có trong báo cáo — chặn Đợt 5.
- Cách nskt-hub đọc hai Google Sheet hằng ngày (Claude đề xuất: tài khoản dịch vụ Google chỉ có quyền xem).
- Ký hiệu `PD` trong file điểm danh nghĩa là gì (trang hướng dẫn chưa ghi).
- Ai phân công phụng sự vào đội (chỉ admin, hay cả coach); điểm phụng sự chấm có cần coach duyệt không.
- Bàn chấm bài có hai khu vực: khu vực 1 cho phụng sự / coach chấm; **khu vực 2 chủ dự án chưa mô tả**.

## Tiến độ

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| 0 | Nền: khung dự án, CLAUDE.md, kiểm thử, CI | Xong (đã gộp 2026-11-11) |
| 1 | Lấy dữ liệu dh3g + trang "Tình trạng dữ liệu" + cron hàng ngày | Xong. **Đã chạy thật trên Cloudflare từ 12/11/2026** (`https://nskt-hub.hktruc.workers.dev`). |
| 2 | Bảng theo dõi nộp bài (`/nop-bai`): theo bài, theo đội, theo tình trạng, đếm video/ảnh | Mã xong; đã chạy với dữ liệu thật (140 học viên 12 đội, 44 bài, ~2.830 video). Xong, đã gộp (PR #3 → PR #5). |
| 3 | Đọc bài và chấm điểm | **3a** (PR #9): trang đọc bài `/bai`, BTC sửa điểm tay từng câu, trang `/canh-bao` — dùng đăng nhập Cloudflare Access. **3b** chưa làm: đăng nhập số điện thoại cho coach / phụng sự, phân công đội. |
| 4 | Chấm điểm tự động (quy tắc + AI OpenAI) và bảng xếp hạng công khai `/bang-xep-hang` | Mã xong; đã chạy với dữ liệu thật (6.845 dòng điểm, 140 người). AI chưa chạy thật (chưa có khóa OpenAI). Xong, đã gộp (PR #4 → PR #5). |
| 5 | Báo cáo thống kê | Chưa bắt đầu |
| 6 | Đưa vào dùng thật | Chưa bắt đầu |

Cập nhật bảng này ở cuối mỗi đợt. Mỗi PR trỏ thẳng vào `main`, **không xếp chồng** (PR #3, #4 từng bị gộp vào nhánh trung gian, phải mở PR #5 để đưa vào `main`).

## Quy tắc điểm (chủ dự án mô tả 2026-11-11)

Chỉ tính các bài có hạn nộp **sau 29/09/2026**.

**Bài tập ngày** (dh3g loại `NORMAL`, 4 câu; nhãn có sẵn trong câu hỏi):
- Câu "(bắt buộc) (X1)": trả lời = **1 điểm**.
- Câu "(khuyến khích) (X3)": có **video** = **3 điểm**; không có video nhưng là chữ có **đúc kết sâu sắc** = **1 điểm** (AI đánh giá); còn lại 0.

**Bài tập tuần** (dh3g loại `WEEK`, tiêu đề có "(X10)"; câu hỏi đổi theo tuần nên AI đọc cả câu hỏi lẫn câu trả lời):
- Câu yêu cầu nộp video: **mỗi video 10 điểm**.
- Câu bắt buộc khác: trả lời liên quan, có trách nhiệm, sâu sắc = **3 điểm**.
- Câu góp ý cho BTC (không bắt buộc — "điểm tốt cần phát huy", "điểm cần cải thiện", "hành động đóng góp", "khó khăn & câu hỏi"): **1 điểm mỗi câu**.

**Cảnh báo trả lời đối phó**: vài chữ cái / ký hiệu vô nghĩa / gõ đại → ghim cảnh báo cho BTC (chỉ BTC thấy, không hiện trên bảng công khai). Dữ liệu thật: ~2.960 câu tự luận ngày và ~1.110 câu tự luận tuần dưới 15 ký tự, không có link.

**Cách tính đang dùng (Claude đề xuất, chủ dự án chưa duyệt — mọi con số ở `src/scoring/config.ts`):**
- Điểm là **% so với điểm tối đa có thể đạt**, cùng độ mờ, để tuần nhiều bài hay ít bài vẫn so sánh công bằng.
- Mờ dần theo **nửa đời 3 tuần**: điểm của 3 tuần trước tính một nửa, 6 tuần trước một phần tư.
- Màu: **Xanh ≥ 80%** (chủ dự án chốt 11/11), **Vàng 50–79%**, **Đỏ < 50%**. Ngưỡng tuyệt đối (ai đạt cũng xanh), không theo thứ hạng. Dữ liệu thật 11/11 (AI chưa chấm): 23 xanh / 98 vàng / 19 đỏ trên 140 người.
- Đồng điểm: nhiều video đúng hạn hơn xếp trên; rồi trung bình nộp video sớm hơn hạn nhiều giờ hơn xếp trên; bằng hết thì ngang hạng.
- Cấu trúc bài tuần (câu nào là câu video, tối đa mấy video) suy ra từ dữ liệu nộp: câu mà ≥ 50% người nộp có video là câu video, số video tối đa = mức 75% người nộp đạt. Khớp với dữ liệu thật (tuần 02–04: 40 điểm video, tuần 05: 20).
- AI chấm là **gợi ý**; khi chưa có AI dùng quy tắc tạm theo độ dài và trang xếp hạng ghi "đang chờ chấm". BTC sửa tay từng câu ở trang `/bai` (bảng `score_overrides`, ghi email người sửa); điểm sửa tay ưu tiên hơn AI, bị kẹp trong 0…điểm tối đa của câu.
- Chỉ xếp hạng học viên thuộc 12 đội (bỏ đội "BTC" và người chưa có đội).

## Nguồn Google Sheet (đọc 2026-11-11, chưa tích hợp)

- **Điểm danh offline** (`CHECK_IN`): mỗi dòng một học viên (Mã Thôn, Mã Cư Dân, họ tên, khu vực), mỗi cột một buổi: KHAI GIANG rồi các thứ Sáu 09/10 → 25/12. Ký hiệu: ✅ đúng giờ đúng chỗ, X đúng giờ sai vị trí, ⚠️ không có vị trí / dùng chung máy, M muộn, M1 muộn + sai vị trí, P nghỉ có phép, PD (chưa rõ), ❌ vắng không phép. Giờ check-in đúng giờ 17:00–18:30, muộn 18:30–19:30 (buổi khai giảng 15:00–16:30).
- **Chấm chéo offline** (`CHAM_CHEO_LOG`): mỗi dòng một lượt chấm — người chấm, người được chấm (Mã Cư Dân), mã đợt, tóm tắt, 4 tiêu chí 1–5 sao kèm nhận xét: Sơ đồ, Thuyết phục, Phản biện, Đặt câu hỏi; điểm TB. Có dòng thử của BTC (mã `BTC..`, thôn `TEST`) — phải loại. Mã đợt chưa thống nhất (`CC-T1` ở `DOT_CHAM`, `CC-20260925` ở `TONG_HOP`).
- Hai file chưa có số điện thoại. Ghép thử theo họ tên chỉ khớp chắc chắn ~80% → không ghép theo tên.

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
- Câu trả lời: `type` là "Trắc nghiệm" hoặc "Tự luận" (đôi khi null). Link video/ảnh nằm trong câu **tự luận**: chủ yếu YouTube (youtu.be, youtube.com), Facebook, TikTok, Google Drive; tệp tải thẳng lên dh3g có dạng đường dẫn `s3.sunteco.app` (chủ yếu jpeg/png, vài pdf). `mediaCount` của dh3g không tách video/ảnh và có ~240 bài ghi 0 dù có link → tự đếm từ link. Bài nộp lớn nhất khoảng 80 KB; một ngày lớn nhất 1,4 MB.
- Nhận xét (`feedbacks`): do **học viên chấm chéo nhau**, điểm `grade` thang 0–100; mới có ở khoảng 6% bài đã nộp.
- `gracePeriodMinutes` luôn bằng 0. Không có bài nào thiếu hạn nộp.

## Cách đồng bộ dh3g hoạt động

- Bảng `sync_jobs` vừa là hàng đợi vừa là nhật ký: mỗi dòng là một lần gọi dh3g cho một khoảng ngày.
- Cron `15 0 * * *` (07:15 giờ VN): xếp việc cho các bài có hạn nộp từ 14 ngày trước đến 7 ngày tới. Lần đầu tiên và mỗi thứ Hai: xếp toàn bộ từ `SYNC_START_DATE`.
- Cron `*/5 * * * *`: xử lý tối đa 3 việc, ngày mới nhất trước. Không có khóa thì không làm gì. Sau đó chấm điểm: dựng cấu trúc câu hỏi cho bài có bài nộp mới, gửi AI tối đa 8 bài nộp, tính lại tối đa 400 dòng điểm có thay đổi.
- Bài nộp: mỗi khoảng 1 ngày (theo hạn nộp), luôn kèm câu trả lời. Điểm danh: mỗi khoảng 7 ngày.
- Lỗi tạm thời thử lại tối đa 3 lần. Khóa bị từ chối (401/403) hoặc bị giới hạn (429): dừng lượt, việc vẫn nằm trong hàng đợi.
- Mỗi cặp (học viên, bài tập) là một dòng trong `submissions`; câu trả lời, nhận xét, lịch sử sửa lưu dạng JSON trong dòng đó. `changed_at` chỉ đổi khi nội dung thật sự khác; `answers_hash` để Đợt 3 biết bài đã bị sửa sau khi chấm.
- Bản gốc nén của lần gọi mới nhất cho mỗi khoảng ngày nằm ở `raw_responses` / `raw_chunks`.
- Ghi nhiều dòng bằng một câu lệnh qua `json_each` để tốn ít lượt gọi D1.

## Bảo mật

- `/bang-xep-hang` công khai (không đăng nhập), chỉ hiện hạng, họ tên, đội, %, màu. Mọi trang khác trừ `/health` phải có mã Cloudflare Access hợp lệ; ứng dụng tự kiểm tra chữ ký và AUD (`src/auth.ts`). Thiếu `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` thì khóa toàn bộ.
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
- `src/scoring/` — quy tắc điểm (`config`, `spec`, `rules`), chạy định kỳ (`run`), bảng xếp hạng (`leaderboard`)
- `src/ai/openai.ts` — gọi OpenAI chấm câu cần đọc hiểu
- `src/domain/` — quy tắc nghiệp vụ không phụ thuộc giao diện: `media.ts` (phát hiện video/ảnh/tệp), `teams.ts` (tên đội dh3g → T01…T12)
- `docs/anh/` — ảnh chụp giao diện bằng dữ liệu giả
- `migrations/` — cấu trúc D1 (chỉ thêm file mới, không sửa file đã áp dụng). **Bản triển khai không tự chạy migration**: trước khi gộp PR có file migration mới, chạy file đó lên D1 thật (Claude làm qua API D1, rồi ghi tên vào bảng `d1_migrations`). Đã chạy: 0001, 0002, 0003.
- `docs/TRIEN-KHAI.md` — các bước đưa lên Cloudflare
- `docs/THIET-KE.md` — hệ thống giao diện (màu, chữ, thành phần, quy tắc mobile)
- `test/` — kiểm thử
- `wrangler.jsonc` — cấu hình Cloudflare (không chứa secret)
