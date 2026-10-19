# Hunghvt Notes

Project Notes độc lập có bản giao diện tối thiểu và backend Koofr.
Production Notes độc lập: https://hunghvt-notes.vercel.app/ (backend Koofr). Không đưa dữ liệu thật vào GitHub.
Xem [hồ sơ phát hành](docs/RELEASE.md).

Notes cũ tại Homepage đã nghỉ hoạt động; không dùng Blob làm backend Notes hiện hành. Repo này không chứa báo cáo NAS,
backup Actions, cấu hình Google/rclone hay dữ liệu Notes thật; không kết nối tự động
với deployment production. Không chuyển repo backup thành public.

## Chạy kiểm thử

Node.js 24:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Các test trên dùng backend WebDAV giả lập, không gọi Koofr hay Google.
CI tự chạy trên push/PR, runner chuẩn ubuntu-24.04, không cần secret.

Hiện có 90 tests mô phỏng và 6 tình huống Chromium thực. Chạy browser suite:
`npx playwright install chromium` rồi `npm run test:browser`. Kết quả phân biệt
rõ với các bài live Koofr tại docs/results.

Live qualification ngày 17/10/2026 đã đạt: 100 Notes, 51 stages, restore 104
records đúng byte; reliability đạt 13 lỗi transport và 100 cặp ghi đồng thời
qua hai preview. [Bằng chứng và giới hạn phép đo](docs/TESTING.md).
Đạt các gate backend này để tiếp tục tích hợp UI Preview; chưa production-ready.

## Cấu trúc

- `lib/`: Note, checklist, folder, ACL, revision, chống ghi đè và restore.
- `api/app.js`: API live, khóa project/namespace/origin, mặc định đóng khi thiếu secret.
- `api/preview.js`: owner/share API thử nghiệm, mặc định đóng.
- `api/bench.js`: fixture qua GitHub OIDC, chỉ namespace giả lập của run đó.
- `test/`: CRUD, concurrent writers, thu hồi, hết hạn lock, lỗi mạng và restore.
- `scripts/`: hai suite thật qua Vercel; không có endpoint mặc định.
- `public/`: giao diện Notes, IndexedDB drafts và engine đồng bộ có idempotency.
- [Kiến trúc và rủi ro](docs/ARCHITECTURE.md).
- [Triển khai thử, secrets, backup và rollback](docs/DEPLOYMENT.md).
- [Bằng chứng và giới hạn kiểm thử](docs/TESTING.md).
- [Ý tưởng sắp xếp bằng phím mũi tên](docs/NOTES-IDEAS.md).

## Phạm vi lần tách repo

Mã backend được chọn lọc từ prototype riêng trước đó, source commit
`8e4d4af37de24cd30bc6b6603593626299ca5c3c`. Đây là lịch sử Git mới,
không import lịch sử, secret hoặc artifacts của repo backup. Giữ 74 test của lab,
bổ sung test ranh giới repo, driver, nháp/giao diện và lọc bằng chứng; danh tính OIDC được kiểm
theo định dạng immutable có owner/repository ID dành cho repo mới.
Không mang 11 test conformance cũ phụ thuộc parser cấu hình backup sang đây.

Mã phát hành dùng nhánh release/minimal-notes và project Vercel hunghvt-notes
riêng. Kho mới đã được khởi tạo trống; cấu hình tài khoản và smoke test production
còn phải hoàn tất. Workflow benchmark vẫn chỉ chạy với marker, có hạn thử nghiệm.

## Bàn giao giao diện Notes (19/10/2026)

- Nguồn phát hành: nhánh `release/minimal-notes`, production `https://hunghvt-notes.vercel.app/`. `main` không được tự suy đoán là nguồn production; xác minh Vercel trước khi công bố phát hành.
- PR #3: chọn nhiều Note, chọn tất cả Note đang hiển thị, xóa hàng loạt sau xác nhận; kiểm tra `revision` từng Note và bỏ qua xung đột. Trước khi xóa, chặn toàn bộ nếu bất kỳ Note được chọn có bản nháp lưu cục bộ; không tự xóa nháp. Nút Làm mới bị loại bỏ; đồng bộ nền vẫn chạy. Tải backup JSON nằm trong mục Sao lưu. Trạng thái/loading dính ở đầu màn hình khi cuộn.
- Xóa hàng loạt là thao tác thay đổi dữ liệu thật **chỉ khi người dùng bấm xác nhận**; CI/smoke không được gọi xóa trên Koofr production. Luôn kiểm tra quyền truy cập, bản nháp, xung đột và kết quả từng Note.
- CI `Notes simulation` chạy trên dữ liệu giả; CI xanh không đồng nghĩa Vercel đã triển khai. Sau merge cần đối chiếu commit production, kiểm tra UI và smoke không phá hủy dữ liệu.
- Không chỉnh NAS, Homepage, GAS, Supabase, Tapo, backup hoặc kho Notes thật khi bảo trì giao diện.

### Tải nhanh và dữ liệu trên thiết bị

Danh sách và thư mục được đọc từ cùng một catalog dưới một khóa WebDAV. Sau khi xác thực đúng kho, ứng dụng hiện danh sách đã lưu trên thiết bị rồi đồng bộ máy chủ. Tiêu đề, đoạn xem trước và thư mục có thể tồn tại trong IndexedDB của trình duyệt sau khi khóa ứng dụng.

Không có lựa chọn chế độ thiết bị. Nội dung Notes đã mở chỉ được giữ trong bộ nhớ của phiên, tự kiểm tra revision khi mở lại; không ghi thêm nội dung đầy đủ vào cache lâu dài. Cache nội dung từ phiên bản cũ được giữ nguyên nhưng không dùng. Bản nháp vẫn được lưu trên thiết bị để phục hồi. Cache không phải backup, không thay thế xác nhận lưu của máy chủ. Khóa ứng dụng không mã hóa dữ liệu trong hồ sơ trình duyệt; người có quyền truy cập hồ sơ thiết bị có thể đọc cache và bản nháp.

Trang chia sẻ không dùng cache lâu dài; quyền được kiểm tra lại trên máy chủ. Thu hồi link không thể xóa nội dung người nhận đã đọc hoặc sao chép; trang đang mở kiểm tra lại khi quay về tab và mỗi phút. Chưa có bằng chứng đáp ứng 100 người đồng thời. Xem `docs/PERFORMANCE-20261019.md`.

### Thùng rác

Thùng rác là mục riêng trong danh sách thư mục. Tìm kiếm trong mục này gồm tiêu đề, nội dung đầy đủ, checklist và tên thư mục gốc. Tick một hoặc nhiều Note rồi bấm **Khôi phục đã chọn**. Có thể mở nội dung chỉ đọc trước khi khôi phục. Note trở về thư mục cũ nếu còn, nếu không về Chưa phân loại. Link chia sẻ riêng của Note bị thu hồi khi khôi phục; tạo link mới khi cần. Không xóa vĩnh viễn hoặc tự dọn rác.
