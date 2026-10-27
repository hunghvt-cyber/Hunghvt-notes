# Hunghvt Notes

For the native Firestore backend implementation, guarded runtime selection,
NAS/Vercel authentication, migration comparison, backup/restore and rollback, see
[docs/FIRESTORE-NATIVE.md](docs/FIRESTORE-NATIVE.md). The isolated cloud smoke
runner is documented in [docs/FIRESTORE-CLOUD-SMOKE.md](docs/FIRESTORE-CLOUD-SMOKE.md).
Koofr remains the active backend until a separately reviewed migration.

Ứng dụng ghi chú độc lập: **https://hunghvt-notes.vercel.app/**.
Dữ liệu lưu trên **Koofr WebDAV**, ứng dụng chạy trên **Vercel**.
Nhánh phát hành là **`release/minimal-notes`**, không tự suy đoán `main` là production.


## Kết nối code vào Notes — 26/10/2026

Đã triển khai [Code Inbox](docs/CODE-INBOX.md): GitHub OIDC ngắn hạn + envelope mã hóa, chỉ tạo/cập nhật hai ghi chú code managed trong thư mục **Code từ GitHub**, giữ CAS/khóa/idempotency. Không cần mật khẩu UI cho tác vụ này. PR #14, runtime source `a258ffc5`, production `dpl_2rdgnmV8TFDZp6HvzaaumLrFMHF7` READY. Live export code v2 đã xác nhận lưu/hash khớp. Không thay đổi kết nối GAS/NAS hoặc dữ liệu ghi chú cũ. Chi tiết checkpoint cũ bên dưới là lịch sử trước inbox.

## Trạng thái đã đối chiếu — 22/10/2026

- Alias production **READY**, source `09bf7dd4a955d715680b2a7cf758705b04be9875`, nhánh `release/minimal-notes`.
- Deployment `dpl_7Fv3KcsC2HYJCMBsS1Joct2rpGXL`, project `hunghvt-notes`, region `fra1`.
- Lần này chỉ đọc metadata/source, không xác minh ghi/sao chép/thu hồi trên Notes thật.
- [Trạng thái phát hành và bàn giao hiện tại](docs/RELEASE.md).
- [Chi tiết triển khai ngày 20/10](docs/RELEASE-20261020.md).

Đây là mốc production đã đối chiếu qua Vercel; commit tài liệu mới hơn không có
nghĩa mã ứng dụng mới đã được triển khai. Repo không tự động gắn với production.
Không đưa secret, Notes thật, backup riêng tư hoặc cấu hình tài khoản vào GitHub.
Homepage Notes cũ đã nghỉ; Notes hiện tại không dùng Blob và không chạy trên NAS.

## Nguồn mật khẩu chung — đã triển khai 26/10/2026

Homepage quản lý/đổi mật khẩu chung; Notes xác thực qua Homepage, giữ phiên riêng (chưa SSO). Dùng mật khẩu Homepage hiện tại để mở Notes. [Cấu hình và bằng chứng triển khai](docs/SHARED-PASSWORD-DECISION-20261026.md).

## Tính năng hiện tại

- Note, checklist, ghim, thư mục, lịch sử; copy, xóa nội dung và hoàn tác.
- Chia sẻ note/thư mục để xem hoặc sửa, không tự hết hạn; có thu hồi link.
- Dấu 🔗 ở thư mục có link, quản lý/copy lại link; [chi tiết và bằng chứng](docs/SHARE-LINK-COPY-20261020.md). Trang được chia sẻ ẩn link về Homepage theo source PR #13.
- Sắp xếp cập nhật mới/cũ, tiêu đề A–Z/Z–A hoặc tùy chỉnh bằng Lên/Xuống.
- Chọn nhiều, **Chọn tất cả**, **Bỏ chọn tất cả**; di chuyển theo nhóm.
  Chọn tất cả áp dụng cho danh sách trong thư mục/kết quả tìm kiếm hiện tại.
- Thùng rác riêng, tìm cả nội dung/checklist, xem chỉ đọc và **Khôi phục đã chọn**.
- **Xóa vĩnh viễn đã chọn** chỉ trong Thùng rác, cần xác nhận. Xóa gián đoạn có
  thể tiếp tục; không tự xóa Notes thật để kiểm thử. Bản backup cũ và cơ chế lưu
  rác riêng của Koofr không bị nút này xóa theo.
- Tải backup JSON; chưa được coi là backup có thể phục hồi nếu chưa kiểm chứng riêng.

Khôi phục đưa note về thư mục cũ nếu còn, nếu không về Chưa phân loại; link chia sẻ
riêng của note bị thu hồi. Di chuyển nhóm kiểm tra revision của toàn nhóm và chặn
nếu có nội dung chưa đồng bộ; không tự ghi đè xung đột.

## Tốc độ, đồng bộ và nội dung chưa lưu

Danh sách/đoạn xem trước được hiện từ cache sau xác thực rồi đối chiếu máy chủ.
Nội dung đầy đủ đã mở chỉ giữ trong bộ nhớ phiên; không có chế độ Thiết bị riêng.
Trang chia sẻ không có cache nội dung lâu dài. Cache không thay thế backup hoặc CAS.

Trong mỗi tab, lượt lưu được ưu tiên trước lượt đọc đang chờ, rồi đến tải nền.
Yêu cầu GET trùng được gộp trong lúc đang chạy. Tải nền bỏ qua lúc bận, ẩn tab hoặc
ngoại tuyến; không tạo chuỗi retry dài. Link chia sẻ vẫn kiểm tra quyền trên máy chủ,
khi quay lại tab và theo nhịp nền khoảng 60–70 giây. Khi đang soạn/lưu, dùng kiểm
tra quyền gọn thay vì tải lại toàn bộ nội dung. Danh sách link chia sẻ của chủ chỉ
tải khi mở mục Chia sẻ Note.

Lượt đọc/lưu chính có retry lệch nhịp, cửa sổ khoảng 120 giây, tối đa 32 lần thử.
Lưu chỉ gửi lại đúng operation ID/payload/revision đã giữ, không ghi đè vô điều kiện.
Trạng thái ngắn: **Đang lưu / Đã lưu / Chưa đồng bộ**. Chỉ báo Đã lưu sau xác nhận
phù hợp từ máy chủ. Bảng khôi phục không tự bung; nút ẩn khi không có nội dung chờ.
Dữ liệu chưa đồng bộ vẫn được giữ trong IndexedDB riêng, không tự xóa bản nháp cũ.

Koofr vẫn là nguồn dữ liệu chính. Khóa toàn kho vẫn là điểm tranh chấp giữa nhiều
phiên; chưa xác nhận tải thực tế 10 người sửa + 50 người đọc. Thời gian khoảng
40 giây từng báo là mô phỏng dồn tải, không phải số đo Koofr/Vercel thật.

## Kiểm chứng và công cụ

Node.js 24:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:browser
node scripts/retry-load.mjs --patient
```

Browser suite cần Chromium (`npx playwright install chromium`). Các lệnh trên dùng
fixture/WebDAV giả, không phải phép đo tải production. CI tự chạy khi push/PR.

Mốc `1f1f763` đạt 127 kiểm thử Node, 17 mô phỏng tải và 11 kịch bản trình duyệt.
Các follow-up hiệu năng/xóa rác ban đầu được kiểm tra cú pháp/diff theo yêu cầu
người dùng dừng benchmark. Các đợt chia sẻ sau đó có CI riêng: hồ sơ copy link
20/10 ghi 133 Node và 13 Chromium fixture scenarios tại source feature `28cf4ef`.
[Bằng chứng và phạm vi](docs/SHARE-LINK-COPY-20261020.md). Không dùng bất kỳ mốc
CI cũ nào để chứng nhận toàn bộ source `09bf7dd`, tải Koofr thật hay Safari/iPad.
Không chạy benchmark hoặc xóa Notes thật khi chỉ cập nhật tài liệu.

## Tài liệu và phạm vi

- [Quy tắc bảo trì cho AI](AGENTS.md).
- [Kiến trúc](docs/ARCHITECTURE.md), [triển khai](docs/DEPLOYMENT.md), [bằng chứng kiểm thử](docs/TESTING.md).
- [Phân tích hiệu năng](docs/PERFORMANCE-20261019.md), [retry và loading](docs/PERFORMANCE-STEP4-PATIENT-20261020.md).
- [Hồ sơ phát hành hiện tại](docs/RELEASE.md) ưu tiên hơn tài liệu lab/lịch sử khi xác định production.

`lib/` chứa lưu trữ/ACL/khóa/backup; `api/app.js` là API live; `public/` là giao diện;
`test/` và `scripts/` chứa fixture/công cụ có ranh giới namespace. `api/preview.js`
và `api/bench.js` không được trỏ vào kho production để thử nghiệm.

Bảo trì repo này không bao gồm Homepage, NAS, Tapo, báo cáo GAS/Drive, Supabase,
Gemini, chi tiêu hoặc kho backup. Không dùng cấu hình rclone/backup để lấy credential.
