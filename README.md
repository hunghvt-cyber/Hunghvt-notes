# Hunghvt Notes

Ứng dụng Notes tại **https://hunghvt-notes.vercel.app/**. Giao diện tự thiết kế; backend Production đã chuyển sang Firestore theo hồ sơ cutover ngày 27/10/2026.

- [Vận hành và trạng thái hiện tại](docs/OPERATIONS.md).
- [Backup định kỳ và dọn hệ thống cũ — phạm vi đã duyệt](docs/BACKUP-AND-LEGACY-CLEANUP-20261027.md).
- [Audit độc lập backup và dọn legacy — 28/10/2026](docs/BACKUP-AND-LEGACY-CLEANUP-AUDIT-20261028.md).
- [Production backend và backup preflight — 28/10/2026](docs/BACKUP-PREFLIGHT-20261028.md).
- [Bằng chứng cutover và parity](docs/history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- [Firestore native repository](docs/FIRESTORE-NATIVE.md), [Code Inbox](docs/CODE-INBOX.md), [kiểm thử](docs/TESTING.md), [chi tiết backup/restore](docs/NOTES-BACKUP-RUNBOOK.md).
- [Lịch sử nghiên cứu/bàn giao đã chuyển từ ai-nas-lab](docs/history/ai-nas-lab/README.md).
- [Quy tắc tiếp quản](AGENTS.md).

Autosave gửi thay đổi lên Firestore; nhãn “Đã lưu” chỉ xuất hiện sau ACK hợp lệ. Thay đổi chưa được ACK chỉ còn trong RAM của trang đang mở, và có thể mất khi đóng hoặc tải lại trang. Trình duyệt không còn khôi phục persistent draft; database IndexedDB cũ được để nguyên, không đọc hay xóa. Cache danh sách/nội dung chỉ dùng để hiển thị trước khi xác nhận dữ liệu máy chủ. Split cache-first frontend từ PR #34 (dùng API hiện hành; không có prefetch/lazy history) và số đo main/candidate được ghi tại [PR35 report](docs/PR35-FRONTEND-CACHE-20261030.md).

## Source và triển khai

Source ứng dụng hiện hành ở `main`; các SHA PR #16 bên dưới là checkpoint tích hợp lịch sử, không phải HEAD hoặc deployment mới nhất. Vercel không liên kết Git nên push/merge không tự deploy; xem [OPERATIONS](docs/OPERATIONS.md) và hồ sơ phát hành theo ngày để đối chiếu runtime.

`hunghvt-cyber/web-notes` (repository ID `1423348828`) là repo canonical. PR #16 đã hợp nhất vào `main` tại commit `7c3598a34691a7983e08208e55c97c34bf596f0c`, tree `035a07789aa235f0e1b79938688633c9c963984f`. Candidate ban đầu `186479392acf793caf628831075d98405231562b` / tree `04f3183c5b29165014985d1b992c88e2ef0d0c73` đã được xác minh; tree cuối sau cập nhật claims là tree trên. GitHub CI [run 40601380216](https://github.com/hunghvt-cyber/web-notes/actions/runs/40601380216) đạt ở hai job test/browser. PR không deploy runtime Vercel.

## Backup

Workflow backup ở `main`, lịch `30 20 * * *` UTC (03:30 Asia/Ho_Chi_Minh), có `workflow_dispatch`. Lịch có thể chạy trễ; thời gian thực phải đọc từ run, không dùng mốc “next expected” cũ.

Backup theo lịch [40977423422](https://github.com/hunghvt-cyber/web-notes/actions/runs/40977423422), source `d735659d1457f5aa2144ed45fb1aaa9ca07ec495`, phát `backup_verified` lúc 07:06:08 ICT ngày 30/10/2026. Restore tự động [40977519777](https://github.com/hunghvt-cyber/web-notes/actions/runs/40977519777) phát `restore_parity_pass` lúc 07:07:30 và `restore_vault_removed` lúc 07:07:31. Cùng backup ID `firestore-notes-2026-10-30T00-05-31Z-40977423422-1.json.gz`, fingerprint/counts khớp (38 notes, 3 folders, 11 shares, 102 receipts, 0 erased). Đây là bằng chứng upload/readback/hash và restore qualification trong log, không chỉ CI xanh. Không đọc snapshot/Notes thật trong đợt cập nhật tài liệu.

Lượt cron 29/10 cũng đã được xác minh và chạy trễ khoảng 3 giờ 41 phút; xem [hồ sơ cron](docs/BACKUP-CRON-VERIFICATION-20261029.md). Luồng WIF và credential backup đã được sử dụng thành công trong các run này; không suy ra toàn bộ IAM live đã được audit lại. Secret vẫn là `NOTES_BACKUP_KOOFR_CREDENTIAL`, không đưa giá trị vào chat/repo. Xem [runbook](docs/NOTES-BACKUP-RUNBOOK.md).

Không commit credential, nội dung Notes, snapshot hoặc log riêng tư vào repo công khai. Không xóa Firestore, lịch sử, thùng rác, share hoặc draft khi dọn backend cũ.
