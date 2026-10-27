# Quy tắc tiếp quản Hunghvt Notes

- Đọc README.md và docs/OPERATIONS.md trước. Source production đã kiểm chứng từ checkpoint 27/10/2026 được hợp nhất vào main; Vercel không liên kết Git nên push main không tự deploy. Luôn đối chiếu deployment riêng.
- Người dùng đã đồng ý chuyển Firestore và đã báo cáo hoàn tất cutover. Các quy tắc cũ “Koofr là backend chính/không database” đã được quyết định mới thay thế; các guard bảo toàn dữ liệu vẫn phải giữ.
- Nhiệm vụ tiếp theo được người dùng duyệt: docs/BACKUP-AND-LEGACY-CLEANUP-20261027.md. Hoàn thành code/CI/WIF/backup/restore và dọn exact legacy targets sau qualification; không hỏi lại quyền đã được giao.
- Giữ Firestore current data, history, trash, drafts, revision CAS, operation idempotency, sharing/revocation, namespace/session và Code Inbox. Không đổi mật khẩu/session hoặc xóa credential còn dùng.
- Repo công khai: không commit Notes thật, snapshot, credential, raw provider response hoặc private logs. Không upload snapshot thành GitHub artifact.
- Backup runner chỉ đọc Firestore, dùng GitHub OIDC/WIF riêng và credential Koofr riêng. Restore qualification dùng danh tính one-off riêng, không cấp workflow read-only quyền ghi chỉ để test.
- Retention chỉ quản lý prefix backup riêng sau upload/download/hash verify; không xóa baseline cutover, backup khác hoặc dữ liệu Tapo/Photos/Drive/Homepage.
- Legacy cleanup phải chứng minh không còn writer/dependency, backup mới + restore PASS. Không diễn giải “dọn Notes cũ” thành purge trash/old dates trên Firestore.
- Giữ namespace Koofr cũ cho tới khi đã vượt gate backup/restore; sau khi dọn, sửa hướng dẫn rollback cho phù hợp, không giữ hướng dẫn dựa vào baseline catalog đã bị xóa.
- Không force-push, reset/clean worktree bẩn hoặc phục hồi source từ output bị cắt. Đối chiếu Git tree/blob của bản chạy test và bản push.
- Codex NAS tự phối hợp Gemini tư vấn/phản biện (mặc định tối đa 2 lượt mỗi nhiệm vụ); không gửi secret/Notes/snapshot. Gemini không chạy tool hay sửa file. Không giả lập kết quả khi API lỗi.
- Mọi thông tin vận hành Notes và bằng chứng lưu tại repo này; ai-nas-lab chỉ chứa công cụ/quy trình/bài học AI dùng lại. NAS vận hành chung đưa về repo NAS phù hợp.
- Tạm file/worktree/dependency lớn trên NAS ưu tiên /vol1 sau khi kiểm mount/quyền; không cài thêm vào root khi không cần. Bulk lệnh người dùng chạy trên NAS bọc /home/admin/bin/copyout, ngoại trừ nhập credential tương tác.
- Không tự bật billing. Phân biệt fixture, cloud smoke, Actions run, scheduled run và kiểm chứng trên thiết bị người dùng.

## Trạng thái source sau khi hợp nhất

- Source ứng dụng Firestore đã kiểm chứng từ `codex/notes-production-cutover-20261027` được đưa vào `main`; thao tác Git không tự deploy Vercel vì project không liên kết Git.
- Lịch sử release cũ về Koofr/Blob trong tài liệu là lịch sử; Production hiện dùng Firestore, còn kho Koofr cũ chỉ giữ cho tới khi backup/restore qualification và cleanup được chứng minh.
- Workflow backup chỉ đọc Firestore; không thay credential sản phẩm, không log snapshot, không upload artifact GitHub. Mọi thao tác restore dùng identity tách biệt và vault thử exact.
- Canonical GitHub repo là `hunghvt-cyber/web-notes` (ID `1423348828`); tên cũ redirect. Candidate đã xác minh: `186479392acf793caf628831075d98405231562b`, tree `04f3183c5b29165014985d1b992c88e2ef0d0c73`; bộ offline test 187/187 đạt trước chỉnh claim canonical. Push local đang thiếu credential, không suy ra thiếu quyền tài khoản. Kiểm tra WIF/IAM thực tế và backup secret còn là gate trước khi chạy Actions.
