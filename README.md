# Hunghvt Notes

Ứng dụng ghi chú tại **https://hunghvt-notes.vercel.app/**, giao diện tự thiết kế, backend hiện hành **Firestore** theo hồ sơ cutover ngày 27/10/2026.

- [Vận hành và trạng thái hiện tại](docs/OPERATIONS.md).
- [Backup định kỳ và dọn hệ thống cũ — người dùng đã duyệt](docs/BACKUP-AND-LEGACY-CLEANUP-20261027.md).
- [Bằng chứng cutover và parity](docs/history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- [Lịch sử nghiên cứu/bàn giao chuyển từ ai-nas-lab](docs/history/ai-nas-lab/README.md).
- [Quy tắc tiếp quản](AGENTS.md).

## Source và triển khai
Source production được báo cáo ở branch [codex/notes-production-cutover-20261027](https://github.com/hunghvt-cyber/Hunghvt-notes/tree/codex/notes-production-cutover-20261027), commit 97c84e74d2e21ceb3a72b36dd16e6d9505a8e742. main trước đây chỉ có .gitignore; lượt cập nhật này đưa tài liệu Notes về đúng repo, không tự đổi source/deployment. Khi hợp nhất code phải kiểm tree và CI, không reset worktree chưa lưu hoặc mặc định một branch khác đã deploy.

## Backup và dọn hệ thống
Phương án đã duyệt: GitHub Actions 03:30 giờ Việt Nam mỗi ngày, snapshot gzip + SHA-256 vào Koofr riêng tư; giữ 14 bản ngày, 8 bản tuần và 6 bản tháng. Đây là **yêu cầu triển khai**, chưa phải chứng nhận đã chạy. Chỉ dọn hệ thống Notes cũ sau khi backup đã được tải lại kiểm hash và restore thử đầy đủ.

Giữ nguyên Notes Firestore, lịch sử, thùng rác, draft và quyền chia sẻ. Không commit credential, nội dung ghi chú, snapshot hoặc log riêng tư vào repo công khai.
