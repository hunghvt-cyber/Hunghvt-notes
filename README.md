# Hunghvt Notes

Ứng dụng Notes tại **https://hunghvt-notes.vercel.app/**. Giao diện tự thiết kế; backend Production đã chuyển sang Firestore theo hồ sơ cutover ngày 27/10/2026.

- [Vận hành và trạng thái hiện tại](docs/OPERATIONS.md).
- [Backup định kỳ và dọn hệ thống cũ — phạm vi đã duyệt](docs/BACKUP-AND-LEGACY-CLEANUP-20261027.md).
- [Bằng chứng cutover và parity](docs/history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- [Firestore native repository](docs/FIRESTORE-NATIVE.md), [Code Inbox](docs/CODE-INBOX.md), [kiểm thử](docs/TESTING.md), [chi tiết backup/restore](docs/NOTES-BACKUP-RUNBOOK.md).
- [Lịch sử nghiên cứu/bàn giao đã chuyển từ ai-nas-lab](docs/history/ai-nas-lab/README.md).
- [Quy tắc tiếp quản](AGENTS.md).

## Source và triển khai

Repo canonical là [`hunghvt-cyber/web-notes`](https://github.com/hunghvt-cyber/web-notes), repository ID `1423348828`; tên cũ `Hunghvt-notes` chuyển hướng. `main` tại `4f95351c9846dab43f85b839a11ea0be2ed81a08` là baseline remote đã đối chiếu trước khi tích hợp. Candidate backup/source đã xác minh có tree `04f3183c5b29165014985d1b992c88e2ef0d0c73`. Vercel không liên kết tự deploy với Git; việc cập nhật GitHub không tự triển khai hoặc đổi alias Production. Deployment Production được ghi trong [runbook](docs/OPERATIONS.md). Mọi thay đổi runtime vẫn cần quy trình triển khai riêng.

## Backup

Candidate workflow được cấu hình chạy 03:30 giờ Việt Nam mỗi ngày (UTC `30 20 * * *`), gửi snapshot gzip tới thư mục Koofr backup riêng, kiểm tra tải lại/hash/parity trước retention. Chính sách giữ 14 ngày, 8 tuần, 6 tháng; baseline bảo vệ nằm ngoài retention tự động. Chưa đưa schedule lên default branch; chưa ghi nhận run thật hay restore qualification. Xem [runbook backup/restore](docs/OPERATIONS.md#backup-và-khôi-phục). Không coi source workflow hoặc kiểm thử fixture là bằng chứng backup cloud đã chạy.

Không commit credential, nội dung Notes, snapshot hoặc log riêng tư vào repo công khai. Không xóa Firestore, lịch sử, thùng rác, share hoặc draft khi dọn backend cũ.
