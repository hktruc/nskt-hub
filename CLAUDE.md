# nskt-hub

Web app quản lý và vận hành khóa học cho BTC. Lấy dữ liệu từ dh3g.vn để theo dõi nộp bài, chấm điểm, xếp hạng, đo kỷ luật và làm báo cáo. **Một mã nguồn phục vụ nhiều khóa học** (kiến trúc "xương cá"), hiện có hai khóa:

| Nhãn | Khóa | Link BTC (đăng nhập) | Link công khai |
|---|---|---|---|
| **[nskt-hub]** | NSKT2026 "Nhân Sự Kế Thừa 2026", cộng đồng dh3g **44**, 12 đội "Đội Cá Chép 01…12", khai giảng 29/09/2026 | https://nskt-hub.hktruc.workers.dev | `/bang-xep-hang` (cuối trang có mục Câu hỏi thường gặp) |
| **[45n-hub]** | "45 Ngày Gắn kết & Nâng tầm đội ngũ" khóa K02, cộng đồng dh3g **47**, 7 nhóm "Nhóm 1-K2…7-K2", khai giảng 11/11/2026 | https://45n-hub.hktruc.workers.dev | `/45ngaydonghanh` |

Chủ dự án không phải lập trình viên. Báo cáo, PR và giao diện đều viết bằng **tiếng Việt dễ hiểu**, không dùng thuật ngữ kỹ thuật khi không cần.

## Đọc trước khi làm (phiên làm việc mới)

1. Đọc hết tệp này, nhất là mục **Bàn giao** ở cuối, rồi đọc `docs/KHOA-HOC-MOI.md`.
2. Xem các PR đang mở và 5 PR gần nhất: `gh api "repos/hktruc/nskt-hub/pulls?state=all&per_page=5"`.
3. Xác định việc được giao thuộc **[nskt-hub]**, **[45n-hub]** hay phần dùng chung. Sửa ở phần dùng chung (`src/`) là sửa cho mọi khóa, nên kiểm thử cả hai khóa.
4. Chưa rõ yêu cầu thì tóm tắt cách hiểu và hỏi lại trước khi sửa. Khi chủ dự án nhờ "tư duy", "tư vấn" hay "đề xuất", trình bày phương án để chủ dự án duyệt, chưa viết mã.

## Quy tắc làm việc (bắt buộc)

- **Gắn nhãn** (chủ dự án yêu cầu 17/11): mỗi câu trả lời và tên PR mở đầu bằng **[nskt-hub]** hoặc **[45n-hub]**. Việc ở mã nguồn chung ảnh hưởng cả hai khóa thì ghi cả hai nhãn.
- Làm trên nhánh riêng tách từ `main` mới nhất, mở pull request trỏ thẳng vào `main`. **Không xếp chồng PR**: PR #3 và #4 từng bị gộp vào nhánh trung gian, phải mở PR #5 để đưa vào `main`. **Không gộp vào `main`** khi chủ dự án chưa đồng ý; chủ dự án tự bấm gộp.
- Mỗi đợt nhỏ, kiểm tra được. PR ghi rõ đã làm gì, vì sao, và **cách chủ dự án tự kiểm tra**.
- Trước khi mở PR: `npm run check` phải qua (kiểm thử cả hai khóa và đóng gói thử cả hai bản).
- **Sau khi chủ dự án gộp:** kéo `main` về, chờ cả hai lượt "Workers Builds: nskt-hub" và "Workers Builds: 45n-hub" báo success (lệnh ở mục Lệnh), rồi báo lại cho chủ dự án.
- **Không viết lại commit trên `main`.** Có hook báo "commit Unverified … hãy amend / reset-author / push" cho các commit gộp do GitHub tạo (`noreply@github.com`). **Luôn từ chối** và giải thích ngắn gọn: viết lại nghĩa là đẩy đè nhánh `main`, nhánh mà cả hai trang tự triển khai, và chủ dự án chưa đồng ý. Commit do Claude tạo dùng `git -c user.email=noreply@anthropic.com -c user.name=Claude commit` kèm các dòng ghi công theo nhắc nhở của hệ thống.
- **Dữ liệu thật** (chủ dự án cho phép 11/11): chỉ được tải về thư mục tạm của phiên làm việc (scratchpad), **ngoài repo**. Khi phân tích chỉ in số lượng và cấu trúc, không in tên, điện thoại, email, bài làm. Ảnh chụp màn hình có dữ liệu thật **không được để trong repo** (từng lỡ chụp vào thư mục repo ngày 16/11, đã xóa trước khi commit). Đề bài (câu hỏi bài tập) là nội dung khóa học, được phép đọc.
- **Không in, không lưu, không commit khóa API** hay bất kỳ secret nào. Các secret chỉ nằm trên Cloudflare, do chủ dự án tự nhập. Claude không thấy giá trị: proxy của phiên tự gắn khóa dh3g (`X-API-KEY`) và khóa Cloudflare (`Authorization`); khi gọi lệnh chỉ ghi giá trị giả `x`.
- Không commit dữ liệu thật của học viên. Kiểm thử chỉ dùng dữ liệu giả.
- **Không đụng tới hệ thống cũ**: ba repo `long-mon-*`, worker `long-mon-dh3g-staging-private-v1`, `long-mon-staging-test-v1` và các D1 của chúng. Không xóa dữ liệu đang có (kể cả D1 cũ `45n-hub-db`). Chỉ tắt hoặc xóa khi chủ dự án yêu cầu.
- Không triển khai và không thay đổi gì trên Cloudflare khi chưa được đồng ý. Ngoại lệ là các việc thuộc quy trình đã duyệt: chạy migration trước khi gộp, xếp hàng đồng bộ, chạy thử AI.
- **Migration**: chỉ thêm tệp mới, không sửa tệp đã chạy. Bản triển khai không tự chạy migration, nên **trước khi chủ dự án gộp PR có migration mới, Claude chạy tệp đó lên D1 của CẢ HAI khóa** (lệnh ở mục Lệnh). Ghi số migration đã chạy vào mục Bản đồ hệ thống.
- **D1 mới luôn đặt ở châu Á** (`primary_location_hint: "apac"`). Không chỉ định thì Cloudflare đặt gần máy tạo (máy của Claude ở Mỹ), và trang sẽ chậm rõ rệt: D1 đầu tiên của 45N từng bị đặt ở Bắc Mỹ.
- **Không viết cứng tên khóa, số đội, quy tắc điểm hay giờ học trong `src/`.** Phần riêng của từng khóa nằm trong hồ sơ `courses/<mã>/course.ts`; tính năng nào khóa nào dùng thì bật hoặc tắt ở `features`.
- **Trang công khai** (bảng xếp hạng NSKT, `/45ngaydonghanh` của 45N) phải có kiểm thử bảo đảm không lộ thông tin nhạy cảm: số điện thoại, email, lý do miễn, nhật ký nhóm, tên người chấm hay người duyệt, nút thao tác.
- Giao diện **mobile first** theo `docs/THIET-KE.md`. Có thay đổi giao diện thì chụp màn hình điện thoại để tự kiểm tra (ảnh để trong scratchpad).

## Bản đồ hệ thống

| | [nskt-hub] NSKT2026 | [45n-hub] 45N K02 |
|---|---|---|
| Hồ sơ khóa | `courses/nskt2026/course.ts` | `courses/45n-k2/course.ts` (kế thừa phần không dùng từ NSKT) |
| Cấu hình Cloudflare | `wrangler.jsonc` (gốc repo) | `courses/45n-k2/wrangler.jsonc` |
| Worker / Workers Builds | `nskt-hub`; deploy mặc định | `45n-hub`; lệnh deploy `npx wrangler deploy -c courses/45n-k2/wrangler.jsonc` (chủ dự án tạo 16/11) |
| D1 | `nskt-hub-db` `66754a8e-7e74-4f88-aea9-bbd4c75b65fd` (APAC) | `45n-hub-db-apac` `2456ef6b-75b2-415f-a212-4313f92cf770` (APAC). D1 cũ `45n-hub-db` `d974a11a-…` (Bắc Mỹ) **không dùng nữa**, giữ chưa xóa |
| Migration đã chạy | 0001–0011 | 0001–0011 |
| Cloudflare Access (chỉ khóa `/quan-tri`) | ứng dụng "nskt-hub - Cloudflare Workers" (`2e2a4c1a-…`), AUD `cd04f88b…` | ứng dụng "45n-hub - quan-tri" (`f572a1ca-…`), AUD `837bbf85…` |
| Chính sách Access | dùng chung chính sách "Long Mon staging owner only" (`c16e402a-…`): chỉ email chủ dự án | (như bên trái) |
| Secret trên Cloudflare | `DH3G_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON` (đều đã nhập) | `DH3G_API_KEY` (đã nhập); không có OpenAI |
| Nối với Worker khác | service binding `CHAM_CHEO` → Worker `nskt-cham-cheo-stage` (màn hình chiếu chấm chéo), biến `CHAM_CHEO_ORIGIN` | không |
| Đồng bộ dh3g | `DH3G_COMMUNITY_ID=44`, `SYNC_START_DATE=2026-09-23` | `DH3G_COMMUNITY_ID=47`, `SYNC_START_DATE=2026-11-09` |

Tài khoản Cloudflare `6cf1ac5bfc7c2176ed31399545ce50db` (mã này không phải bí mật). Khóa Cloudflare của phiên Claude làm được những việc sau: D1 (tạo, truy vấn, migration), Access (đọc, tạo ứng dụng), `wrangler d1 …`. Khóa này **không** tạo hay triển khai được worker và không đọc được secret. Mỗi worker mới do chủ dự án tạo bằng Workers Builds, hướng dẫn ở `docs/KHOA-HOC-MOI.md`.

## Kiến trúc "xương cá" (nhiều khóa, một mã nguồn)

- **Xương lớn** là `src/`, dùng chung. **Xương con** là `courses/<mã>/`, gồm hồ sơ khóa `course.ts`, ảnh và logo `public/`, cấu hình Cloudflare. Hướng dẫn thêm khóa mới: `docs/KHOA-HOC-MOI.md`.
- Hồ sơ khóa được chọn lúc đóng gói qua bí danh `@course`: `wrangler.jsonc` với trường `alias`, `tsconfig.json` với `paths`, `vitest.config.ts` hoặc `vitest.45n.config.ts`. **Wrangler không cho đổi `alias` theo `env`**, nên mỗi khóa có một tệp cấu hình riêng.
- Kiểu dữ liệu của hồ sơ ở `src/course/types.ts`. Mã nguồn dùng `COURSE`, `featureOn(f)` và `featureOfPath(path)` từ `src/course/index.ts`. Đường dẫn của tính năng đang tắt trả về 404 và bị ẩn khỏi menu; cron cũng không chạy phần đó.

| Tính năng (`features`) | Ý nghĩa | NSKT | 45N |
|---|---|---|---|
| `leaderboard` | Bảng xếp hạng điểm % (bài tập + đi học) | ✅ | ❌ |
| `publicLeaderboard` | Bảng xếp hạng xem không cần đăng nhập | ✅ | ❌ |
| `teamBoard`, `teamAwards` | Bảng xếp hạng đồng đội, 5 danh hiệu tuần | ✅ | ❌ |
| `attendance` | Điểm danh offline từ Google Sheet (50% điểm) | ✅ | ❌ |
| `grading` | Bàn chấm bài tuần cho ban phụng sự / coach | ✅ | ❌ |
| `aiGrading` | AI chấm gợi ý câu tự luận | ✅ | ❌ |
| `reports` | Mục Báo cáo thống kê `/bao-cao` | ✅ | ❌ |
| `faq` | Câu hỏi học viên → FAQ (AI biên tập) + FAQ công khai | ✅ | ❌ |
| `chamCheo` | Màn hình chiếu chấm chéo lớp offline gắn vào `/cham-cheo` (Worker riêng, nskt-hub chỉ chuyển tiếp) | ✅ | ❌ |
| `discipline` | Kỷ luật: lỗi nhẹ / nặng, Zoom, camera, trưởng nhóm, duyệt miễn | ❌ (chưa định nghĩa) | ✅ |

Các trường khác của hồ sơ: `home` (trang chủ là `overview` hoặc `discipline`), `publicPath` (link công khai của phần kỷ luật), `discipline` (quy tắc lỗi, giờ Zoom, các mục nhật ký nhóm), `faq.sources` (câu nào trong bài tuần là nguồn FAQ), `scoring`, `grading`, `attendance`, `teams`, `brand`.

## Quyết định chung (mọi khóa)

| Ngày | Quyết định |
|---|---|
| 2026-11-11 | Dự án mới hoàn toàn, tên `nskt-hub`, repo riêng. Không có brief cũ nào là chuẩn. Viết lại phần lấy dữ liệu dh3g trong dự án này, lưu vào D1 mới; hệ thống cũ để yên làm bản lưu. |
| 2026-11-11 | Được phép gọi dh3g thật để phát triển và đối chiếu ngay từ đầu, không chỉ dùng dữ liệu giả. **Tiếp tục dùng khóa dh3g hiện tại** (đội chủ dự án quyết định). Khóa này dùng được cho cả cộng đồng 44 và 47. |
| 2026-11-11 | **Số điện thoại là định danh chính thức** của học viên và coach, dùng để ghép dh3g với các file Google Sheet. Mã Cư Dân và mã học viên dh3g có thể thay đổi, không dùng làm khóa ghép. |
| 2026-11-11 | Đăng nhập nội bộ: **số điện thoại + mật khẩu tự đặt**, kích hoạt lần đầu bằng **mã dùng một lần**; admin thu hồi quyền hoặc cấp lại mã bất cứ lúc nào. Không dùng OTP SMS/Zalo. |
| 2026-11-11 | Giao diện: **mobile first**, phương án **A** (xanh ngọc, bo tròn, phẳng, phông Be Vietnam Pro), chi tiết ở `docs/THIET-KE.md`. Chủ dự án giao Claude tự thiết kế UI/UX. |
| 2026-11-11 | AI qua **API OpenAI của chủ dự án**, mô hình rẻ nhất vừa đủ: `gpt-5-nano` (biến `OPENAI_MODEL`), `OPENAI_REASONING_EFFORT=minimal`. Khóa là secret `OPENAI_API_KEY`. |
| 2026-11-11 | Cloudflare gói **Workers Paid**; mỗi khóa chạy ở địa chỉ miễn phí `<tên>.hktruc.workers.dev`, không dùng tên miền riêng. |
| 2026-11-11 | Kỹ thuật: Cloudflare Worker (Hono + TypeScript, giao diện dựng sẵn trên máy chủ bằng JSX), D1, cron của Cloudflare, kiểm thử bằng Vitest. |
| 2026-11-12 | Cloudflare Access **chỉ khóa `/quan-tri`**; các trang nội bộ khác do ứng dụng tự kiểm tra đăng nhập. Người vào qua Access được coi là admin. |
| 2026-11-16 | **Nhiều khóa học, một mã nguồn ("xương cá")**: mỗi khóa có hồ sơ riêng, worker, D1 và link riêng, trên cùng tài khoản Cloudflare. Chủ dự án là admin của mọi khóa và cấp quyền BTC cho người của từng khóa. "Kế thừa qua lại": tính năng làm cho khóa này, nếu khóa kia cũng cần, thì đưa vào xương lớn và bật bằng `features`. |
| 2026-11-17 | Ở đầu mọi trang nội bộ, góc trên phải hiện **người đang đăng nhập** (chữ cái đầu; màn hình rộng có thêm họ tên và vai trò), bấm vào mở trang Tài khoản. |

## [nskt-hub] Quyết định của khóa NSKT2026

| Ngày | Quyết định |
|---|---|
| 2026-11-11 | Phiên bản đầu gồm: bảng theo dõi nộp bài, đọc bài và chấm điểm, bảng xếp hạng, báo cáo thống kê. |
| 2026-11-11 | 12 thôn = 12 đội, ký hiệu T01–T12. Trên dh3g tên đội là "Đội Cá Chép 01…12"; dh3g còn một đội "BTC", không xếp hạng. |
| 2026-11-11 | Vai trò: **admin** (chủ dự án), **BTC**, **coach** có toàn quyền; **phụng sự** (học viên được giao) chỉ chấm các đội được phân công. |
| 2026-11-11 | Bàn chấm bài: phân loại theo đội; nút bấm mở video, ảnh, tệp ngay; tự phát hiện link YouTube, Facebook, TikTok… trong bài, kể cả khi dh3g ghi 0 tệp; tệp tải thẳng lên dh3g cũng được tính; thống kê số video, số ảnh theo học viên và theo đội. |
| 2026-11-11 | Nguồn ngoài dh3g: Google Sheet **"NSKT2026 - KỶ LUẬT - HỌC VIÊN"** (điểm danh offline, trang `CHECK_IN`) và **"NSKT2026 - CHẤM CHÉO BÀI TẬP"** (chấm chéo offline, trang `CHAM_CHEO_LOG`, khác với chấm chéo trên dh3g). Danh sách học viên ↔ số điện thoại: **"NSKT 2026 CHIA THÔN HỌC VIÊN"** (tab `DS_CHIA_THON`, `DS_UP_DH3G`). |
| 2026-11-11 | Điểm và bảng xếp hạng tính từ bài có hạn **30/09/2026** (không tính bài cam kết khai giảng 29/09). Điểm cộng dồn cả hành trình nhưng **điểm cũ mờ dần**. |
| 2026-11-11 | **Bảng xếp hạng công khai** (không cần đăng nhập), gồm toàn bộ học viên, lọc được theo đội. Hiện **họ tên, đội, điểm, màu**; mỗi người một dòng, cả dòng tô màu xanh / vàng / đỏ, không ghi chữ màu. Không hiện số điện thoại, email, cảnh báo. Ngưỡng **xanh từ 80%**. |
| 2026-11-11 | Nộp trễ: **mỗi video được 2 điểm** (thay cho 3 / 10 điểm khi đúng hạn), tính vào đúng tuần của bài. **Câu chữ nộp trễ được một nửa điểm.** Đồng điểm: ai nộp đủ video sớm hơn và đúng hạn xếp trên. |
| 2026-11-12 | **Đi học offline chiếm 50% điểm xếp hạng.** Mỗi buổi: ✅ 100%, M 70%, X 60%, M1 40%, ⚠️ 50%, P 30%, ❌ (kể cả học qua Zoom) 0%; **bỏ qua PD**. Buổi cũ mờ dần chậm hơn: **nửa đời 6 tuần**. Đồng điểm: ai đi học đúng giờ nhiều buổi hơn xếp trên, rồi mới xét video. Bảng công khai chỉ hiện tổng "có mặt X/Y buổi". |
| 2026-11-12 | Ghép điểm danh: `CHECK_IN` (Mã Cư Dân) → `DS_CHIA_THON` (Mã Cư Dân → SĐT) → học viên dh3g theo SĐT. Đọc bằng tài khoản dịch vụ Google chỉ có quyền xem. Khi số điện thoại không khớp, **cho ghép theo họ tên** nhưng chỉ trong cùng đội, chỉ với người chưa ghép được bằng số, chỉ khi trùng đúng một người (so có dấu, rồi không dấu). Danh sách ghép theo tên hiện ở `/du-lieu`. |
| 2026-11-12 | **Chấm bài (người chấm):** chỉ chấm **bài tuần** và **bài thi** (tiêu chí bài thi bổ sung sau), **không chấm bài ngày**. Bộ tiêu chí ở `docs/TIEU-CHI-CHAM.md`: tầng A chấm riêng từng video (A1–A4) và từng sơ đồ (A5); tầng B chấm chung cả tuần (B1–B6). Điểm tuần = 60% phần riêng + 40% (B1, B2); màu ≥4 / 3–3,9 / <3. Hạn chấm 3 ngày sau hạn nộp. |
| 2026-11-12 | **Admin giao đội** cho ban phụng sự, không cần coach duyệt. Học viên không vào trang chấm. Điểm chấm **không ảnh hưởng bảng xếp hạng**; cửa sổ chi tiết công khai chỉ hiện điểm sao và năng lực mạnh / yếu, không có tên người chấm, không có nhận xét chữ. |
| 2026-11-13 | **Chấm nhiều người:** giao đội **theo tuần, luân phiên** (bảng `grader_team_plans`; tuần không giao lại thì giữ như tuần trước). Nhiều người có thể chấm trùng đội; coach / BTC chấm bất kỳ. **Lưu mọi bản chấm** (`reviews_week`, `reviews_item`); điểm chính thức = **trung bình các bản**. Người chấm không thấy điểm người khác trước khi tự lưu. Bàn chấm đưa **"chưa ai chấm"** lên đầu. |
| 2026-11-13 | **Bảng xếp hạng đồng đội** (`/bang-xep-hang?xem=doi`): điểm đội = **trung bình điểm thành viên**, có ghi số thành viên. Thêm **5 danh hiệu tuần**, không cộng điểm: 🏆 dẫn đầu, 📈 tiến bộ nhất, 🤝 đồng đều nhất, ✅ chuyên cần, 💬 tương trợ. Chủ dự án nói "giữ theo hiện tại cho dễ hiểu"; PR #31 (ghi rõ danh hiệu không cộng điểm) đã đóng không gộp ngày 18/11. |
| 2026-11-18 | **Câu hỏi học viên → FAQ** (`/faq`, chỉ BTC / coach / admin). Nguồn: câu không bắt buộc của bài tuần "Bạn có khó khăn & câu hỏi gì đến BTC/Thầy?" và "03 điểm cần cải thiện" (`faq.sources`); bỏ câu không có nội dung. AI gộp câu trùng ý thành câu hỏi FAQ, kèm tóm tắt, chủ đề, mức độ **Cấp bách / Quan trọng / Thường**; **không gửi tên học viên cho AI**. Có hai phạm vi: từ đầu khóa và từng tuần. Chữ nhỏ ghi ai hỏi, đội, tuần; bấm vào thì mở câu gốc kèm link `/bai`. BTC soạn câu trả lời ở `/faq/dang`; câu "đăng công khai" hiện ở mục **Câu hỏi thường gặp** cuối `/bang-xep-hang`. Chủ dự án nói "admin đăng bài"; hiện admin, BTC và coach đều đăng được, chờ chủ dự án xác nhận. |

## [nskt-hub] Màn hình chiếu chấm chéo (lớp offline thứ Sáu) — hệ thống riêng, nskt-hub chỉ chuyển tiếp

**Là gì:** màn hình chiếu trong lớp offline thứ Sáu. Học viên chia nhóm ngẫu nhiên; một người trình bày, người khác đặt câu hỏi và chấm chéo. Màn hình chiếu người chấm → người được chấm kèm nhận xét **nguyên văn**. Là một **Worker riêng `nskt-cham-cheo-stage`** (không thuộc repo này, không có kho Git: mã chỉ có trên máy Admin-PC của chủ dự án), do ChatGPT làm trước đây. Luồng: mini-app `nskt2026.dh3g.vn/chamdiem` → Google Sheet `CHAM_CHEO_LOG` → Apps Script bridge (chỉ đọc) → Worker → màn hình. Bàn giao gốc: do chủ dự án cung cấp ngày 18/11 (không nằm trong repo).

**Quyết định 18/11 (chủ dự án chọn phương án B):** gắn vào cùng link nskt-hub bằng cách **chuyển tiếp**, không viết lại. `nskt-hub.hktruc.workers.dev/cham-cheo` hiện trang chính của trang cũ. Mã ở `src/chamcheo/proxy.ts` (danh sách trắng), kiểm thử `test/cham-cheo.test.ts`. Trang cũ và link cũ **giữ nguyên, không sửa**.
- Trang cũ dùng đường dẫn tuyệt đối từ gốc nên các đường dẫn sau được **dành riêng ở gốc nskt-hub**: `/index.html`, `/login`, `/sim23/<tệp>`, `/assets/roster.json`, `/api/session`, `/api/results` (GET), `/api/unlock` và `/api/logout` (POST). **Không đặt đường dẫn nskt-hub trùng các tên này.** Chuyển hướng về `/` của trang cũ được đổi thành `/cham-cheo`.
- **Cố ý không chuyển tiếp** `/api/insights` và `/plan.html`: trang cũ không dùng; `GET /api/insights` và `GET /api/results` của trang cũ có **ghi dữ liệu nội bộ vào D1 của nó** (không phải "chỉ đọc"). Không tự gọi hai đường này khi chỉ kiểm tra.
- Quyền xem do trang cũ quyết định: `/cham-cheo` mở như trang cũ (không cần đăng nhập nskt-hub); ô "Đăng nhập BTC" bên trong, cookie `nskt_stage` (12 giờ, `Path=/`) vẫn do trang cũ quản lý. Dữ liệu công khai theo phạm vi chủ dự án cho phép 30/10: tên, đội, cặp chấm, điểm, nhận xét trong ngày.
- POST đi qua nskt-hub vẫn bị kiểm tra `Origin` như mọi trang khác.
- **Claude không kiểm được trang thật**: máy của phiên không ra được `workers.dev`, khóa Cloudflare không xem được Worker đó. Kiểm thử dùng trang cũ giả. Sau khi triển khai chủ dự án phải tự thử (xem PR).
- Nếu Worker `nskt-cham-cheo-stage` bị đổi tên hoặc xóa, bản triển khai nskt-hub báo lỗi (bản đang chạy vẫn giữ); sửa `services` trong `wrangler.jsonc`.
- Chưa làm: đưa dữ liệu `CHAM_CHEO_LOG` (chấm chéo offline) vào báo cáo `/bao-cao` và danh hiệu tương trợ (file chưa chia sẻ cho tài khoản dịch vụ Google); phần AI phân loại góp ý của trang cũ (Workers AI, 5 điểm 0–2 chưa rõ ý nghĩa) **không** dùng trong nskt-hub.

## [nskt-hub] Màn hình chấm chéo bản mới `/cham-cheo-moi` (do chính nskt-hub làm, chạy song song bản cũ)

Chủ dự án chọn phương án A (18/11): xây lại màn hình chiếu chấm chéo thành bản chính chủ, **bản cũ `/cham-cheo` giữ nguyên** cho đến khi bản mới được thử ở lớp thật (khuyên thử buổi 27/11; buổi 20/11 vẫn dùng link cũ).
- **Giao diện** là tệp tĩnh `courses/nskt2026/public/cham-cheo-moi/` (JavaScript thuần: `logic.js` xử lý thuần có kiểm thử `test/cham-cheo-moi-logic.test.ts`, `stage.js` điều khiển, `api.js` nối máy chủ). Chủ dự án đã duyệt: hiển thị theo khối có sao (có thể chọn "Liền mạch"), phím tắt, thanh thời gian đọc, cỡ chữ, mức hiệu ứng, âm báo (mặc định tắt), độ mới dữ liệu, tự ẩn thanh điều khiển, QR lớn khi chưa có lượt, "Tổng quan" cho BTC (ai chưa chấm / chưa được chấm, kiểm nguồn).
- **Máy chủ** `src/chamcheo/live.ts` + hai đường dẫn ở `src/app.tsx`: `/cham-cheo-moi/api/phien` và `/cham-cheo-moi/api/ket-qua?ngay=`. **Chỉ đọc**, không ghi D1 hay bảng tính. Ai xem cũng được (như trang cũ); người đã đăng nhập nskt-hub (admin, BTC, coach) là "BTC": thấy nút Tổng quan, kiểm nguồn, người vắng.
- Nguồn: file Google Sheet "NSKT2026 - CHẤM CHÉO BÀI TẬP" (`SHEET_CHAMCHEO_ID` trong `wrangler.jsonc`, trang `CHAM_CHEO_LOG`; cột theo bản bàn giao cũ, **khoá nhận dạng ở cột Y "Khoá"**). Danh sách đội lấy từ trang CHECK_IN của file điểm danh. Kiểm tra đầu bảng: đổi cột thì dừng đọc và báo lỗi thay vì hiện sai. Đội của mỗi người lấy từ **mã người** (T01xx…), không từ cột Thôn, nên lượt liên đội không bị mất như bản cũ từng bị. Đệm 8 giây để nhiều máy cùng hỏi không làm nặng Google.
- **Chưa kiểm được trên bảng tính thật** (phiên không có khóa Google): file đang chia sẻ "ai có link đều xem" nhưng cần xác nhận tài khoản dịch vụ đọc được; lần đọc thật đầu tiên là sau khi gộp. Cần đối chiếu với màn hình cũ ở một buổi học: số lượt, đội nhận, "Buổi N" (đếm từ 02/10), người vắng.
- Còn chờ: ảnh QR chính thức (đặt tên `qr.png` vào thư mục giao diện); chủ dự án xác nhận mặc định công khai.

## [45n-hub] Quyết định của khóa 45N K02

Nguồn yêu cầu: phiếu của BTC 45N "Tieu chi XD dashboard HT45N K2" (Google Docs `1NvnKZc7ndLU30zBpZvJCMZFYYfvUKoJB0N6SOSDvZio`). Trọng tâm là **kỷ luật**: theo dõi 6 buổi Zoom, bài tập ngày và bài tập tuần, tổng hợp theo cá nhân, trưởng nhóm và 7 nhóm.

| Ngày | Quyết định |
|---|---|
| 2026-11-16 | Chỉ tính khóa **K02** (khai giảng 11/11/2026; K01 đã kết thúc 21/10 và không chia nhóm). 59 thành viên trong 7 nhóm "Nhóm N-K2". Nhóm "BTC" và "Mentor đồng hành" không tính, không xếp hạng. Tính từ ngày khai giảng; **buổi Zoom khai giảng 11/11 là buổi 1/6**. |
| 2026-11-16 | **Lỗi** (chủ dự án đồng ý cả 7 điểm đề xuất): bài ngày qua hạn mà không nộp = **lỗi nhẹ** (nộp bù sau hạn ghi "nộp trễ" nhưng không lỗi); bài tuần trễ hoặc không nộp = **lỗi nặng**; Zoom vào trễ, vắng, không bật camera = **lỗi nặng**; mục chưa tới hạn hoặc được BTC duyệt miễn thì không lỗi. **Lỗi nhẹ 1 điểm, lỗi nặng 3 điểm.** Xếp hạng nhóm theo **điểm lỗi trung bình mỗi thành viên đang tham gia** (ít hơn xếp trên), bằng nhau thì xét tỷ lệ nộp đúng hạn. "Đang tham gia" = trong 7 nhóm, trừ người BTC đánh dấu dừng. |
| 2026-11-16 | Vai trò **trưởng nhóm**: chỉ thấy nhóm mình; sau mỗi buổi Zoom báo ai không bật camera (dh3g không ghi nhận camera); viết **nhật ký nhóm hằng tuần** trên web thay file Excel (5 mục tự đặt, chưa có mẫu Excel thật). **BTC duyệt miễn** (bắt buộc ghi lý do) và **đánh dấu dừng tham gia**. |
| 2026-11-16 | Kế thừa từ NSKT: đăng nhập bằng số điện thoại, theo dõi nộp bài chi tiết (`/nop-bai`), đọc bài (`/bai`), cảnh báo trả lời đối phó (`/canh-bao`), trang dữ liệu, quản trị. Tắt: bảng xếp hạng điểm %, bàn chấm, AI chấm, báo cáo, điểm danh offline. |
| 2026-11-17 | Trang chủ tên **"Dashboard"**. Tên khóa hiển thị: **"45 Ngày Gắn kết & Nâng tầm đội ngũ"**. Logo hiện là chữ "45N" tạm, chờ logo thật. |
| 2026-11-17 | **Giờ điểm danh Zoom**: giờ bắt đầu tính điểm danh **20:00** (`zoomCheckinTime`), vào sau **20:15** là trễ (`zoomLateMinutes: 15`). dh3g ghi buổi bắt đầu 19:45 nhưng không dùng mốc đó. |
| 2026-11-17 | **Báo cáo camera có ba trạng thái** cho mỗi nhóm, mỗi buổi: ✗ **chưa báo cáo** (chưa tính lỗi camera, có cảnh báo); ✓ **tất cả bật cam** (trưởng nhóm phải bấm "Xác nhận: tất cả đều bật camera"); ✓ **N người không bật cam**. Hiện ở trang Zoom (cột "X/7 nhóm"), Dashboard, trang thành viên, trang nhóm. |
| 2026-11-17 | **BTC tự quản tài khoản trưởng nhóm** ở `/ky-luat/truong-nhom`: tạo tài khoản kèm nhóm, cấp lại mã, thu hồi / khôi phục, đổi nhóm. Chỉ tác động tài khoản trưởng nhóm; BTC, coach, admin vẫn chỉ admin tạo ở `/quan-tri`. |
| 2026-11-17 | Trưởng nhóm chỉ thấy số liệu nhóm mình ở mọi trang (kể cả bảng tổng hợp Zoom). Menu trưởng nhóm có 3 mục: Nhóm tôi, Zoom, Tài khoản. |
| 2026-11-17 | **Link công khai cho học viên** `45n-hub.hktruc.workers.dev/45ngaydonghanh` (`publicPath`; thay quyết định "không công khai" ngày 16/11). Không cần đăng nhập, **chỉ xem** 5 trang: Dashboard, Điểm danh Zoom, Bài tập, Nhóm, Từng thành viên (hiện đủ họ tên và lỗi từng người). Ẩn: lý do miễn, nội dung nhật ký nhóm, tên người báo cáo hay người duyệt, mọi nút thao tác. Link BTC giữ nguyên và phải đăng nhập; trang đăng nhập nhắc học viên dùng link công khai nhưng không ghi link. |

## Tiến độ

### [nskt-hub]

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| 0 | Nền: khung dự án, CLAUDE.md, kiểm thử, CI | Xong (11/11) |
| 1 | Lấy dữ liệu dh3g, trang "Tình trạng dữ liệu" `/du-lieu`, cron | Xong; chạy thật từ 12/11 |
| 2 | Theo dõi nộp bài `/nop-bai` | Xong (PR #3 → #5); 140 học viên, 12 đội |
| 3 | Đọc bài, sửa điểm tay, cảnh báo; đăng nhập số điện thoại; bàn chấm bài tuần `/cham` nhiều người chấm; năng lực người chấm | Xong (PR #9, #17, #18, #19, #29). Còn: tiêu chí bài thi |
| 4 | Chấm tự động (quy tắc + AI) và bảng xếp hạng công khai (cá nhân, đồng đội, danh hiệu, cửa sổ chi tiết) | Xong; AI đang chạy thật (5.855 câu đã chấm tính đến 18/11) |
| 5 | Báo cáo thống kê `/bao-cao` (toàn khóa, buổi offline HN/SG, bài ngày, bài tuần, bài thi, chấm chéo dh3g, từng học viên, người chấm) | Xong (PR #27, #28). Còn: chấm chéo offline (file chưa chia sẻ), định nghĩa "kỷ luật" |
| — | Điểm danh offline từ Google Sheet (50% điểm) | Chạy thật; 138/139 ghép được |
| — | Câu hỏi học viên → FAQ + FAQ công khai | Xong (PR #41, #42); lần chạy thật 18/11: 947 câu → 65 câu hỏi + 364 câu chưa xếp nhóm |
| 6 | Đưa vào dùng thật (tài khoản cho BTC, coach, phụng sự) | Chưa kiểm kê. Lần kiểm gần nhất (12/11) chỉ có 1 tài khoản; chủ dự án cần tự tạo tài khoản admin bằng số điện thoại và tài khoản cho coach / phụng sự |

### [45n-hub]

| Việc | Trạng thái |
|---|---|
| Hồ sơ khóa, bộ kỷ luật, trưởng nhóm, duyệt miễn (PR #33) | Xong |
| Worker, D1 châu Á, Access `/quan-tri`, Workers Builds (PR #34, #36) | Chạy thật từ 16–17/11 |
| BTC quản trưởng nhóm (#35), đổi tên Dashboard (#37), người đang đăng nhập (#38) | Xong |
| Camera ba trạng thái, Zoom 20:00 / trễ sau 20:15, trưởng nhóm chỉ thấy nhóm mình (#39) | Xong |
| Link công khai `/45ngaydonghanh` (#40) | Xong |
| Dữ liệu thật 17/11: 59 thành viên, buổi Zoom 11/11 có 51 đúng giờ / 0 trễ / 8 vắng | Đồng bộ tự động mỗi giờ |

## Bàn giao (cập nhật ở cuối mỗi đợt)

**Việc đang dở hoặc cần dọn:**
- [45n-hub] **Phiếu yêu cầu Google Docs chưa ghi được** đề xuất của Dev (Hồ Kháng Trực) và các câu hỏi cho BTC 45N, vì phiên chưa có connector **Google Docs** (chỉ có Google Drive để đọc). Chủ dự án muốn ghi vào phiếu: các đề xuất ghi rõ "đề xuất từ Dev, Hồ Kháng Trực", yêu cầu BTC 45N trả lời, báo các tính năng đã xây xong. Không ghi tính năng nào là "xong" khi chưa xong.
- [45n-hub] D1 cũ `45n-hub-db` (Bắc Mỹ) vẫn còn, không dùng. Chỉ xóa khi chủ dự án yêu cầu.
- [nskt-hub] 364/947 câu FAQ bị AI để "chưa xếp nhóm". Đã nhờ chủ dự án xem thử; nếu sót nhiều câu có vấn đề thật thì chỉnh lời nhắc AI trong `src/faq/ai.ts`.

**Đang chờ chủ dự án quyết:**
- [nskt-hub] Tiêu chí chấm **bài thi**. Duyệt **độ mờ dần (nửa đời 3 tuần)** và **ngưỡng vàng 50%**. **Định nghĩa "kỷ luật"**: bộ kỷ luật của 45N bật được cho NSKT bằng `features.discipline` khi đã chốt quy tắc. Buổi khai giảng 29/09 có tính điểm danh không (hiện không tính). Chỉ admin hay cả BTC / coach được đăng FAQ. Chia sẻ file chấm chéo offline cho tài khoản dịch vụ (tùy chọn).
- [45n-hub] BTC 45N xác nhận 7 điểm đề xuất (chủ dự án đã đồng ý); logo thật; mẫu Excel nhật ký nhóm (hiện dùng 5 mục tự đặt); có tính buổi khai giảng là buổi 1 không (hiện có tính).
- Cả hai khóa: **danh sách tính năng đề xuất 17/11**, chủ dự án chưa chọn. Thứ tự ưu tiên Claude gợi ý: (1) nhắc việc tự động qua Telegram (hoặc Zalo, cần hỏi kênh); (2) danh sách "nguy cơ bỏ cuộc" kèm ghi chăm sóc; (3) trang cho học viên tự xem và tự xin miễn; sau đó là bản tin tuần cho BTC, điều kiện tốt nghiệp và chứng nhận, khảo sát sau buổi, xuất Excel / PDF, so sánh giữa các khóa, tự báo sự cố, nhật ký thao tác, mở khóa mới bằng biểu mẫu.

- [nskt-hub] Sau khi gắn `/cham-cheo`: chủ dự án thử thật ở buổi học và báo kết quả; buổi 20/11 khuyên vẫn dùng link cũ. Còn chờ: hỏi chủ dự án có muốn đưa `CHAM_CHEO_LOG` vào báo cáo / danh hiệu tương trợ không (cần chia sẻ file cho tài khoản dịch vụ).

**Câu mở đầu gợi ý cho phiên mới (chủ dự án dán):** "Đọc kỹ CLAUDE.md và docs/KHOA-HOC-MOI.md, xem 5 PR gần nhất trên GitHub. Tóm tắt cho tôi tình trạng hiện tại của [nskt-hub] và [45n-hub] trước khi làm việc mới. Không bắt đầu sửa gì khi tôi chưa duyệt."

## Quy tắc điểm [nskt-hub] (chủ dự án mô tả 2026-11-11)

Chỉ tính các bài có hạn nộp **sau 29/09/2026**.

**Bài tập ngày** (dh3g loại `NORMAL`, 4 câu; nhãn có sẵn trong câu hỏi):
- Câu "(bắt buộc) (X1)": trả lời = **1 điểm**.
- Câu "(khuyến khích) (X3)": có **video** = **3 điểm**; không có video nhưng là chữ có **đúc kết sâu sắc** = **1 điểm** (AI đánh giá); còn lại 0.

**Bài tập tuần** (dh3g loại `WEEK`, tiêu đề có "(X10)"; câu hỏi đổi theo tuần nên AI đọc cả câu hỏi lẫn câu trả lời):
- Câu yêu cầu nộp video: **mỗi video 10 điểm**.
- Câu bắt buộc khác: trả lời liên quan, có trách nhiệm, sâu sắc = **3 điểm**.
- Câu góp ý cho BTC (không bắt buộc: "điểm tốt cần phát huy", "điểm cần cải thiện", "hành động đóng góp", "khó khăn & câu hỏi"): **1 điểm mỗi câu**. Hai câu "khó khăn & câu hỏi" và "điểm cần cải thiện" cũng là nguồn của trang FAQ.

**Cảnh báo trả lời đối phó**: vài chữ cái, ký hiệu vô nghĩa, gõ đại → ghim cảnh báo cho BTC (chỉ BTC thấy).

**Cách tính đang dùng** (Claude đề xuất, chủ dự án chưa duyệt; mọi con số ở `courses/nskt2026/course.ts` → `scoring`):
- Điểm là **% so với điểm tối đa có thể đạt**, cùng độ mờ, để tuần nhiều bài hay ít bài vẫn so sánh công bằng.
- Mờ dần theo **nửa đời 3 tuần**: điểm của 3 tuần trước tính một nửa, 6 tuần trước tính một phần tư.
- Màu: **Xanh ≥ 80%** (đã chốt), **Vàng 50–79%**, **Đỏ < 50%**. Ngưỡng tuyệt đối, không theo thứ hạng.
- Đồng điểm: nhiều buổi đi học đúng giờ hơn, rồi nhiều video đúng hạn hơn, rồi trung bình nộp video sớm hơn hạn nhiều giờ hơn thì xếp trên.
- Cấu trúc bài tuần suy ra từ dữ liệu nộp: câu mà ≥ 50% người nộp có video là câu video; số video tối đa = mức mà 75% người nộp đạt.
- AI chấm là **gợi ý**. BTC sửa tay từng câu ở `/bai` (bảng `score_overrides`); điểm sửa tay ưu tiên hơn AI.
- Chỉ xếp hạng học viên thuộc 12 đội.

## Quy tắc kỷ luật [45n-hub] (mã `src/discipline/engine.ts`, con số ở `courses/45n-k2/course.ts` → `discipline`)

- Trạng thái bài: đúng hạn / nộp trễ / không nộp (qua hạn mà chưa nộp) / chưa tới hạn / được miễn / đã dừng. Bài `NORMAL` là bài ngày; `WEEK` và `EXAM` tính như bài tuần.
- Zoom: có mặt đúng giờ / vào trễ (giờ vào > `zoomCheckinTime` + `zoomLateMinutes`) / vắng / chưa diễn ra / được miễn / đã dừng. Giờ vào lấy từ `attendances.attended_at` của dh3g.
- Camera: chỉ xét người có mặt. Bật / không bật / chưa có báo cáo (nhóm chưa báo cáo, bảng `team_reports` kind `camera`). Chưa báo cáo thì không tính lỗi.
- Tuần hành trình: tuần 1 bắt đầu từ `discipline.startDate` (11/11), tổng 6 tuần. Nhật ký nhóm lưu theo tuần hành trình.
- Bảng: `zoom_camera`, `team_reports`, `discipline_exemptions`, `learner_status` (migration 0010).

## Nguồn dữ liệu

### dh3g (chung)
- Bài nộp: `GET https://api.dh3g.vn/hkm-api/public/report/cohort-submissions?communityId=…&fromDate=…&toDate=…&includeAnswers=true` (lọc theo **hạn nộp**, tối đa 62 ngày). Điểm danh: `…/cohort-attendance`. Khóa gửi trong tiêu đề `X-API-KEY`.
- **Thời gian dh3g là giờ Việt Nam, không ghi múi giờ** (ví dụ `2026-11-07T23:00:00`, giờ vào Zoom có phần lẻ giây `…:58:21.34666`). Không được coi là UTC.
- Mỗi lần gọi trả về **đủ mọi thành viên của cộng đồng** và một dòng cho mỗi bài trong khoảng ngày, kể cả bài chưa nộp.
- Trạng thái: `DONE` = nộp trước hạn; `OVERDUE` ("Nộp trễ") và `LATE` (hiếm) = **đã nộp nhưng sau hạn**; `NOT_SUBMITTED` = chưa nộp, gồm cả bài chưa tới hạn.
- Câu trả lời nằm trong `answers` dạng mảng `{question, answer, type…}`. Link video / ảnh nằm trong câu tự luận: YouTube, Facebook, TikTok, Google Drive; tệp tải thẳng lên dh3g có dạng `s3.sunteco.app`. `mediaCount` của dh3g không đáng tin, nên ứng dụng tự đếm từ link.
- `feedbacks` là học viên chấm chéo nhau, điểm `grade` thang 0–100.

### [nskt-hub] cộng đồng 44
- Khoảng 185 thành viên trong cộng đồng, chỉ 140 học viên thuộc 12 đội được tính. Mỗi tuần có bài ngày (NORMAL), bài tuần (WEEK, "(X10)") và có bài thi (EXAM). Hạn nộp thường 23:00.
- dh3g **chưa có buổi học nào** trong `cohort-attendance`; điểm danh của NSKT lấy từ Google Sheet.

### [45n-hub] cộng đồng 47 ("45N Gắn kết&Nâng tầm đội ngũ")
- Có hai khóa trong cùng cộng đồng: K01 (courseId 87, 16/09–21/10, không chia nhóm) và **K02** (courseId 96, từ 11/11). 143 thành viên; 59 người trong 7 nhóm K2; nhóm "BTC" và "Mentor đồng hành" có 4 người mỗi nhóm.
- Bài K02: mỗi bài **một câu tự luận**, đề dặn trả lời bằng chữ, không có câu video. Bài ngày ("thử thách ngày N") và bài tuần ("TUẦN 1-1", "TUẦN 1-2"…), hạn nộp 23:30 (có bài 18:00).
- **dh3g có điểm danh Zoom thật**: `sessions` (giờ bắt đầu / kết thúc) và `attendances` (`attended`, `attendedAt`).

### [nskt-hub] Google Sheet
- **Điểm danh offline** (`CHECK_IN`): mỗi dòng một học viên (Mã Thôn, Mã Cư Dân, họ tên, khu vực), mỗi cột một buổi (KHAI GIANG, rồi các thứ Sáu). Ký hiệu: ✅ đúng giờ đúng chỗ, X đúng giờ sai vị trí, ⚠️ không có vị trí, M muộn, M1 muộn + sai vị trí, P nghỉ có phép, PD (chưa rõ), ❌ vắng. Khu vực tách đầu HN (Hà Nội + Miền Bắc) và đầu SG (HCM + Miền Nam).
- **Đã tích hợp** (`src/attendance/offline.ts`, đọc qua `src/google/sheets.ts`): mỗi giờ hoặc khi bấm nút ở `/du-lieu`. Mỗi lần thay toàn bộ bảng `offline_attendance`; nhật ký ở `sheet_syncs` (chỉ lưu Mã Cư Dân chưa ghép được). Cột "KHAI GIANG" không có ngày nên không tính.
- **Chấm chéo offline** (`CHAM_CHEO_LOG`): chưa tích hợp vì file chưa được chia sẻ. Có dòng thử của BTC (mã `BTC..`, thôn `TEST`) phải loại; mã đợt chưa thống nhất.

## Cách đồng bộ dh3g hoạt động

- Bảng `sync_jobs` vừa là hàng đợi vừa là nhật ký: mỗi dòng là một lần gọi dh3g cho một khoảng ngày.
- Cron `15 0 * * *` (07:15 giờ VN): xếp việc cho các bài có hạn từ 14 ngày trước đến 7 ngày tới. Lần đầu tiên và mỗi thứ Hai thì xếp toàn bộ từ `SYNC_START_DATE`.
- Cron `*/5 * * * *`: xử lý tối đa 3 việc, ngày mới nhất trước. Lượt đầu mỗi giờ thêm các việc sau: xếp bài đang mở (`planHourly`, 2 ngày trước → 7 ngày tới; khóa có `discipline` thì lấy cả điểm danh Zoom), đọc Google Sheet (nếu bật `attendance`), FAQ tự kiểm tra câu mới (nếu bật `faq`). Sau đó chấm điểm: dựng cấu trúc câu hỏi, gửi AI tối đa 40 bài nộp, tính lại điểm thay đổi. FAQ chạy lần biên tập đang chờ ngay trong lượt.
- Không có khóa dh3g thì không gọi dh3g. Lỗi tạm thời thử lại tối đa 3 lần; khóa bị từ chối (401/403) hoặc bị giới hạn (429) thì dừng lượt, việc vẫn nằm trong hàng đợi.
- Muốn lấy lại toàn bộ ngay: nút ở `/du-lieu`, hoặc chèn dòng `sync_jobs` (`status='pending'`) qua API D1.
- Mỗi cặp (học viên, bài tập) là một dòng trong `submissions`; câu trả lời, nhận xét, lịch sử sửa lưu dạng JSON trong dòng đó. `changed_at` chỉ đổi khi nội dung thật sự khác; `answers_hash` để biết bài đã bị sửa sau khi chấm. Bản gốc nén của lần gọi mới nhất nằm ở `raw_responses` / `raw_chunks`.

## AI (OpenAI)

- **Chấm câu** ([nskt-hub], `src/ai/openai.ts`, `src/scoring/run.ts`): đạt / không đạt / đối phó, kèm ghi chú ngắn. Bảng `ai_reviews`.
- **FAQ** ([nskt-hub], `src/faq/`): **gộp hai bước**, vì gửi cả nghìn câu một lần thì gpt-5-nano chỉ chia ra 2 nhóm. Bước 1 chia thành từng phần 80 câu, chạy 4 phần song song, mỗi nhóm là một vấn đề cụ thể. Bước 2 nối các nhóm trùng vấn đề, với `reasoning_effort: "low"`. AI chạy nền trong cron (bảng `faq_runs`: pending → running → done / failed; `faq_groups`), tránh trang chờ lâu. Tự biên tập lại khoảng 1 lần mỗi ngày khi có câu mới, cho cả phạm vi từ đầu khóa và tuần mới nhất. Câu AI không xếp nhóm được gom vào nhóm "chưa xếp" để BTC vẫn đọc được.
- Không gửi họ tên, số điện thoại, email cho AI. Khóa chỉ đi trong tiêu đề `Authorization`, không ghi vào nhật ký.

## Bảo mật và vai trò

- **Đăng nhập nội bộ** (`src/users/accounts.ts`): số điện thoại + mật khẩu (PBKDF2-SHA256 100.000 vòng), kích hoạt bằng mã một lần 8 ký tự (lưu dạng băm, hết hạn 7 ngày). Cookie phiên `nskt_s` (HttpOnly, Secure, SameSite=Lax, 30 ngày), chỉ lưu băm SHA-256 trong `user_sessions`. Sai 5 lần thì khóa 15 phút. Cấp mã mới hoặc thu hồi thì hủy mọi phiên. Thao tác ghi (POST) kiểm tra tiêu đề `Origin`.
- **Vai trò**: `admin` (vào được `/quan-tri`, tạo mọi tài khoản), `btc`, `coach` (toàn quyền nội bộ trừ `/quan-tri`), `phung_su` ([nskt-hub], chỉ `/cham` và `/tai-khoan`, chỉ đội được giao theo tuần), `truong_nhom` ([45n-hub], chỉ nhóm mình: `/ky-luat/nhom`, `/ky-luat/zoom`, `/ky-luat/hv`, `/tai-khoan`). Ai được giao đội / nhóm thì lưu ở `grader_team_plans`.
- **Trang công khai**: [nskt-hub] `/bang-xep-hang` và `/bang-xep-hang/hv/<mã>` (hạng, họ tên, đội, %, màu, điểm theo tuần, thứ hạng các tuần, mục FAQ đã đăng); [45n-hub] `/45ngaydonghanh/*` (5 trang chỉ xem). Không hiện số điện thoại, email, cảnh báo, nội dung bài, lý do miễn, nhật ký nhóm, tên người chấm hay người duyệt. Có header `noindex`.
- Mọi trang nội bộ cần đăng nhập số điện thoại, hoặc mã Cloudflare Access hợp lệ (ứng dụng tự kiểm tra chữ ký và AUD, `src/auth.ts`). Chưa đăng nhập thì hiện trang "Cần đăng nhập" (mã 401 hoặc 503).
- `LOCAL_DEV_NO_AUTH=true` chỉ có tác dụng trên localhost, chỉ đặt trong `.dev.vars` (không commit; xóa sau khi chạy thử).

## Lệnh

```bash
npm install
npm run check   # kiểm tra kiểu + kiểm thử hai khóa (vitest.config.ts, vitest.45n.config.ts) + đóng gói thử hai bản
npm test        # chỉ kiểm thử
```

**Kiểm tra triển khai sau khi chủ dự án gộp** (cả hai worker phải success):
```bash
H=$(git rev-parse HEAD); gh api repos/hktruc/nskt-hub/commits/$H/check-runs --jq '[.check_runs[]|.name+"="+(.conclusion//.status)]|join(", ")'
```

**Chạy migration lên D1 thật** (trước khi chủ dự án gộp PR có migration mới):
```bash
# NSKT: qua API D1, rồi ghi tên vào d1_migrations
curl -s -X POST https://api.cloudflare.com/client/v4/accounts/6cf1ac5bfc7c2176ed31399545ce50db/d1/database/66754a8e-7e74-4f88-aea9-bbd4c75b65fd/query \
  -H "Authorization: Bearer x" -H "Content-Type: application/json" -d @<tệp JSON {"sql": "..."}>
# 45N: qua wrangler
CLOUDFLARE_API_TOKEN=x CLOUDFLARE_ACCOUNT_ID=6cf1ac5bfc7c2176ed31399545ce50db npx wrangler d1 migrations apply 45n-hub-db-apac --remote -c courses/45n-k2/wrangler.jsonc
```
Truy vấn D1 thật cũng dùng API trên (D1 của 45N có mã `2456ef6b-75b2-415f-a212-4313f92cf770`). Chỉ đọc số lượng, không in dữ liệu cá nhân.

**Chạy thử trên máy:**
- NSKT: `npx wrangler dev` (cần `.dev.vars` và `npx wrangler d1 migrations apply nskt-hub-db --local`).
- 45N: `npx wrangler dev -c courses/45n-k2/wrangler.jsonc --port 8788 --persist-to <scratchpad>/state45`, với `.dev.vars` đặt trong `courses/45n-k2/`. Dùng `--persist-to` trong scratchpad để dữ liệu thật không nằm trong repo.
- **workerd trên máy của phiên không ra được internet** (không phân giải được tên miền), nên đồng bộ dh3g trên máy không chạy. Muốn có dữ liệu thật để chạy thử: tải bằng `curl` về scratchpad, rồi nạp bằng `parseSubmissions` / `storeSubmissions` qua một tệp vitest tạm trong scratchpad, chép sang SQLite của wrangler bằng `ATTACH`.
- Chụp màn hình: Playwright có sẵn (`require('playwright')`), giả lập `devices['iPhone 13']`. Ảnh để trong scratchpad.

## Cấu trúc

- `src/index.tsx`: điểm vào của worker (trang web và cron). `src/app.tsx`: mọi đường dẫn, kiểm tra đăng nhập, gắn "người đang đăng nhập" vào đầu trang. `src/layout.tsx`: khung trang, menu (theo vai trò và tính năng), CSS, biểu tượng.
- `src/course/`: kiểu hồ sơ khóa, `featureOn`, `featureOfPath`. `courses/<mã>/`: hồ sơ, ảnh, cấu hình Cloudflare của từng khóa.
- `src/auth.ts`: kiểm tra Cloudflare Access. `src/users/accounts.ts`: tài khoản, phiên, vai trò, giao đội / nhóm.
- `src/dh3g/`: gọi dh3g (`client`), đọc phản hồi (`parse`), ghi D1 (`store`). `src/sync/queue.ts`: hàng đợi đồng bộ.
- `src/scoring/`: quy tắc điểm (`config`, `spec`, `rules`), chạy định kỳ (`run`), bảng xếp hạng (`leaderboard`), danh hiệu đội (`team-awards`).
- `src/ai/openai.ts`: AI chấm câu. `src/faq/`: lấy câu hỏi (`collect`), AI gộp hai bước (`ai`), hàng đợi và câu trả lời công khai (`store`).
- `src/grading/`: bàn chấm (`store`), tiêu chí (`rubric`), năng lực người chấm (`stats`). `src/reports/data.ts`: số liệu báo cáo.
- `src/discipline/`: lõi tính lỗi, không phụ thuộc giao diện (`engine`); đọc và ghi D1 (`data`).
- `src/google/sheets.ts`: đọc Google Sheet bằng tài khoản dịch vụ. `src/attendance/offline.ts`: điểm danh offline.
- `src/domain/`: `media.ts` (phát hiện video, ảnh, tệp), `teams.ts` (tên đội dh3g → T01…; số đội theo hồ sơ khóa).
- `src/pages/`: `overview`, `submissions`, `submission-detail`, `flags`, `data-status`, `grading`, `graders`, `reports`, `leaderboard`, `account`, `admin` (NSKT và chung); `discipline`, `leaders` (45N); `faq` (NSKT).
- `migrations/`: cấu trúc D1, chỉ thêm tệp mới (0001–0011).
- `test/`: kiểm thử với hồ sơ NSKT. `test/45n/`: kiểm thử với hồ sơ 45N (`vitest.45n.config.ts`). `test/helpers/d1.ts` giả lập D1 bằng SQLite của Node; `test/helpers/fixtures.ts` giả lập dh3g. AI luôn dùng bản giả trong kiểm thử.
- `docs/KHOA-HOC-MOI.md`: thêm khóa mới, Workers Builds. `docs/TRIEN-KHAI.md`: lịch sử triển khai NSKT, nối Google Sheet. `docs/THIET-KE.md`: hệ thống giao diện. `docs/TIEU-CHI-CHAM.md`: tiêu chí chấm bài tuần NSKT. `docs/anh/`: ảnh giao diện bằng dữ liệu giả.

## Cách làm các việc thường gặp

- **Thêm tính năng cho một khóa:** viết ở `src/` như tính năng chung, thêm khóa trong `Feature` (`src/course/types.ts`), bật ở hồ sơ khóa cần dùng và tắt ở khóa kia. Nếu có trang riêng thì thêm đường dẫn vào `featureOfPath`. Thêm kiểm thử vào `test/` (hồ sơ NSKT) hoặc `test/45n/` (hồ sơ 45N).
- **Thêm khóa mới:** theo `docs/KHOA-HOC-MOI.md`. Claude tạo D1 (APAC), chạy migrations, tạo Access cho `/quan-tri`, ghi cấu hình; chủ dự án tạo Workers Builds và nhập secret.
- **Đổi quy tắc hoặc con số** (giờ Zoom, điểm lỗi, ngưỡng màu…): sửa hồ sơ khóa, cập nhật bảng quyết định của khóa đó trong tệp này, kiểm thử lại.
- **Thêm bảng dữ liệu:** thêm migration mới, chạy lên D1 của cả hai khóa trước khi gộp, cập nhật dòng "Migration đã chạy" ở Bản đồ hệ thống.
- **Kết thúc mỗi đợt:** cập nhật bảng Quyết định, Tiến độ và Bàn giao trong tệp này, ngay trong PR của đợt đó.
