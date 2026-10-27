# Copy lại link chia sẻ — 20/10/2026

- Bảng quản lý link cho thư mục và Note hiển thị ô link readonly và nút Sao chép. Link mới lấy lại được sau reload/phiên mới từ API owner, không cần tạo thêm link mỗi lần chia sẻ.
- Link cũ chỉ lưu tokenHash: vẫn hoạt động, không thể đảo hash để lấy nguyên link. Dòng đó có Tạo link mới; giữ nguyên quyền view/edit, không tự thu hồi link cũ. Mỗi link vẫn thu hồi riêng.
- Lưu thêm tokenBox AES-256-GCM cho link tạo qua API từ bản này. Khóa dẫn xuất từ NOTES_SESSION_PASSWORD (preview: PREVIEW_SESSION_PASSWORD), ràng buộc account/namespace; AAD ràng buộc scope/target/id. Không thêm cấu hình hoặc secret mới. TokenHash tiếp tục là cơ chế xác thực link.
- Chỉ API note-share đã xác thực owner giải mã để trả token. Không đưa tokenBox vào API trả cho client; không đưa token hoặc bản mã vào bootstrap, shared responses hay logs. Không persist link vào IndexedDB. Khi khóa/hết phiên, xóa các ô và danh sách link khỏi DOM. Thu hồi xóa tokenBox khỏi catalog hiện tại; backup lịch sử không bị sửa.
- Giữ ổn định NOTES_SESSION_PASSWORD nếu muốn tiếp tục copy các link đã tạo. Nếu thay khóa hoặc bản mã không đọc được, link vẫn xác thực theo hash, giao diện chuyển sang Tạo link mới. Bản mã không chứa khóa giải mã; snapshot có thể chứa bản mã lịch sử. Restore vẫn thu hồi các link theo cơ chế hiện hữu.
- 133 Node tests đạt trên source local: vòng đời owner/private/revoke, không lộ token plaintext trong catalog/log/bootstrap/shared response, bind account/namespace/scope/target/id, sai khóa/bản mã hỏng từ chối giải mã, legacy link và quyền replacement. Thêm Chromium scenario cho mở lại sau reload, bấm copy và thu hồi. Đây là fixture WebDAV, không ghi vào Notes production để thử.

## Production đã xác minh

- Source: `5602dce65c3d1731cb9edb77a8fa2763cc3b7732` (merge PR #11).
- Deployment: `dpl_FEgBfxasivp3gkhZpLmzMYUZUS4w`, READY tại https://hunghvt-notes.vercel.app/.
- CI: https://github.com/hunghvt-cyber/web-notes/actions/runs/39395676858 — test và browser thành công trên source `28cf4efeb94f648cbaee4102aae08d6556ffb389`: 133 Node tests, 13 Chromium scenarios (clipboard dùng stub xác định, backend WebDAV giả).
- Smoke chỉ đọc: `/`, `/app.js`, `/api/app?route=health` HTTP 200; mã UI có các control copy; API note-share không có phiên owner trả 401. Không tạo, đọc hay thu hồi link của dữ liệu production để thử.
- Quét error/fatal cho deployment mới chưa thấy bản ghi tại thời điểm kiểm tra. Đây không phải chứng nhận thao tác thực tế trên iPad/Koofr.
- Commit tài liệu ghi mốc này không phải source deployment.
