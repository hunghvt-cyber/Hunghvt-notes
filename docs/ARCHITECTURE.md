# Kiến trúc hiện tại

Vercel API → Koofr WebDAV. Trình duyệt không được nhận mật khẩu Koofr.
`api/preview.js` dùng session HttpOnly/Secure, kiểm tra Origin cho mutation,
giới hạn đăng nhập bền trong catalog và trả no-store. Share là capability được
băm trong catalog; mọi lần đọc/ghi share đều kiểm tra quyền sống, kể cả sau retry.

Mỗi Note có file revision JSON bất biến: title/text/checklist/folder/pinned/history.
Catalog giữ HEAD/hash/revision, folder, tombstone, ACL và receipts của operation.
Catalog là điểm commit duy nhất; revision mồ côi không được hiển thị.
Workspace đa người dùng độc lập chưa được mô hình hóa; đây không phải bản thay
thế production đầy đủ.

Koofr từng không thực thi If-Match/If-None-Match như CAS mong đợi. Mọi thao tác
store phải qua root collection LOCK Depth:infinity, kiểm revision trong lock,
PUT kèm lock token và xác minh kết quả. Không cho client ghi WebDAV trực tiếp.
Mỗi phiên dùng một socket tuần tự; không tăng maxSockets khi chưa kiểm chứng lại.
Lock toàn catalog gây tuần tự hóa: BUSY 423 phải retry có giới hạn, không ghi đè.

Receipt gắn operation ID với payload/base/actor, tối đa 24 receipt trong catalog.
Retry sau timeout dùng cùng clientOpId và baseRevision. Base cũ nhận conflict,
không tự ghi đè. UUID được hỗ trợ bên cạnh các slot số phục vụ fixture cũ.
Thu hồi quyền được kiểm trước replay. Giao diện tối thiểu giữ nháp/pending operation
trong IndexedDB; xem RELEASE.md cho trạng thái phát hành và giới hạn.

Restore dùng snapshot hash + source epoch trong reservation marker và catalog.
Ghi revision, kiểm hash, cuối cùng đổi HEAD trong lock. Retry init không reset
tiến trình hoặc sửa lại các Note đã khôi phục. Chunk muộn bị từ chối.
MKCOL có kết quả không rõ trước khi tạo marker: fail closed, tạo target mới;
không tự nhận quyền sở hữu thư mục đã tồn tại.

## Giới hạn và việc còn thiếu

- Catalog giới hạn ghi 240 KB / đọc 256 KB; payload Note 1 MB; export backup 2 MB.
- Tìm kiếm toàn văn chưa có. UI tìm trong tiêu đề/đoạn xem trước và giữ nháp,
  hiển thị conflict; chưa có app-shell offline hoặc chứng nhận Safari thật.
- Global lock có thể gây nghẽn; cần đo lại nhiều phiên sau khi tách repo.
- Deep validation catalog lỗi, backup độc lập có retention, GC orphan chưa hoàn thiện.
- Share-create chưa có receipt idempotency; mất response có thể tạo link thừa,
  cần liệt kê/thu hồi trước khi dùng thật.
- Logs hiện là metadata từng request/operation, không log nội dung hoặc secret.
  Chưa có kho log bền độc lập hoặc cảnh báo tự động.
- Không xem các kiểm thử hiện có là chứng nhận production-ready.
