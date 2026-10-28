# Notes vận hành — 28/10/2026

## Hiện hành
Theo báo cáo Codex NAS và hồ sơ cutover được chuyển về repo này:
- Repo GitHub canonical: `hunghvt-cyber/web-notes` (ID `1423348828`); tên cũ chuyển hướng. `main` đã tích hợp PR #16 tại `7c3598a34691a7983e08208e55c97c34bf596f0c`, tree `035a07789aa235f0e1b79938688633c9c963984f`.
- URL https://hunghvt-notes.vercel.app
- Cutover report identifies Firestore `notes-lab-56f0f / (default) / notes-production`; independent audit 28/10 cannot establish the effective backend serving current runtime. Project env metadata lists legacy Koofr config, while the health route is backend-neutral. Treat backend as UNKNOWN until authenticated read-only provider-specific verification.
- Deployment tại cutover: dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1.
- Source đã xác minh được hợp nhất từ branch codex/notes-production-cutover-20261027, commit 97c84e74d2e21ceb3a72b36dd16e6d9505a8e742, deployed tree ab169c6bd440f228a3f521fc4357b7bddf2eadec. Vercel vẫn không liên kết Git; push `main` không đổi deployment.
- 28 notes tại cutover: 6 active, 22 trash; 2 folder, 11 share, 24 receipt, 0 erased tombstone. Full parity fingerprint nằm trong [hồ sơ cutover](history/ai-nas-lab/notes-firestore-production-cutover-20261027.md).
- Giữ namespace/session và auth Homepage; không dùng Blob hoặc Koofr làm backend ghi Notes mới. Chưa có bằng chứng người dùng xác nhận phiên trình duyệt thật, hoặc GitHub OIDC Code Inbox thật sau cutover.
- Checkpoint Production vẫn là deployment `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; công việc backup không thay alias hoặc deployment.
- Nhánh `release/minimal-notes` đã được cập nhật claim canonical ở PR #18 (`8ce7d3300ef0515c861b7bf2c1e7a294d82648ad`, CI `40602314009`). Tuy nhiên Vercel Production deployment `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1` vẫn chứa claim repo cũ trong Code Inbox. Token OIDC mới có tên repo `web-notes`, vì vậy Code Inbox có thể từ chối yêu cầu cho tới khi source Firestore hiện hành được phát hành riêng. Không deploy nhánh Koofr cũ; công việc này chưa deploy Production.

## Backup
Người dùng đã duyệt backup GitHub Actions 03:30 VN → Koofr private, 14 daily + 8 weekly + 6 monthly. Xem [nhiệm vụ backup và cleanup đã duyệt](BACKUP-AND-LEGACY-CLEANUP-20261027.md).
PR #16 đã đưa source/workflow lên `main`; GitHub CI [run 40601380216](https://github.com/hunghvt-cyber/web-notes/actions/runs/40601380216) thành công ở test và browser. Local suite 187/187 đạt sau cập nhật claims. Đây là CI, không phải backup. Workflow có lịch UTC `30 20 * * *` và `workflow_dispatch`; chưa có manual/cron backup run, Koofr readback/verification hoặc restore qualification. Source claims đã đổi sang canonical repo, nhưng WIF provider condition/IAM thực tế chưa được đọc lại sau rename (không có gcloud/ADC trong môi trường phiên này). Secret `NOTES_BACKUP_KOOFR_CREDENTIAL` chưa được xác minh. Giữ legacy cho tới khi backup + restore PASS. Xem [runbook](NOTES-BACKUP-RUNBOOK.md).

## Cleanup
Kiểm tra Vercel metadata ngày 28/10: `hunghvt-notes.vercel.app` → `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1` (READY, project `hunghvt-notes`); alias phụ `hunghvt-notes-hunghvt.vercel.app` → deployment cũ `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`, immutable URL `hunghvt-notes-de329dlyt-hunghvt.vercel.app`. Backend hiện hành vẫn là Firestore `notes-lab-56f0f/(default)/notes-production`; PR không deploy runtime. Chưa đổi alias hoặc xóa deployment. Không xóa legacy vì chưa có backup/readback/restore qualification. Exact Koofr legacy root chưa được xác minh; không đụng vào kho đó.

## Bằng chứng và cập nhật
Mọi thay đổi Notes được ghi ở repo này. ai-nas-lab chỉ giữ thông tin phối hợp Codex/Gemini và công cụ AI.
Luôn phân biệt dữ liệu đọc trực tiếp với báo cáo từ NAS, test fixture, cloud smoke và deployment hiện hành. Kiểm tra metadata trước khi dựa vào checkpoint cũ.


## Independent audit — 28/10/2026

Read-only verification confirmed the canonical production alias and legacy alias/deployment, but did not establish the active runtime datastore. GitHub reports zero runs for the Firestore backup workflow; there is no Koofr readback or restore parity. Live WIF/IAM and the dedicated Koofr secret's existence remain unverified. No alias, deployment, namespace, credential, or Notes data was changed. See [full audit and evidence](BACKUP-AND-LEGACY-CLEANUP-AUDIT-20261028.md).

## Preflight follow-up — 28/10/2026

Vercel deployment artifact inspection confirmed the deployed selector source matches `main`, while the exact effective environment captured by that deployment is not exposed by the connected Vercel API. Backend remains UNKNOWN. Read-only inventory found the Koofr-only legacy deployment and conditional Code Inbox/rollback writers; nothing was changed. Use [the preflight runbook](BACKUP-PREFLIGHT-20261028.md) for exact artifact evidence, the filtered Google Cloud Shell check, GitHub UI secret check, and manual workflow input.
