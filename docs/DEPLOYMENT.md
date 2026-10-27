# Triển khai thử và rollback

**Trạng thái production và hướng dẫn hiện hành:** xem [RELEASE.md](RELEASE.md).
Phần dưới là hồ sơ triển khai thử ngày 17–18/10/2026, không phải quy trình
phát hành hiện hành.
Project live mới là hunghvt-notes, không phải lab bên dưới. Các hướng dẫn dưới
đây giữ lại cho benchmark synthetic và không được dùng để trỏ Preview vào root thật.

**Bổ sung 2026-10-27:** Vercel Preview hiện đã được deploy trực tiếp từ checkout
đã xác minh, không liên kết Git. Preview OIDC tới GCP và Notes tổng hợp đã chạy
thành công; điều đó không cấu hình hay xác nhận Production. Xem
[FIRESTORE-NATIVE.md](FIRESTORE-NATIVE.md).

## Trạng thái an toàn sau khi tách

Đợt kiểm thử trên nhánh `split/notes-standalone` có workflow riêng
`notes-preview-qualify.yml`: chỉ push vào đúng nhánh này với marker `[notes-live]`,
dùng hai URL preview được pin trong workflow và secrets Koofr riêng.
OIDC khóa đúng nhánh/event/file workflow. Không cần merge main để kiểm thử.
Endpoint fixture tự hết hạn lúc 10:00 ngày 18/10/2026 giờ Việt Nam.
Artifact public chỉ chứa số liệu tổng hợp đã lọc, không có raw report/account config.
Đường manual main dưới đây dành cho giai đoạn sau khi review.

Chỉ tách mã, không chuyển production. Chưa nối repo mới với Vercel Git integration.
Không import repo backup hay secret rclone. Không cài lịch chạy nền.

Preview API mặc định đóng nếu thiếu cấu hình. Adapter hiện khóa theo dedicated
lab project ID trong `lib/preview-api.mjs`; không đổi thành project Homepage.
Fixture có hạn tuyệt đối `2026-10-18T03:00:00Z` trong `api/bench.js`, sau đó trả 410.
Không kéo dài vô hạn. Trước đợt live mới phải review và đặt cửa sổ thử nghiệm mới.

## Chuẩn bị một lần trên iPad, khi cần live test

1. Vào Settings → Secrets and variables → Actions của [**web-notes**](https://github.com/hunghvt-cyber/web-notes).
2. Tạo repository secrets `KOOFR_WEBDAV_USER` và `KOOFR_WEBDAV_APP_PASSWORD`.
   Dùng app password WebDAV riêng trong Koofr, không dùng mật khẩu đăng nhập
   và không gửi chúng vào chat. Không sao chép `RCLONE_CONFIG_CONTENT`.
3. Review/merge PR riêng khi đã đồng ý; workflow live chỉ nhận manual dispatch
   trên main, không chạy trên PR/fork/push. Chưa được merge trong đợt tách này.
4. Deploy mã đã review lên dedicated Vercel lab, Preview target, không gắn domain
   Homepage. Cần hai deployment độc lập cùng source SHA cho suite reliability.
5. Đặt Actions variables: `NOTES_PREVIEW_URL`, `NOTES_SECOND_PREVIEW_URL`,
   `NOTES_DEPLOYED_SHA` và sau cùng `NOTES_LIVE_ENABLED=synthetic-only-v1`.
   URL là origin immutable `https://homepage-koofr-<deployment>-hunghvt.vercel.app`,
   không có dấu `/` cuối. Không dùng URL cũ sau khi đổi danh tính OIDC.
6. Run workflow “Notes synthetic live qualification”, chọn suite và nhập
   `SYNTHETIC_ONLY`. Mỗi suite tự tạo root mới theo run ID, không đụng backup.

Danh tính OIDC khóa owner ID `252749231`, repo ID `1423348828`, main,
event workflow_dispatch và đúng file notes-live.yml (hoặc nhánh/workflow thử
nghiệm giới hạn như mô tả ở đầu tài liệu). Repo mới dùng immutable subject:
`repo:hunghvt-cyber@252749231/web-notes@1423348828:ref:<ref>`.
Tham khảo [GitHub OIDC immutable subject](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims).
Workflow dùng repository secrets, không environment context
(đổi environment làm thay subject và phải review OIDC). Ai có quyền write repo
có thể sửa code/workflow: chỉ cấp quyền cho người tin cậy, bảo vệ main trước live.
CI không cần secret vẫn chạy trước khi làm các bước trên.

## API preview riêng

Dùng `.env.preview.example` làm tên cấu hình, nhập trực tiếp trong Preview env
của dedicated lab khi thực sự cần mở API. Chọn chính xác namespace giả lập được
qualification chuẩn bị. Không thêm secrets vào Production hay repo. Header share
Bearer chỉ dành cho capability của Note/folder, không phải credential Koofr.

### Owner read experiment (chưa triển khai)

Nhánh `codex/notes-owner-open-experiment-20261027` thêm telemetry metadata và
biến thể owner-only `ownerReadVariant=single-lease-v1`. Mặc định là
`two-snapshot-v1`; Preview cần bật `NOTES_OWNER_READ_EXPERIMENT=enabled` rõ ràng.
Handler production từ chối selector này kể cả khi biến môi trường bị promote.
Shared read không đọc selector và tiếp tục dùng hai snapshot.

Chỉ dùng Vercel Preview trong dedicated lab project với biến
`NOTES_PREVIEW_ENABLED=synthetic-only-v1`, `VERCEL_ENV=preview`, và
`KOOFR_NOTES_NAMESPACE=Homepage-Notes-Vercel-Probe-<run>-<uuid>` mới. Namespace
hiện để trống trong `.env.preview.example`; chưa tạo namespace hay file Koofr.
Không nhập config này vào Production, Homepage, Home-AI hoặc app password backup.

API observer chỉ ghi route/status/reference/phase duration; provider-auth calls
add auth timing (operation, elapsed, whether provider call returned, numeric
error status), while owner note-open requests add WebDAV sequence/label/method/status/
elapsed/DNS/TCP/TLS/headers/body/reused-socket metadata. Không ghi URL, path,
headers, body, response text, note ID, cookie hay raw error. Client wall time đo
request/retry tổng; không cần trả chi tiết từng WebDAV call trong response.

Preview dùng mật khẩu tổng hợp riêng và **không gọi Homepage auth**. Do đó nó
không thể đo thời gian `passwordProvider.current()` thật. Code đo Homepage
`version`/`verify` trong live handler đã có, nhưng muốn lấy số thật cần một nguồn
Homepage-auth tổng hợp riêng được duyệt hoặc một lần triển khai telemetry production
được cho phép sau review; không dùng service key Production trong Preview.

Chưa đủ cấu hình để chạy phép đo thật: cần quyền deploy vào dedicated Vercel lab
Preview và xác nhận project target; Preview-only session/password, Koofr WebDAV
app credential riêng, cùng namespace synthetic mới được cấp khi bắt đầu thử.
Không cần thay hoặc đọc credential Production/backup. Trước khi tạo dữ liệu
Koofr, review lại thời gian tồn tại và cách dọn synthetic fixture.

## Backup, khôi phục và rollback

Export snapshot chứa hash/source epoch; dưới giới hạn 2 MB. Giữ snapshot ở vị trí
riêng, mã hóa và kiểm tra đọc được. Chưa có lịch backup độc lập/retention tự động.
Test restore vào root hoàn toàn mới, kiểm đủ IDs/hash/tombstones/ACL; không restore
đè root cũ. Không có thao tác tự động xóa root hoặc dữ liệu backup.

Để dừng thử nghiệm: xóa variable NOTES_LIVE_ENABLED, tắt NOTES_PREVIEW_ENABLED,
revoke app password riêng nếu cần, và bỏ/rollback dedicated preview. Homepage
production không cần rollback vì chưa bị thay đổi. Nếu sau này tích hợp frontend,
cần kế hoạch cutover/rollback và phê duyệt mới trước khi đụng dữ liệu thật.
