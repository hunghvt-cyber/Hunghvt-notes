# Hunghvt Notes

Ứng dụng Notes tại **https://hunghvt-notes.vercel.app/**. Giao diện tự thiết kế; backend Production đã chuyển sang Firestore theo hồ sơ cutover ngày 27/10/2026.

- [Vận hành và trạng thái hiện tại](docs/OPERATIONS.md).
- [Backup định kỳ và dọn hệ thống cũ — phạm vi đã duyệt](docs/BACKUP-AND-LEGACY-CLEANUP-20261027.md).
- [Audit độc lập backup và dọn legacy — 28/10/2026](docs/BACKUP-AND-LEGACY-CLEANUP-AUDIT-20261028.md).
- [Bằng chứng cutover và parity](docs/history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- [Firestore native repository](docs/FIRESTORE-NATIVE.md), [Code Inbox](docs/CODE-INBOX.md), [kiểm thử](docs/TESTING.md), [chi tiết backup/restore](docs/NOTES-BACKUP-RUNBOOK.md).
- [Lịch sử nghiên cứu/bàn giao đã chuyển từ ai-nas-lab](docs/history/ai-nas-lab/README.md).
- [Quy tắc tiếp quản](AGENTS.md).

## Source và triển khai

`hunghvt-cyber/web-notes` (repository ID `1423348828`) là repo canonical. PR #16 đã hợp nhất vào `main` tại commit `7c3598a34691a7983e08208e55c97c34bf596f0c`, tree `035a07789aa235f0e1b79938688633c9c963984f`. Candidate ban đầu `186479392acf793caf628831075d98405231562b` / tree `04f3183c5b29165014985d1b992c88e2ef0d0c73` đã được xác minh; tree cuối sau cập nhật claims là tree trên. GitHub CI [run 40601380216](https://github.com/hunghvt-cyber/web-notes/actions/runs/40601380216) đạt ở hai job test/browser. PR không deploy runtime Vercel.

## Backup

Workflow backup đã ở `main`, lịch `30 20 * * *` UTC (03:30 Asia/Ho_Chi_Minh), có `workflow_dispatch`; next expected cron là 03:30 ngày 29/10/2026 giờ Việt Nam. Chưa có run backup thủ công hoặc theo cron, Koofr upload/readback/hash verification hay restore parity. GitHub CI không phải backup run. WIF/IAM cần được đọc lại theo canonical repo sau rename; workflow yêu cầu secret `NOTES_BACKUP_KOOFR_CREDENTIAL`. Xem [runbook](docs/NOTES-BACKUP-RUNBOOK.md).

Không commit credential, nội dung Notes, snapshot hoặc log riêng tư vào repo công khai. Không xóa Firestore, lịch sử, thùng rác, share hoặc draft khi dọn backend cũ.
