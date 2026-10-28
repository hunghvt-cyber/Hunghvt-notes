# Backup và restore Firestore Notes

## Phạm vi và trạng thái

Source và workflow trên `main` đã hợp nhất ở commit `7c3598a34691a7983e08208e55c97c34bf596f0c`, tree `035a07789aa235f0e1b79938688633c9c963984f`; CI [run 40601380216](https://github.com/hunghvt-cyber/web-notes/actions/runs/40601380216) là test/browser, không phải backup. Schedule `30 20 * * *` UTC đã ở default branch; chưa có manual/cron backup, Koofr readback hoặc restore qualification. WIF/IAM cần đọc lại theo repo canonical sau rename. Secret cần cho workflow là `NOTES_BACKUP_KOOFR_CREDENTIAL`; trạng thái tồn tại chưa được kiểm chứng.


- Nguồn: `notes-lab-56f0f/(default)/notes-production`.
- Đích riêng: thư mục WebDAV `Notes-Firestore-Backups` trong Koofr; không dùng namespace Notes Koofr cũ.
- Lịch workflow `firestore-backup.yml`: 03:30 Asia/Ho_Chi_Minh mỗi ngày (`30 20 * * *` UTC), có `workflow_dispatch`. Mốc 08:52 UTC ngày 28/10 tương ứng 15:52 VN; lịch 03:30 VN ngày 28/10 đã qua. Lần cron kế tiếp: 03:30 VN ngày 29/10 (20:30 UTC ngày 28/10). Các run 40659900983 và 40663242871 đều là manual, không phải cron.
- Giữ tối thiểu 14 ngày gần nhất, 8 tuần gần nhất và 6 tháng gần nhất. Một snapshot có thể thỏa nhiều nhóm; snapshot được chọn theo lịch Việt Nam. Baseline được bảo vệ không khớp tên file thường nên retention không liệt kê/xóa.
- Workflow tạo snapshot qua `FirestoreNativeRepository.exportLegacySnapshot`, gzip, manifest và SHA-256; upload, tải lại, giải nén, kiểm schema/counts/fingerprint; chỉ sau đó mới tính retention. Bản thiếu/corrupt/khác project hoặc vault không bao giờ là ứng viên xóa.
- Giới hạn source snapshot 50 MB chưa nén. Chạm giới hạn thì run thất bại, không truncate và không prune.
- Code/test có trong repo không phải bằng chứng cloud. Chỉ ghi backup đạt sau run Actions thật và restore qualification đạt. `docs/OPERATIONS.md` ghi run gần nhất đã xác minh.

## Thiết lập bí mật Koofr

Workflow dùng duy nhất GitHub Actions Secret `NOTES_BACKUP_KOOFR_CREDENTIAL`, dạng `username:dedicated-app-password`. Đây phải là mật khẩu ứng dụng Koofr riêng dành cho backup, có quyền ghi/xóa trong thư mục backup riêng; không dùng credential Notes Production, backup Drive/Tapo, rclone hay ứng dụng khác.

Nếu secret chưa có, người quản lý repo mở [GitHub Actions Secrets](https://github.com/hunghvt-cyber/web-notes/settings/secrets/actions/new), đặt tên `NOTES_BACKUP_KOOFR_CREDENTIAL`, dán giá trị vào ô secret rồi Save. Không gửi giá trị cho Codex/chat. Không ghi secret vào biến repo, issue, file, workflow input hoặc shell command.

Koofr root chỉ được khởi tạo nếu `MKCOL` tạo được thư mục mới. Nếu thư mục đã tồn tại, workflow yêu cầu marker ownership khớp chính xác; marker thiếu/sai thì dừng, không nhận thư mục hoặc xóa nội dung có sẵn.

## WIF backup (read-only)

- Provider phải chỉ nhận issuer GitHub Actions với repository canonical `hunghvt-cyber/web-notes` (ID `1423348828`), `refs/heads/main` và workflow chính xác `.github/workflows/firestore-backup.yml@refs/heads/main`. Cần đọc lại attribute condition và service-account binding thực tế sau rename; chưa có xác nhận IAM live.
- Service account riêng `notes-firestore-backup-gha` chỉ có `roles/datastore.viewer` với IAM condition giới hạn database `(default)` trong project này.
- Workflow chỉ có `contents: read` và `id-token: write`, action được pin SHA, không tạo artifact, không in body hoặc credential. Run bị serialize.
- Restore dùng service account/provider riêng và workflow manual riêng. Danh tính backup không có quyền ghi.

## Chạy và xác minh backup

Push workflow vào `main`, thêm secret ở trên, sau đó chạy `Actions → Firestore Notes backup to private Koofr → Run workflow`; nhập `BACKUP_FIRESTORE`. Kiểm tra step `backup_verified` và Summary gồm `backupId`, UTC/local timestamp, counts, fingerprint, hash và retention counts. Không tải snapshot về điện thoại hoặc đưa vào chat. Run cuối cùng phải có URL và commit được lưu ở `docs/OPERATIONS.md`.

Không nhấn rerun liên tục khi có lỗi. Workflow retry WebDAV tối đa ba lần với backoff bounded; kiểm tra code lỗi trong log đã khử dữ liệu. Lỗi export/purge/folder deletion, auth, network, HTTP hoặc hash đều fail-closed và không prune.

## Restore qualification

Workflow riêng lắng nghe `workflow_run` thành công của backup trên `main`; không cần gửi lại prompt, snapshot hoặc secret. Nó đọc pointer `.latest-verified-backup.json`, tải lại backup chính xác, kiểm hash rồi tạo vault `notes-restore-<run-id>`, import, export lại và so đầy đủ fingerprint/counts. Sau đó xóa đúng vault thử bằng recursive delete và xác nhận root không còn. Marker `.restore-qualification-passed.json` chỉ được tái dùng nếu cả `backupId` lẫn `fingerprint` trùng với pointer mới nhất; marker cũ không được làm PASS cho backup mới.

Chỉ `restore_parity_pass` cùng `restore_vault_removed` là qualification. Marker `.restore-qualification-passed.json` ngăn qualification chạy lại. Nếu cleanup test thất bại, không ghi marker và không dọn Koofr legacy. Sau qualification đầu tiên, vô hiệu hóa WIF restore provider, gỡ binding `roles/datastore.user`, xóa service account/pool/provider restore và bỏ workflow trigger dùng một lần khỏi `main`. Không xóa backup provider read-only.

Restore giữ revision/epoch, lịch sử nằm trong record, active/trash, folder/order, share/revocation/token-box, receipts và purge tombstones. Snapshot bao gồm dữ liệu Firestore; draft chỉ còn trên thiết bị và chưa đồng bộ không thể được backup server thu nhận.

## Phục hồi sau khi kho Koofr cũ bị xóa

Sau cleanup, không dùng quy trình `firestore:migrate rollback` quay về namespace Koofr cũ. Dùng backup Firestore đã tải lại và xác minh gần nhất; tạo Firestore vault phục hồi mới bằng quy trình restore có danh tính ghi giới hạn và parity bắt buộc, rồi triển khai backend trỏ tới vault đó qua một release có review. Giữ nguyên vault `notes-production` hiện tại cho tới khi phương án restore và chuyển đổi được duyệt riêng. Không phục hồi bằng cách ghi đè hoặc purge Firestore hiện hành. Koofr backup vẫn độc lập với namespace ứng dụng cũ.

## Dọn legacy — chưa chạy trước restore qualification

Chỉ sau khi backup thật có upload/readback/hash PASS và restore parity PASS cho cùng một `backupId`, đồng thời mọi writer Koofr được cô lập ở cả alias, immutable URL và credentialed/trusted path: xóa đúng namespace Koofr Notes đã nhận diện, không wildcard. SSO redirect trên URL immutable chứng minh truy cập vô danh bị chặn nhưng không tự chứng minh Trusted Source/credentialed access bị chặn. Xóa/retire riêng endpoint/runtime/credential khi chứng minh không còn caller. Giữ Code Inbox, Homepage auth, domain/session, Firestore, thùng rác/history, draft và thư mục backup. Không xóa Blob token/store dùng chung. Ghi target chính xác, response verification, commit và run vào hồ sơ cleanup; không ghi nội dung Notes hoặc secret.

Tình trạng 2026-10-28: backup run `40659900983` đã PASS readback. Restore `40659998751` chỉ tái dùng marker cũ của `40637421409`, nên chưa phải restore qualification cho backup mới. Marker logic đã được sửa trên source; cần chạy backup manual mới sau khi source lên `main`, rồi kiểm tra restore tự động có cùng backup ID. Inventory deployment và URL immutable hiện tại ở [LEGACY-WRITER-INVENTORY-20261028.md](LEGACY-WRITER-INVENTORY-20261028.md). Provisioner exact của `release/minimal-notes` đã gỡ tại commit `c0fe02f`. Baseline OIDC workflow trên `main` vẫn trỏ route export chỉ đọc ở deployment cũ; sẽ retire route/workflow sau khi backup+restore qualification cho cùng snapshot PASS. Chưa xóa namespace Koofr.
