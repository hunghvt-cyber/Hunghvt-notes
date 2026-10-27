# Sửa chia sẻ thư mục trống — 20/10/2026

Nguồn production kiểm tra trước sửa: d76f9311298ad8aa37c3734075df834c66227e36, deployment dpl_F8xk96jagGqj1gwTFFAXBrJei6Gx, alias https://hunghvt-notes.vercel.app/.

Tạo link thư mục đã tồn tại nhưng chưa có Note đang hoạt động trả 404 SHARE_TARGET_MISSING. Bỏ điều kiện phải có Note; vẫn yêu cầu owner và thư mục tồn tại trong catalog, giữ nguyên khóa, quyền view/edit và thu hồi. Không tự tạo thư mục, Note hay lưu bản nháp khi chia sẻ.

Kiểm thử hồi quy HTTP tái hiện 404 trước sửa và đạt sau sửa: mở thư mục trống, tạo Note đúng phạm vi, từ chối người chỉ xem/di chuyển ra ngoài, chặn xóa thư mục đang chia sẻ, thu hồi chặn đọc và lưu lại, từ chối thư mục thiếu/đã xóa. Cập nhật fixture cũ và kiểm tra link nhận đúng thành viên sau di chuyển. npm test: 128/128 đạt; git diff --check đạt. Đây là mô phỏng WebDAV, không phải bằng chứng thao tác trên Koofr thật. Không ghi vào dữ liệu Notes production để thử.
