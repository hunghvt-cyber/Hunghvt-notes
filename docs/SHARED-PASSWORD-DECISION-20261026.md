# Notes — quyết định dùng chung nguồn mật khẩu

Ngày 26/10/2026, người dùng đã đồng ý để **Homepage quản lý mật khẩu chung**, Notes xác thực qua dịch vụ Homepage, giữ session secret/cookie riêng. Đổi mật khẩu chung sẽ thu hồi phiên cũ của cả hai ứng dụng; cách revalidate version và thời gian thu hồi cần thiết kế/kiểm thử. **Chưa làm SSO.** Không thêm GAS/database/dịch vụ mới.

**Trạng thái: đã duyệt hướng làm, CHƯA TRIỂN KHAI.** NOTES_PASSWORD vẫn là nguồn mật khẩu Notes hiện tại. Đợt này chỉ sửa tài liệu, không đổi code/secret/dữ liệu hoặc cấu hình xác thực.

Nguồn quyết định đầy đủ: [Homepage — Shared Password Decision](https://github.com/hunghvt-cyber/Homepage-nas/blob/main/docs/SHARED-PASSWORD-DECISION-20261026.md).

Khi triển khai sau: giữ bản nháp, CAS/khóa/ACL và dữ liệu Koofr; xác thực server-to-server có giới hạn thử, không log mật khẩu, không chia sẻ session secret, không fallback âm thầm sang mật khẩu cũ. Phân biệt mật khẩu không khớp và phiên hết hạn trong UI. Code Inbox GitHub OIDC tiếp tục độc lập. Không triển khai chỉ dựa vào chữ “đã duyệt” trong tài liệu này; đối chiếu code/config hiện tại và phạm vi yêu cầu tiếp theo.
