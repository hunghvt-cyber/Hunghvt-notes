# Notes vận hành — 28/10/2026

## Hiện hành
Theo báo cáo Codex NAS và hồ sơ cutover được chuyển về repo này:
- Repo GitHub canonical: `hunghvt-cyber/web-notes` (ID `1423348828`); tên `Hunghvt-notes` cũ chuyển hướng. Remote `main` được đọc trực tiếp ở `4f95351c9846dab43f85b839a11ea0be2ed81a08`.
- URL https://hunghvt-notes.vercel.app
- Backend Firestore: notes-lab-56f0f / (default) / notes-production.
- Deployment tại cutover: dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1.
- Source đã xác minh được hợp nhất từ branch codex/notes-production-cutover-20261027, commit 97c84e74d2e21ceb3a72b36dd16e6d9505a8e742, deployed tree ab169c6bd440f228a3f521fc4357b7bddf2eadec. Vercel vẫn không liên kết Git; push `main` không đổi deployment.
- 28 notes tại cutover: 6 active, 22 trash; 2 folder, 11 share, 24 receipt, 0 erased tombstone. Full parity fingerprint nằm trong [hồ sơ cutover](history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- Giữ namespace/session và auth Homepage; không dùng Blob hoặc Koofr làm backend ghi Notes mới. Chưa có bằng chứng người dùng xác nhận phiên trình duyệt thật, hoặc GitHub OIDC Code Inbox thật sau cutover.
- Checkpoint Production vẫn là deployment `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; công việc backup không thay alias hoặc deployment.

## Backup
Người dùng đã duyệt backup GitHub Actions 03:30 VN → Koofr private, 14 daily + 8 weekly + 6 monthly. Xem [nhiệm vụ backup và cleanup đã duyệt](BACKUP-AND-LEGACY-CLEANUP-20261027.md).
Candidate local đã xác minh là `186479392acf793caf628831075d98405231562b`, tree `04f3183c5b29165014985d1b992c88e2ef0d0c73`; test offline 187/187 đạt trước cập nhật claim canonical. Push HTTPS chưa chạy được vì không có credential local; chưa kết luận thiếu quyền tài khoản. Workflow đang được cập nhật về canonical claim; WIF attribute condition và IAM binding live chưa đối chiếu được. Candidate chưa ở default branch; chưa có Actions run, Koofr readback hoặc restore qualification mới. Cần secret Koofr riêng `NOTES_BACKUP_KOOFR_CREDENTIAL`. Không dọn legacy trước đủ gate. Xem [runbook](NOTES-BACKUP-RUNBOOK.md).

## Cleanup
Dọn kho cũ và các đường ghi/deployment đã thay thế chỉ sau backup upload/readback/hash + restore parity PASS. Chưa xóa namespace Koofr hoặc runtime/domain cũ. Không xóa Firestore hiện hành, thùng rác hay draft. Kho backup mới và baseline trước cutover nằm ngoài retention. Kiểm tra domain phụ trong hồ sơ cutover, không để nó tiếp tục ghi vào Koofr cũ.

## Bằng chứng và cập nhật
Mọi thay đổi Notes được ghi ở repo này. ai-nas-lab chỉ giữ thông tin phối hợp Codex/Gemini và công cụ AI.
Luôn phân biệt dữ liệu đọc trực tiếp với báo cáo từ NAS, test fixture, cloud smoke và deployment hiện hành. Kiểm tra metadata trước khi dựa vào checkpoint cũ.
