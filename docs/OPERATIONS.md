# Notes vận hành — 27/10/2026

## Hiện hành
Theo báo cáo Codex NAS và hồ sơ cutover được chuyển về repo này:
- URL https://hunghvt-notes.vercel.app
- Backend Firestore: notes-lab-56f0f / (default) / notes-production.
- Deployment tại cutover: dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1.
- Source đã báo cáo: branch codex/notes-production-cutover-20261027, commit 97c84e74d2e21ceb3a72b36dd16e6d9505a8e742, deployed tree ab169c6bd440f228a3f521fc4357b7bddf2eadec.
- 28 notes tại cutover: 6 active, 22 trash; 2 folder, 11 share, 24 receipt, 0 erased tombstone. Full parity fingerprint nằm trong [hồ sơ cutover](history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- Giữ namespace/session và auth Homepage; không dùng Blob hoặc Koofr làm backend ghi Notes mới. Chưa có bằng chứng người dùng xác nhận phiên trình duyệt thật, hoặc GitHub OIDC Code Inbox thật sau cutover.
- main hiện được bổ sung tài liệu vận hành; chưa tự hợp nhất toàn bộ source từ nhánh cutover. Không dùng main như source production cho tới khi đối chiếu tree và hợp nhất có kiểm tra. Việc sửa docs này không deploy.

## Backup
Người dùng đã duyệt backup GitHub Actions 03:30 VN → Koofr private, 14 daily + 8 weekly + 6 monthly. Xem [nhiệm vụ backup và cleanup đã duyệt](BACKUP-AND-LEGACY-CLEANUP-20261027.md).
**Chưa triển khai/xác minh lịch backup tự động trong lượt sắp xếp tài liệu này.** Snapshot chuyển đổi cũ không phải backup của các chỉnh sửa mới.

## Cleanup
Dọn kho cũ và các đường ghi/deployment đã thay thế sau backup upload/readback/hash + restore parity PASS. Không xóa Firestore hiện hành, thùng rác hay draft. Kho backup mới và baseline trước cutover nằm ngoài phạm vi xóa. Kiểm tra domain phụ trong hồ sơ cutover, không để nó tiếp tục ghi vào Koofr cũ.

## Bằng chứng và cập nhật
Mọi thay đổi Notes được ghi ở repo này. ai-nas-lab chỉ giữ thông tin phối hợp Codex/Gemini và công cụ AI.
Luôn phân biệt dữ liệu đọc trực tiếp với báo cáo từ NAS, test fixture, cloud smoke và deployment hiện hành. Kiểm tra metadata trước khi dựa vào checkpoint cũ.
