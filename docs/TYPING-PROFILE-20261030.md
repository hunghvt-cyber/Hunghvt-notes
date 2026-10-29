# Typing profile và cloud qualification — 30/10/2026

## Kết luận

Không có app-code change trong lượt này. Profile không tìm thấy tác vụ dài từ prefetch, IndexedDB cache write hay render trong lúc gõ để sửa có căn cứ. Số Playwright p95 403 ms cũ không tái hiện trong replay chuẩn hóa, nhưng nguyên nhân của outlier cũ chưa xác định. PR #34 tiếp tục draft; không deploy Production vì Preview OIDC/Firestore chưa đủ điều kiện kiểm chứng.

## Phương pháp

Đo `origin/main` (`d735659d1457f5aa2144ed45fb1aaa9ca07ec495`) và candidate PR #34, tree `97c99645e083a1969f1029c476cba89392835ac0`, dùng Chromium headless trên NAS và handler Firestore-compatible chạy trong RAM với 12 note tổng hợp. Mỗi điều kiện có 20 lần mở, mỗi lần sáu ký tự (120 input events); revision response trễ 120 ms. Không đọc Notes thật hay gọi Firestore.

Mốc mở note giống nhau cho hai source: click capture → nội dung note hiện và editor enabled → hai `requestAnimationFrame`. Thời gian revalidation revision đo riêng. Gõ được quan sát bằng dispatch lag, handler tới microtask, event tới hai frame, long tasks, IndexedDB puts, subtree replacement và DOM mutation; End+x Playwright wall time được giữ như chỉ số harness phụ. Bảng đầy đủ, request/bytes/lỗi, trạng thái cloud và giới hạn có trong [JSON đã lọc](TYPING-PROFILE-20261030.json).

## Kết quả

| Điều kiện (20 mẫu; p50/p95 ms) | Click → editor dùng được | Revision nền | End+x Playwright | Input → 2 frame | Handler p95 | Requests / bytes | Lỗi |
|---|---:|---:|---:|---:|---:|---:|---:|
| Main | 102.4 / 120 | 152 / 170.2 | 55.82 / 85.89 | 14.5 / 29.3 | 0.1 | 39 / 11,898 | 0 |
| Candidate, prefetch bật/cache writes bật | 82 / 95 | 151 / 160.9 | 60.58 / 83.23 | 13.9 / 29.9 | 0.1 | 39 / 11,898 | 0 |
| Candidate, prefetch tắt | 82.8 / 93.8 | 150.7 / 217.2 | 66.94 / 98.54 | 14.5 / 29.2 | 0.2 | 39 / 11,898 | 0 |
| Candidate, prefetch bật/cache writes tắt | 83.6 / 100.2 | 155.2 / 180 | 64.1 / 84.22 | 16.6 / 29.5 | 0.1 | 39 / 11,898 | 0 |

Trong khoảng gõ không ghi cache, không có prefetch request HTTP, long task hoặc `replaceChildren`; editor mutations chỉ là thuộc tính trạng thái lưu/conflict. Revision response chồng lên cặp phím ở 8/20 main, 18/20 candidate prefetch-on, 12/20 prefetch-off và 16/20 cache-write-off, nhưng handler/paint không tăng tương ứng. Tắt prefetch hoặc cache writes không cải thiện ổn định input metrics; cache-write-off là negative control vì không có cache write trong khoảng gõ.

Replay End+x trên candidate p95 83.23 ms, còn event-to-two-frame p95 29.9 ms. Vì 403 ms trước đó là wall time Playwright khác lớp với input latency, không tái hiện trong lần này, và 20 mẫu p95 là cực đại mẫu nhạy với outlier, không thể kết luận nguyên nhân cũ là measurement noise. Profile cũng không chứng minh độ trễ thiết bị vật lý. Con số candidate click p95 95 ms dưới mục tiêu 100 ms trong fixture này; không phải bằng chứng Production hay thiết bị thật. Kết quả prefetch bật/tắt gần nhau, vì thế không quy cải thiện note-open cho prefetch trong bài đo này.

## Gemini review

- **Key 4 — `gemini-3.5-flash-lite`, vai trò kiểm tra code/race/cache và profile:** không tìm thấy thay đổi app cần thiết từ bằng chứng profiling; đối chiếu các metric handler, paint, revision overlap, cache/render và trạng thái request. Chấp nhận kết luận “chưa thấy app task gây khựng trong fixture”. Nhận định chắc rằng 403 ms chỉ là measurement noise bị bác bỏ/hạ mức: outlier không tái hiện nhưng nguồn gốc chưa chứng minh.
- **Key 5 — `gemini-3.5-flash-lite`, vai trò đối chiếu yêu cầu, benchmark và release gate:** xác nhận mốc click→editor và revision nền tách riêng, giới hạn n=20/headless/in-memory; đồng ý gate release chưa đạt do cloud. Nhận định Git connection/custom Preview domain là blocker bản chất bị bác bỏ: hồ sơ trước ghi nhận direct no-Git deployment hoạt động. Blocker đã kiểm chứng hiện tại là GCP Preview WIF/SA/IAM, không phải thiếu Git/custom domain.

Wrapper `/home/admin/bin/gemini-task` đã kiểm tra qua `--help` và dùng được. Prompt/review chỉ chứa source excerpts đã lọc cùng dữ liệu tổng hợp; không gửi Notes thật, session, token hay secret.

## Cloud OIDC: đã thử và blocker chính xác

Các kiểm tra chỉ đọc ngày 30/10 cho kết quả:

- Vercel project/deployment metadata đọc được; Vercel CLI không có trong môi trường. Vercel MCP không cung cấp thao tác liệt kê environment variables, nên không xác minh giá trị env OIDC của Preview qua công cụ hiện có.
- `/home/admin/bin/notes-gcloud --version` chạy; lệnh `gcloud iam workload-identity-pools list` thất bại vì không có active gcloud CLI account. Đã chuyển sang read-only Cloud Resource Manager/IAM API bằng dedicated ADC có sẵn; các API read trả HTTP 200. Không sửa IAM.
- Pool `vercel-notes-preview` có state ACTIVE nhưng trường `disabled: true`. Provider `notes-preview` issuer `https://oidc.vercel.com/hunghvt`, subject condition là Preview environment của project `hunghvt-notes`.
- Service account `notes-preview-firestore@notes-lab-56f0f.iam.gserviceaccount.com` tồn tại nhưng policy không có binding. Project IAM hiện chỉ gán `roles/datastore.user` cho Production service account với điều kiện default database; không có binding cho Preview SA.
- Firestore IAM boundary khả dụng là database-wide, không phải từng synthetic vault. Không có quyền/database scope được duyệt để dựng vault cô lập với identity Preview hiện tại.

Do WIF pool bị disable và Preview SA không có quyền impersonation/data, Preview token không thể hoàn tất exchange/read. Không tạo deployment/vault và không thử read/history qua OIDC khi trạng thái này chưa được khôi phục; không nới quyền hoặc bật billing. Cần cloud owner khôi phục Preview WIF và binding least-privilege đã duyệt ở database scope, cung cấp cách xác minh cấu hình OIDC env bằng công cụ được cấp, rồi chạy quyền đọc, revision, lazy history và cleanup trên vault tổng hợp. Không có vault hoặc deployment tạm nào được tạo nên không có cleanup pending. NAS ADC/fixture và lịch sử qualification 27/10 không thay thế trạng thái cloud hiện tại.

## Release gate

Source/browser profiling không tìm ra regression khi gõ cần patch trong lượt này; cũng không giải quyết blocker cloud. PR #34 vẫn draft và Production giữ `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`, các alias/rollback không đổi. Không tuyên bố đạt trải nghiệm 8/10 Google Keep. S25 Ultra/iPad và Vercel OIDC→Firestore read/history hiện tại chưa được kiểm chứng. Khi cloud gate mở, cần chạy lại qualification, browser/CI trên exact candidate và đo thiết bị thật trước khi promote.
