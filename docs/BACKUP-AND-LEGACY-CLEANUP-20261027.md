# Backup Firestore và dọn hệ thống Notes cũ — phê duyệt 27/10/2026

## Trạng thái và phạm vi
Người dùng đã đồng ý phương án dưới đây và giao Codex NAS phối hợp Gemini thực hiện. Đây là yêu cầu triển khai, không chỉ thiết kế. Tài liệu này chưa phải bằng chứng đã có backup hoặc đã dọn hệ thống.

Production được báo cáo ở https://hunghvt-notes.vercel.app, deployment dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1; source branch codex/notes-production-cutover-20261027, commit 97c84e74d2e21ceb3a72b36dd16e6d9505a8e742. Firestore notes-lab-56f0f / (default) / notes-production. Phải đọc metadata hiện tại trước thay đổi; không rollback/cutover lại.

Mọi Notes hiện có trên Firestore, kể cả thùng rác và lịch sử, đều phải giữ. “Notes cũ” ở yêu cầu dọn được hiểu là bản nguồn Koofr/Blob đã được thay thế và thành phần hệ thống cũ, không phải note cũ theo ngày tạo hoặc note trong thùng rác Firestore.

## Phương án đã duyệt
- GitHub Actions trong repo canonical `hunghvt-cyber/web-notes` (ID `1423348828`), lịch 03:30 Asia/Ho_Chi_Minh mỗi ngày (cron UTC 30 20 * * *), thêm workflow_dispatch. Tên cũ `Hunghvt-notes` trả redirect.
- Không tạo tác vụ nhắc việc ChatGPT; đây là lịch backup của hệ thống, không phụ thuộc NAS bật/tắt.
- Snapshot đầy đủ note active/trash, history, folder/order, shares/revocation/token-box, receipts, erased/purge tombstones và metadata khôi phục cần thiết.
- JSON gzip kèm SHA-256 và manifest có schema version, capturedAt UTC, calendar date Asia/Ho_Chi_Minh, counts, source fingerprint.
- Koofr là đích backup riêng; tuyệt đối không ghi backup vào namespace Koofr cũ đang giữ cho rollback.
- Giữ 14 bản ngày, 8 bản tuần, 6 bản tháng. Dùng mốc lịch Việt Nam và policy rõ ràng; một snapshot có thể đáp ứng nhiều lớp lưu giữ, không nhân bản vô ích. Không xóa final pre-cutover baseline theo retention tự động.
- Export phải nhất quán, có ranh giới epoch/revision và phát hiện purge/restore đang chạy; không đóng băng ghi ứng dụng mỗi ngày. Không dùng endpoint UI giới hạn 2 MB. Dùng đường export/restore hỗ trợ gzip và guard 50 MB đã có; nếu vượt guard báo lỗi, không cắt snapshot.
- Upload xong tải lại, giải nén/validate/hash và so counts/fingerprint trước báo SUCCESS.
- Retention chỉ chạy sau backup mới được xác minh, chỉ xóa object trong allowlist thư mục backup do workflow quản lý; thiếu/lỗi manifest hoặc outcome không rõ thì không xóa.
- Concurrency group không cho các run chồng nhau; retry/backoff hữu hạn, không workflow khác tự retry vô hạn. Pin Node/dependency/actions phù hợp repo, least permissions.
- Thông báo thành công/thất bại trong Actions Summary và trạng thái workflow; không gửi tin nhắn ra Telegram/email khi chưa có yêu cầu.

## Danh tính và dữ liệu riêng tư
- WIF GitHub OIDC riêng, condition chính xác repo/workflow/ref hoặc environment được bảo vệ; không dùng Vercel Production identity hay JSON key tĩnh.
- Quyền Firestore chỉ đọc và giới hạn database cần backup, xác minh IAM thực tế. Không cấp quyền ghi để workflow backup tự tiện restore.
- Credential Koofr riêng cho backup qua GitHub Secret; không trích xuất/reuse password từ backup Drive/Tapo hoặc ứng dụng khác. Nếu chưa có, yêu cầu một thao tác cấp quyền tối thiểu qua kênh bảo mật, không gửi secret qua chat.
- Snapshot nằm ở thư mục Koofr private. File tạm ngoài Git, 0700/0600; không commit dữ liệu thật, không upload snapshot thành GitHub artifact, không log text note/capability/token/provider body.
- Lưu snapshot tạm cần đủ dung lượng; trên NAS dùng /vol1 sau kiểm mount, không tải thêm bộ công cụ lớn vào root.
- Bản nháp chỉ nằm trên thiết bị chưa đồng bộ không thuộc backup Firestore; không xóa draft/cache khi dọn hệ thống.

## Điều kiện backup hoàn tất
1. Code/test offline có ý nghĩa về consistency, upload/readback, retention boundary, namespace allowlist và retry.
2. Có run Actions thật qua GitHub OIDC, export source thật và upload Koofr/readback verification PASS; báo run URL và commit.
3. Dùng bản ĐÃ TẢI LẠI từ Koofr để restore sang vault mới tách biệt bằng danh tính one-off đã được cấp quyền. So đầy đủ snapshot/counts/fingerprint, kể cả lịch sử, share và tombstones; không bật endpoint restore production.
4. Restore vault thử chỉ được dọn theo exact ID của run; verification phải xác nhận không còn dữ liệu thử.
5. Schedule đã nằm trên default branch thực tế và được kiểm tra, không chỉ tồn tại trên feature branch. Workflow thủ công chạy được chưa chứng minh cron đã chạy: báo next expected và chờ run lịch nếu cần, không giả lập.
6. Ghi trạng thái backup rõ: last successful capture/verification, restore qualification và mục nào thiếu quyền.

## Dọn hệ thống cũ, sau khi vượt các điều kiện trên
Người dùng cho phép dọn kho Notes cũ/hệ thống cũ; không cần hỏi lại quyền đối với các target đã xác định chính xác.
- Lập inventory liên kết phụ thuộc: mọi alias/domain, deployment cũ có thể ghi, exporter/migration/rollback route, workflow/cron, secret/identity và exact Koofr Notes root. Không xóa theo wildcard tên Notes.
- Báo cáo cutover lưu tại docs/history/ai-nas-lab/notes-firestore-production-cutover-20261027.md ghi hunghvt-notes-hunghvt.vercel.app còn ở deployment trước. Kiểm tra thực tế và đưa alias cần giữ về backend hiện hành hoặc vô hiệu hóa đường cũ; không để split-brain. Domain custom/SSO và API auth phải giữ hoạt động.
- Dừng/khóa mọi đường ghi Notes cũ trước khi xóa dữ liệu. Với deployment immutable có URL riêng, không coi đổi alias là đã thu hồi access; retire/delete exact old deployment khi đã chứng minh không còn dependency và baseline phục hồi vẫn giữ.
- Giữ ít nhất một bản pre-cutover baseline đã verify, tách biệt backup định kỳ, và bản backup Firestore mới có restore PASS.
- Được xóa exact Koofr namespace Notes cũ sau khi đã backup/restore và cô lập writer. Không đụng Google Photos, Tapo, Drive sync, QR/Homepage data hoặc thư mục backup mới.
- Kho Blob/endpoint Homepage Notes cũ chỉ dọn nếu chứng minh đúng là dữ liệu Notes đã nghỉ và không còn dependency. Không xóa Blob store/token dùng chung Homepage/reporting hoặc toàn project Vercel.
- Retire credential/identity/cron/deployment Notes cũ chỉ khi chứng minh không còn đường hiện hành cần dùng. Không xóa ADC NAS, Gemini CLI/wrapper/key hoặc công cụ còn dùng.
- Rollback phải cập nhật sau khi xóa kho Koofr gốc: baseline catalog-hash cũ không còn áp dụng cho namespace không tồn tại. Chọn đường phục hồi hiện hành có thể tái tạo từ backup mới, kiểm chứng bằng dữ liệu tổng hợp; không tuyên bố rollback cũ vẫn dùng được.
- Source/history hữu ích có thể giữ trong Git và đánh dấu lịch sử; không force-push/xóa lịch sử, không reset worktree bẩn. Gỡ route sống/thành phần runtime đã nghỉ, không xóa code còn dùng cho backup/restore.

## Phân chia repo và bàn giao
`hunghvt-cyber/web-notes` là nguồn chính về Notes. PR #16 đã hợp nhất vào `main` tại commit `7c3598a34691a7983e08208e55c97c34bf596f0c`, tree `035a07789aa235f0e1b79938688633c9c963984f`; CI run `40601380216` qua test/browser. Local HTTPS push không có credential, nên candidate được ghi lên branch/PR qua GitHub API; remote tree đã fetch lại và khớp local. Vercel không tự deploy từ Git.

ai-nas-lab chỉ chứa Codex/Gemini/API wrapper/key-group/retry và bài học phối hợp AI có thể dùng lại. Tài liệu Notes đã được chuyển sang docs/history/ai-nas-lab ở repo Notes, giữ lịch sử commit cũ. Bằng chứng dọn NAS chung đưa về repo NAS AIO phù hợp; không tiếp tục tích lũy vào ai-nas-lab.

Codex điều phối và thực hiện, tự gọi Gemini tối đa 2 lượt/batch để phản biện backup consistency, retention và deletion manifest; chỉ gửi metadata/bối cảnh tối thiểu, không snapshot hay secret. Tự kiểm chứng, không chuyển lời thủ công qua người dùng. Đây là ủy quyền thực hiện trong phiên người dùng; không cần diễn giải “chưa được triển khai” trong tài liệu thành yêu cầu xin phép lại.

## Kết quả cần báo
Commit source đã test/push khớp hash; Actions run và schedule; bản Koofr tải lại đã verify; restore comparison; danh sách exact thành phần cũ đã dọn/còn giữ và lý do; trạng thái các domain/backend sau dọn. Nếu thiếu quyền, báo đúng một bước tối thiểu cần người dùng, tiếp tục phần độc lập.

## Nhật ký triển khai 27/10/2026

- Đã đối chiếu checkout `main` với source đã kiểm chứng ở `97c84e74d2e21ceb3a72b36dd16e6d9505a8e742`; code app/test sẽ được hợp nhất nguyên tree, đồng thời giữ tài liệu mới trên main. Project Vercel vẫn không liên kết Git.
- Đã kiểm tra Koofr request file được tạo trong source: nội dung đó được giữ local/ignore và không đưa vào main. Code Inbox API/runtime và workflow không bị xóa.
- Đã kiểm tra WIF/Firestore provision bằng ADC hiện hành: ADC có quyền IAM cần cho hai identity riêng. Đã tạo pool/provider/service account backup và restore không có key JSON. Provider condition giới hạn repository, branch `main`, và đúng file workflow. Project IAM condition giới hạn Firestore database `(default)`; backup dùng `roles/datastore.viewer`, restore dùng `roles/datastore.user`. Restore identity chỉ dành cho qualification và phải bị thu hồi sau lần restore đạt.
- Workflow backup/restore, manifest/hash/readback, fail-closed retention, Node 24 tests và runbook được bổ sung trong source. Trước khi có run thật, không được coi đây là backup đã thành công; không được dọn Koofr namespace hoặc legacy deployment.
- Thiếu credential WebDAV riêng cho backup. Chỉ cần thêm GitHub Actions Secret `NOTES_BACKUP_KOOFR_CREDENTIAL` qua link trong [runbook](NOTES-BACKUP-RUNBOOK.md); không tái sử dụng credential Notes Production hay dịch vụ khác. Sau khi có secret, lịch tự chạy lúc 03:30 VN. Restore qualification dùng workflow manual riêng.
- Kiểm kê Vercel hiện tại: canonical `hunghvt-notes.vercel.app` trỏ deployment mới `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; alias phụ `hunghvt-notes-hunghvt.vercel.app` vẫn gắn deployment cũ `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B` (immutable URL `hunghvt-notes-de329dlyt-hunghvt.vercel.app`). Chưa thay alias/xóa deployment trước khi backup và restore đạt.
- Gemini phản biện nguy cơ retention rỗng/hỏng, thiếu dry-run gate và size-drop. Đã áp dụng fail-closed: chỉ manifest/snapshot hợp cặp, giải nén/hash/count/fingerprint hợp lệ mới được xét; nghi snapshot rỗng/giảm >90% thì dừng prune; chỉ xóa exact object trong thư mục có marker sở hữu. Nhận định của Gemini rằng Firestore không hỗ trợ transaction đọc đa tài liệu không phù hợp transaction/export trong source hiện có; kiểm tra folder-delete/purge và version hash thay vì áp dụng pause ghi hàng ngày.

Nguồn chính thức tham khảo: [Google WIF cho pipeline](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines), [Firestore IAM theo database](https://firebase.google.com/docs/firestore/enterprise/create-databases), [GitHub OIDC claims](https://docs.github.com/en/actions/reference/security/oidc), [Koofr WebDAV và mật khẩu ứng dụng riêng](https://app.koofr.net/help/webdav).


## Trạng thái thực thi — 28/10/2026

- Source và workflow backup/restore đã hợp nhất vào default branch `main`: commit `7c3598a34691a7983e08208e55c97c34bf596f0c`, tree `035a07789aa235f0e1b79938688633c9c963984f`. GitHub CI [run 40601380216](https://github.com/hunghvt-cyber/web-notes/actions/runs/40601380216) thành công ở test/browser; đây không phải Actions backup run.
- Schedule trên `main`: `30 20 * * *` UTC, `workflow_dispatch` bật. Chưa có manual hoặc cron backup run; next expected là 03:30 ngày 29/10/2026 giờ Việt Nam.
- OIDC source dùng claim `hunghvt-cyber/web-notes` và ID `1423348828`. Chưa đọc lại WIF provider condition/IAM binding sau rename; môi trường phiên này không có gcloud/ADC.
- Chưa xác minh secret `NOTES_BACKUP_KOOFR_CREDENTIAL`; chưa có upload/readback/hash verification hoặc restore parity; chưa tạo/dọn vault thử.
- Vercel metadata: alias chính `hunghvt-notes.vercel.app` → `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1` READY; alias phụ `hunghvt-notes-hunghvt.vercel.app` → legacy `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B` / immutable URL `hunghvt-notes-de329dlyt-hunghvt.vercel.app`. Backend vẫn Firestore. Chưa đổi alias/xóa deployment/namespace. Giữ legacy vì chưa qua backup + restore gate; exact Koofr root phải được kiểm chứng trước khi xóa.

## Code Inbox sau đổi tên repo — 28/10/2026

Nhánh source `release/minimal-notes` đã đổi các claim repo sang `hunghvt-cyber/web-notes` trong PR #18; CI [run 40602314009](https://github.com/hunghvt-cyber/web-notes/actions/runs/40602314009) thành công. Metadata và source Vercel Production đã đọc lại: deployment `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1` còn tên repo cũ trong handler Code Inbox và OIDC helper. GitHub OIDC sau rename phát claim canonical nên endpoint hiện có thể từ chối Code Inbox. Chưa deploy runtime; không dùng nhánh Koofr cũ làm bản deploy. Cần một release riêng dựa trên source Firestore hiện hành để phục hồi Code Inbox.