# Notes — dùng chung nguồn mật khẩu Homepage
**ĐÃ TRIỂN KHAI PRODUCTION ngày 26/10/2026.**

Notes dùng mật khẩu Homepage hiện tại, qua service xác thực server-to-server; người dùng vẫn mở khóa riêng trên mỗi trang, không SSO. NOTES_AUTH_MODE=homepage-v1; NOTES_PASSWORD cũ không dùng trong mode này, không fallback tự động. Cookie/session secret Notes vẫn riêng.

Phiên owner Notes kiểm tra password version Homepage mỗi request; đổi pass tại Homepage làm phiên cũ bị từ chối ở lần kiểm tra tiếp theo. Shared links và Code Inbox không phụ thuộc nguồn mật khẩu owner. Bản nháp/CAS/ACL/khóa/dữ liệu Koofr giữ nguyên.

[Chi tiết cấu hình, rollback và bằng chứng](https://github.com/hunghvt-cyber/Homepage-nas/blob/main/docs/SHARED-PASSWORD-DECISION-20261026.md).

Source Notes 0c8c0761c2625ae2be747e448a7259f974dccb34; deployment dpl_EESNjsEpJkd2N7V45rkJ28mn3kwf READY. Local 139 Node PASS; CI Node/Chromium 40287414406 success trước sửa URL canonical. Live GET auth qua nguồn Homepage trả 200/authenticated:false; chưa nhập/đổi mật khẩu người dùng để nghiệm thu live. Không làm SSO hoặc thay mật khẩu hiện tại.
