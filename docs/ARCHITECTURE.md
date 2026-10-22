# Kiến trúc hiện tại

Vercel API → Koofr WebDAV. Trình duyệt không được nhận mật khẩu Koofr.
`api/app.js` dùng session HttpOnly/Secure, kiểm tra Origin cho mutation,
giới hạn đăng nhập bền trong catalog và trả no-store. Share là capability được
băm trong catalog; mọi lần đọc/ghi share đều kiểm tra quyền sống, kể cả sau retry.

Mỗi Note có file revision JSON bất biến: title/text/checklist/folder/pinned/history.
Catalog giữ HEAD/hash/revision, folder, tombstone, ACL và receipts của operation.
Catalog là điểm commit duy nhất; revision mồ côi không được hiển thị.
Ứng dụng đã chạy production; trạng thái và giới hạn kiểm chứng hiện hành xem
[RELEASE.md](RELEASE.md). Workspace đa người dùng độc lập chưa được mô hình hóa.

Koofr từng không thực thi If-Match/If-None-Match như CAS mong đợi. Catalog/ACL và
commit vẫn được bảo vệ bằng root collection LOCK Depth:infinity, kiểm revision
trong lock, PUT kèm lock token và xác minh kết quả. Đọc nội dung revision bất biến
được đưa ra ngoài khoảng giữ khóa; sau đó lấy khóa lại để kiểm quyền, epoch và
HEAD/hash trước khi trả nội dung. Không cho client ghi WebDAV trực tiếp.
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
- Tìm kiếm danh sách dùng tiêu đề/đoạn xem trước; thùng rác có tìm nội dung và
  checklist. UI giữ nháp, hiển thị conflict; chưa có app-shell offline hoặc
  chứng nhận Safari/iPad thật cho bản mới nhất.
- Global lock vẫn có thể gây nghẽn; chưa chứng minh sức tải thật 10 người sửa
  và 50 người đọc. Số liệu tải giả lập nằm trong RELEASE.md.
- Deep validation catalog lỗi, backup độc lập có retention, GC orphan chưa hoàn thiện.
- Share-create chưa có receipt idempotency; mất response có thể tạo link thừa,
  cần liệt kê/thu hồi trước khi dùng thật.
- Logs hiện là metadata từng request/operation, không log nội dung hoặc secret.
  Chưa có kho log bền độc lập hoặc cảnh báo tự động.
- Không xem các kiểm thử hiện có là chứng nhận production-ready.

## Ưu tiên giao diện và xóa vĩnh viễn

Mỗi tab xếp yêu cầu ghi trước đọc, rồi đến tác vụ nền; yêu cầu đang chạy không
bị ngắt. GET trùng đang chạy được gộp. Tác vụ nền bỏ qua khi bận/ẩn/offline,
không retry; foreground có retry hữu hạn. Đây không phải hàng đợi chung giữa
các tab hay giữa người dùng. Mỗi lần đọc/ghi share vẫn kiểm quyền sống.

Xóa vĩnh viễn phải có xác nhận. Server ghi và xác minh journal trong catalog,
thu hồi link Note, rồi xóa file theo lô có thể tiếp tục sau lỗi. Chỉ báo hoàn tất
khi cleanup và catalog đã được xác minh; marker ngăn replay cũ làm sống lại Note.
Không xóa bản backup đã xuất hoặc cam kết xóa retention riêng của nhà cung cấp.
