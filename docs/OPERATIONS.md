# Notes vận hành — cập nhật bằng chứng 30/10/2026

## Backup hiện hành — 30/10/2026

Backup theo lịch [40977423422](https://github.com/hunghvt-cyber/web-notes/actions/runs/40977423422), source `d735659d1457f5aa2144ed45fb1aaa9ca07ec495`, phát `backup_verified` lúc 07:06:08 ICT ngày 30/10/2026. Restore tự động [40977519777](https://github.com/hunghvt-cyber/web-notes/actions/runs/40977519777) phát `restore_parity_pass` lúc 07:07:30 và `restore_vault_removed` lúc 07:07:31. Cùng backup ID `firestore-notes-2026-10-30T00-05-31Z-40977423422-1.json.gz`, fingerprint/counts khớp (38 notes, 3 folders, 11 shares, 102 receipts, 0 erased). Đây là bằng chứng upload/readback/hash và restore qualification trong log, không chỉ CI xanh. Không đọc snapshot/Notes thật trong đợt cập nhật tài liệu.

README/runbook và AGENTS đã bỏ cách diễn giải “chưa có cron/backup” ở checkpoint 28/10. Các mục theo ngày bên dưới giữ lịch sử rollout; đọc hồ sơ ngày mới nhất trước, không dùng câu UNKNOWN hoặc rollout cũ để suy trạng thái hiện tại. Đợt này chỉ cập nhật tài liệu, không chạy backup/restore hay đổi deployment. Chi tiết runtime frontend tiếp tục theo hồ sơ phát hành tương ứng; HEAD tài liệu không phải deployment SHA.


## Performance baseline — 2026-10-28

NAS-to-Production health and synthetic Firestore UI measurements are recorded
in [performance baseline](PERFORMANCE-BASELINE-20261028.md). Production health
confirmed Firestore access, with a server-side p95 tail that is not yet split
into OIDC, SDK initialization, and Firestore read time. UI measurements used a
separate synthetic test-project vault, not Production Notes. The test vault was
removed and its absence verified. No performance code change was justified by
the current evidence.


## Cutover revalidation — 28/10/2026

The explicit Firestore selector and Vercel OIDC implementation are present in canonical `main`, but current project Production metadata lacks the Firestore selector/WIF variables. The exact captured environment of the current primary deployment remains unavailable, so its active datastore remains **UNKNOWN**.

Latest verified Firestore backup/restore is manual PASS (32 notes, 2 folders, 11 shares, 36 receipts, no erased tombstones; fingerprint is recorded in [backup/restore evidence](BACKUP-RESTORE-VERIFIED-20261028.md)). The latest available Koofr export is the older 27/10 cutover baseline (28 notes, 2 folders, 11 shares, 24 receipts, no erased tombstones). These are different checkpoints and must not be compared by timestamp or overwritten without a current Koofr export and semantic merge. Details and filtered Gemini review: [cutover revalidation](FIRESTORE-CUTOVER-REVALIDATION-20261028.md).

A dormant GET-only Koofr export route was merged in `1cc44d882fad9ad383141258c3c41bfaa0375474`; its preview build completed READY and default-disabled probe returned 404. It has not been deployed to the primary Vercel project. No new Firestore deployment, alias switch, final Koofr snapshot, writer isolation, or legacy cleanup was performed. Primary and secondary aliases remain READY. Cron execution remains unverified.

## Current status — verified 2026-10-28

## Revalidation after Firestore cutover — 2026-10-28

The READY Production deployment `dpl_2Ar8fGYSj7M4iorJHYUBfUGKsMDr`
(`hunghvt-notes-7s1dvhwsk-hunghvt.vercel.app`, source `ca18a373f0b53e26a473526de706559a1b957`)
is the current target of both `hunghvt-notes.vercel.app` and
`hunghvt-notes-hunghvt.vercel.app`. A read-only health request at
2026-10-28 08:37:15 UTC returned HTTP 200 with `firestore-native-v1`, project
`notes-lab-56f0f`, vault `notes-production`, and `firestoreRead=PASS`. This
runtime evidence supersedes the earlier UNKNOWN paragraph above; no note was
created or changed by the probe.

Backup run [40659900983](https://github.com/hunghvt-cyber/web-notes/actions/runs/40659900983)
completed on `main` and emitted `backup_verified` for
`firestore-notes-2026-10-28T08-52-30Z-40659900983-1.json.gz`; its upload,
download/readback, compressed hash and manifest verification passed. The
automatic restore run
[40659998751](https://github.com/hunghvt-cyber/web-notes/actions/runs/40659998751)
did **not** qualify that backup: it short-circuited on the old marker for
`firestore-notes-2026-10-28T05-20-38Z-40637421409-1.json.gz`. A code fix now
reuses a qualification marker only when both backup ID and fingerprint match
the latest verified backup. Run a new manual backup after that fix reaches
`main`; its `workflow_run` restore must emit both `restore_parity_pass` and
`restore_vault_removed` for that new backup before cleanup.

The active Vercel firewall on `hunghvt-notes` has an exact-host `deny` rule
for all 34 prior immutable deployment hosts. The separate
`notes-firestore-exact-082` project has another exact-host `deny` for its six
old release-branch deployments. Current Firestore candidate domains and app
aliases are excluded. Both rules are active in control-plane configuration;
anonymous requests still return 302 because deployment protection runs before
WAF, so those responses are not the deny-rule test. The deployment objects
remain present. The temporary alias bypass was revoked. The old provisioner
was retired at `c0fe02f`; this cleanup removes the baseline OIDC workflow and
the exporter/rollback API entrypoints from canonical `main`. The exact
namespace deletion workflow rechecks the same-backup restore qualification
before deleting only the approved Koofr namespace. See the [legacy writer
inventory](LEGACY-WRITER-INVENTORY-20261028.md).

CI runs `npm run check:source`, which syntax-checks all `api/`, `lib/`, and
`scripts/` JS modules, imports `api/` and `lib/`, and rejects known
truncated-output markers. After removing the old Koofr provision and test-root
cleanup code, local source check passed for 48 files and offline tests passed
(191/191), including a synthetic recursive-delete test restricted to the exact
legacy root. CI run [40667083362](https://github.com/hunghvt-cyber/web-notes/actions/runs/40667083362)
passed both test and browser jobs with the added cleanup test.


## Cron timestamp correction — 2026-10-28

Backup `40659900983` at 08:52 UTC on 28 October was 15:52 Asia/Ho_Chi_Minh; the 03:30 VN run on 28 October had already passed. Backup `40663242871` captured at 09:18 UTC, or 16:18 VN, on 28 October. The next scheduled run is 03:30 VN on 29 October (20:30 UTC on 28 October). Both Actions runs cited above were manual dispatches; neither is cron evidence.

## Final backup qualification and legacy writer lock — 2026-10-28

Backup [40663242871](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663242871) and automatic restore qualification [40663337366](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663337366) both PASS for the exact backup ID `firestore-notes-2026-10-28T09-18-52Z-40663242871-1.json.gz`. Readback SHA-256 is `30b1441b402064b5f9245e0ce420533f41a7d696a4229e98f4273cf27d817f23`; fingerprint `525b16af87a11ff9fa690be6daf819475b79202e90819325ec73c8ff34011131`; parity counts are 32 notes (5 active, 27 trash), 2 folders, 11 shares, 36 receipts, 0 erased tombstones. Restore reported parity pass and removed `notes-restore-40663337366` after recursive delete.

Vercel active firewall config version 1 now contains active exact-host deny rule `rule_block_retired_notes_deployment_hosts_P2DiU9`, matching only the 34 pre-cutover immutable deployment hosts; current Firestore deployment and both aliases are excluded. `firewallEnabled=true`, no pending config changes. Vercel processes deployment protection before WAF, so anonymous 302 is not treated as the deny test. The rule is the control-plane writer lock; no authenticated request probe was run. Custom WAF rules are available on all plans per Vercel documentation; no billing change was made. The old provision workflow was removed from `release/minimal-notes` at `c0fe02f`.

The cleanup source removes the default-branch baseline OIDC workflow/request, exact provisioner and old 39-root test cleanup writer, exporter/rollback API entrypoints, and obsolete Vercel function mappings. It also disables new Vercel deployments from `release/minimal-notes`. Production export is disabled in environment metadata and rollback enablement is absent. The exact namespace deletion workflow revalidates the latest backup bytes/hash and matching restore marker at execution, then locks/deletes only `Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e` and verifies its root is absent. Deletion workflow [40668142124](https://github.com/hunghvt-cyber/web-notes/actions/runs/40668142124) completed successfully at 09:57 UTC on 2026-10-28. It deleted 146 files and 0 folders under the exact approved namespace, and its success event is emitted only after depth-0 PROPFIND confirms root HTTP 404. The run revalidated the matching backup and restore marker; no Notes content was logged. The isolated restore WIF identity remains because it performs qualification after each new successful backup; its scope is separate from the read-only backup identity. See [inventory](LEGACY-WRITER-INVENTORY-20261028.md) and [backup evidence](BACKUP-RESTORE-VERIFIED-20261028.md).

The old `notes-firestore-exact-082` project has a successful build-only deployment but no app environment variables and no Notes aliases. It is not the live project. Canonical aliases still target the Firestore-native deployment recorded above; source route removal awaits a canonical-project deployment. No alias was moved in this cleanup step.


## Temporary access cleanup and live Production deployment — 2026-10-28

The baseline-only WIF workflow allowlist was removed and read back; backup and restore qualification providers, repository principalSet bindings, database-scoped roles, Firestore/auth/Code Inbox configuration, and the retired-host firewall rule remain. Canonical Production now serves deployment `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM` from source commit `480b54605c8ed8d599af486bab7817456fd6afae`; both app aliases target it. Fresh runtime health reads Firestore successfully, and the migration export/rollback URLs return 404. Full filtered evidence and the Trusted Sources readback limitation are in [access cleanup and deployment evidence](ACCESS-CLEANUP-PRODUCTION-DEPLOYMENT-20261028.md).


## Vercel project and branch inventory update — 2026-10-29

The two Vercel projects approved for retirement, `notes-firestore-exact-082` and `homepage-koofr-lab`, were deleted by exact verified project name in team `team_gCsQcRiaCja0GafKj8JZLINI`. Readback returned project-not-found for both IDs. Canonical aliases remain on Notes deployment `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM` and Homepage NAS deployment `dpl_4T9PcviEaivkFGqDGsYKhRgVX4jE`. See [filtered Vercel deletion evidence](VERCEL-PROJECT-RETIREMENT-20261029.md).

The remote branch plan, exact archived HEADs, archive-tag names, CI/ref dependencies, and preserved local worktrees are in the [branch lifecycle inventory](BRANCH-LIFECYCLE-20261029.md). Twenty-seven retired refs now have matching remote archive tags and have been deleted. Exactly `main`, `release/minimal-notes`, and the draft performance experiment branch remain. Code Inbox still depends on `release/minimal-notes` and its matching WIF ref; that branch is retained without merging its legacy app into `main`. PR #24 remains a draft isolated experiment.

## Responsive Notes UI Production release — 2026-10-29

PR [#25](https://github.com/hunghvt-cyber/web-notes/pull/25) merged the approved responsive UI to `main` at `f7b0544194d0f71f66307d35e5eb35d5bf2c853b`; CI run [#439](https://github.com/hunghvt-cyber/web-notes/actions/runs/40821191715) passed. The canonical Vercel project has no Git connection, so there was no automatic deployment on push. Production deployment `dpl_7Y9AiUP9uutwVXedkypQ6se9auec` was created explicitly from that SHA and reached `READY`. Both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app` point to it. Read-only Production checks returned HTTP 200 for app HTML, CSS, JS, and `/api/app?route=health`; health reported Firestore read PASS. Previous deployment `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM` (source `480b54605c8ed8d599af486bab7817456fd6afae`) is the recorded rollback target. Detailed geometry, test results, Gemini review, deployment evidence, and physical-device limitations: [responsive UI integration](RESPONSIVE-UI-INTEGRATION-20261029.md).


## Notes UI polish Production release — 2026-10-29

PR [#26](https://github.com/hunghvt-cyber/web-notes/pull/26) merged as `53cd7ddc05d64139983caa050b098ea001caeeb3`; CI run [#443](https://github.com/hunghvt-cyber/web-notes/actions/runs/40830938919) passed test and browser jobs. Explicit Vercel deployment `dpl_Gu1BG8sCAYJe2Y633TjAhkSHhqMZ` reached READY from that SHA and serves `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app`. Read-only HTML/CSS/JS and health requests returned HTTP 200; Firestore health read passed. Rollback target: pre-release deployment `dpl_7Y9AiUP9uutwVXedkypQ6se9auec` (source `f7b0544194d0f71f66307d35e5eb35d5bf2c853b`). Source check 48 modules, offline 191/191, browser suite 18/18 on synthetic fixtures. Detailed screenshots, measurements, first-CI race and correction, browser-only scope, Gemini unavailability, and manual-device checklist: [responsive UI integration](RESPONSIVE-UI-INTEGRATION-20261029.md). No real Notes were used for mutation tests.


## Visual viewport menu follow-up — 2026-10-29

After the initial UI polish release, Gemini review through the executable NAS wrapper identified a reproducible narrow-visual-viewport overflow in the portaled action menu. The fix was merged in PR [#27](https://github.com/hunghvt-cyber/web-notes/pull/27) as `3398d29deff5b32fad2f14b4349bc8a622bf2695`; CI run [#446](https://github.com/hunghvt-cyber/web-notes/actions/runs/40834744233) passed test/browser. Production deployment `dpl_EqVyaCg6bsmuHuqFKvXRgYavceGf` reached READY from that SHA and serves both canonical app aliases. Read-only app asset and health requests returned HTTP 200; Firestore read PASS. Prior READY deployment `dpl_Gu1BG8sCAYJe2Y633TjAhkSHhqMZ` (source `53cd7ddc05d64139983caa050b098ea001caeeb3`) is the rollback target. Source/offline/browser verification: 48 modules, 191/191 tests, 18/18 scenarios. Full wrapper-access clarification, the two filtered review outcomes, pre-fix failing bounds, post-fix measurements, and device-testing limits are in [responsive UI integration](RESPONSIVE-UI-INTEGRATION-20261029.md). No production Notes were mutated.


## Production paste hang triage — 2026-10-29

The 500 KB paste hang was reproduced with synthetic clipboard content in
Chromium, but “Aw, Snap” itself was not reproduced. Measurements showed the
native textarea paste path stalled on both current and pre-responsive assets;
the fix inserts supported plain-text content once, routes it through the
existing draft/autosave flow, and coalesces draft snapshots. At 500 KB the
handler now returns in 859 ms; a subsequent edit still takes about 4.2 s in
headless Chromium. The actual synthetic store returns its existing 413 for
the 1 MB case and the draft survives reload. No backend/auth/schema or
production Notes were changed. Full measurements, Gemini review outcomes,
limitations, and release/rollback record: [paste crash triage](PASTE-CRASH-TRIAGE-20261029.md).

PR [#28](https://github.com/hunghvt-cyber/web-notes/pull/28) merged the
paste responsiveness and draft-recovery fix to `main` at
`96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a`; CI run
[#449](https://github.com/hunghvt-cyber/web-notes/actions/runs/40841393285)
passed test and browser jobs. Production deployment
`dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst` reached READY from that exact SHA and now
serves both `hunghvt-notes.vercel.app` and
`hunghvt-notes-hunghvt.vercel.app`. Read-only app, CSS, JS, and health checks
returned HTTP 200 through the primary alias; health reported Firestore read
PASS. Rollback targets are the pre-release primary deployment
`dpl_EqVyaCg6bsmuHuqFKvXRgYavceGf` and secondary deployment
`dpl_7Y9AiUP9uutwVXedkypQ6se9auec`. Detailed synthetic measurements, the
fact that “Aw, Snap” was not reproduced, review outcomes, and device limits
are recorded in [paste crash triage](PASTE-CRASH-TRIAGE-20261029.md).

## Tốc độ danh sách/note và bỏ persistent drafts — 2026-10-29

Candidate làm mới cache danh sách bất đồng bộ sau khi render kết quả máy chủ,
bỏ các lần ghi cache cũ khi có snapshot mới hơn, và loại request mở note đã
chờ trong lane khi lựa chọn đã đổi. Không thay API Firestore, lịch sử, CAS,
kiểm revision, cache freshness hay quyền truy cập. Draft không còn được đọc/ghi
từ IndexedDB; nội dung chưa ACK chỉ ở RAM. Các câu trong phần paste triage
phía trên về khôi phục draft sau reload mô tả source cũ và đã bị thay thế.

Đo trên Chromium headless/NAS với 20 note tổng hợp nhỏ và một note 128 KiB,
API handler/Firestore repository mô phỏng bằng in-memory fixture; không có
Notes Production. Trước `d5d815932a0b` → candidate: danh sách cold p50/p95
889/889 ms (n=1) → 782–1.340/782–1.340 ms (n=1 mỗi lượt); warm 312/363 ms
(n=6) → candidate 273–298/312–374 ms (n=6 mỗi lượt). Mở note nhỏ cold
213/282 ms → candidate 180–225/238–243 ms (n=7 mỗi lượt), lớn 214/255 ms →
203–222/254–263 ms, nhỏ warm 191/245 ms → 188–199/230–245 ms, quick switch
413/483 ms → 408–444/459–477 ms. Không có cải thiện ổn định về thời gian mở
note trong các lượt nhỏ này; cold list dao động đáng kể. Ở burst chuyển nhanh có response
trễ, số content GET giảm 3→2; request stale đang chờ bị bỏ trước khi gửi.
Cold list chỉ có một mẫu nên p95 không có ý nghĩa phân phối. Candidate báo cáo
request/browser handler duration cùng tách server duration; đây không phải
đo Production hoặc Vercel OIDC. Xem [chi tiết đã lọc](SPEED-AND-DRAFTS-20261029.md).

PR [#30](https://github.com/hunghvt-cyber/web-notes/pull/30) merged at
`3aa153bed9e768092e24c50a3037dc385635ff11` (tree
`107dc688af1a6953d407ae9eb3ab7566a762ce8b`); CI run
[#457](https://github.com/hunghvt-cyber/web-notes/actions/runs/40876954309)
passed source, offline, simulated-load, and browser checks. Production
deployment `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu` was built from exact candidate
SHA `7991b8045f36835dc8e69f829c5399a4ac31d4ec`, whose tree equals merged main.
Immutable URL health returned HTTP 200 and Firestore read PASS; app HTML, JS,
CSS, cache and sync assets matched source byte-for-byte. Both app aliases and
the Git-main alias point to this deployment. Rollback target:
`dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst` (SHA
`96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a`). The create-deployment API
briefly assigned the default secondary alias while staging; it was immediately
restored to the previous deployment and all aliases were read back before
candidate qualification and final promotion. Full filtered evidence and exact
alias map are in [release verification](SPEED-AND-DRAFTS-20261029.md). The
temporary Vercel share-link bypass used by the protected-URL check was revoked;
the final alias readback has no protection-bypass entries.


## PR #34 frontend-only split — 30/10/2026

PR #34 có thêm API/Firestore query contract cho lazy history, bounded prefetch và preview summary. Phần đó vẫn ở draft do chưa có Firestore thử nghiệm cô lập. Một split frontend-only được tạo từ `main` tại branch `codex/pr34-frontend-cache-first-20261030`: cache-first list/content và background revision check dùng endpoint Production hiện hành; không có API/backend/auth/config diff. Prefetch theo viewport và lazy history không nằm trong split.

Source check 49 files, offline 191/191, browser fixture 30/30 đã đạt trên candidate. Benchmark main/candidate 20 mẫu, chỉ dữ liệu tổng hợp; kết quả ở [bảng so sánh](PR35-FRONTEND-CACHE-20261030.json) và [báo cáo](PR35-FRONTEND-CACHE-20261030.md). Candidate cải thiện p95 mở note cache nhỏ 208→161 ms, note lớn 305→224 ms với bytes giảm 2.63 MB→1.44 KB, và gõ khi GET nền bị trễ 142→94 ms. Warm-list p95 315 ms chưa đạt 300 ms; cached-note p95 161 ms chưa đạt 100 ms; quick-switch p95 475 ms so với main 460 ms và p50 402 so với 345 ms. Không tuyên bố nhanh hơn Production hoặc trên thiết bị thật.

Gemini key4 trước đó không tìm thấy lỗi blocker có bằng chứng; không gọi lại vì code không đổi. Key5 follow-up review bộ đo chuyển note đã hiệu chỉnh và chấp nhận rằng regression trước bị nhiễu do 20 note vượt giới hạn cache candidate 12 note, còn main giữ cache không cùng giới hạn; metric trước cũng tính ba thao tác click harness. Bộ 20 mẫu mới, cùng ba note cache ấm: last-click→editor paint p95 43→36 ms; revision GET 60→36; lỗi 0→0. Đánh giá key5: giữ PR #35 làm candidate phát hành; chưa có bằng chứng thiết bị thật. Chi tiết ở [profile JSON](PR35-SWITCH-PROFILE-20261030.json).

CI run `40975850784` hoàn tất thành công cho exact PR head `05d21af625fd9159ac2a6c7ddc1d41fcbe10d185`, gồm source/unit và browser jobs. Không có code thay đổi trong lượt profile này.

Quyết định UX: giữ candidate frontend-only #35 vì profile ba note bằng cache ngang nhau không cho thấy regression đáng kể, đồng thời giảm request revision nền và cải thiện paint trong fixture. Các mục tiêu cache note 100 ms và list 300 ms chưa đạt; không tuyên bố nhanh hơn Production. Production giữ `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu` trong lượt này.

Tại thời điểm ghi nhận trước phát hành, không lặp lại billing query: read APIs không xác minh được plan/free entitlement; `costs_not_found` chỉ là thiếu thông tin, không phải bằng chứng có phí. Trạng thái này được thay thế sau khi chủ tài khoản xác nhận gói miễn phí; kết quả phát hành cuối cùng được ghi ở mục PR #35 Production release bên dưới. Phần API/backend mới ở PR #34 vẫn độc lập và chưa được qualify; fixture không thay thế Vercel OIDC.

## PR #35 Production release — 30/10/2026

Chủ tài khoản xác nhận đang dùng gói miễn phí, chưa có phương thức thanh toán hoặc cấu hình billing. Giữ nguyên gói; không bật billing hay dịch vụ trả phí. PR #35 được merge ở SHA `c0199c381b5deafd7a939bd405a16a71710aee32`, tree `7209ded8f307e04903a9822978300642a82d2726`; exact reviewed PR head là `8f3a75f2b09e0ee6609681e1e9549a3b4270996a`. CI run mới nhất cho PR head `40995885131` đạt source/unit và browser.

Deployment `dpl_FfQQS4gaWH5j5YYpiZJYBb7uQGXu` READY từ metadata SHA trên. Ba alias `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, `hunghvt-notes-git-main-hunghvt.vercel.app` đều được xác minh trỏ deployment này. Vercel chỉ tự gán alias chính khi deployment READY; hai alias còn lại được gán đích danh. Health GET trên cả ba trả HTTP 200 và `firestoreRead=PASS`; HTML/JS/CSS/cache/sort/sync assets trên alias chính trùng source theo SHA-256. Share link tạm để kiểm tra alias được thu hồi, protection bypass readback rỗng. Không ghi nhận lỗi quota miễn phí.

Rollback: gán lại riêng cả ba alias nêu trên về `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`, sau đó readback alias và kiểm tra health. Không đổi alias preview khác. PR #34 tiếp tục draft; backend/API mới, viewport prefetch và lazy history không được phát hành. Báo cáo đo lường, review, nguồn và giới hạn thiết bị ở [PR #35 cache-first frontend](PR35-FRONTEND-CACHE-20261030.md). Không khẳng định đạt 8/10 Google Keep hoặc nhanh hơn trên thiết bị thật; S25 Ultra/iPad chưa được kiểm thử.

## Compact responsive UI refresh — 30/10/2026

PR #38 merged as `18de3fad625210f291bb84033477307283984647`, tree `86fb335dc81573edbe3d049f5fffe002765b24be` (reviewed PR head `d38f61232b66c57cd1434debfd5f756a321f4f80`, same tree). Exact-head CI run `41007849885` passed test/source/offline/simulated-load and browser jobs. It keeps Firestore/API/auth/cache-first/save behavior unchanged; PR #34 remains draft and is excluded. The UI compacts toolbars and folder controls, improves responsive list/editor layout, and filters existing cards during search rather than rebuilding the list on each keystroke. Synthetic screenshot, tests, size comparison, Gemini coordination and limitations are recorded in [UI compact refresh report](UI-COMPACT-20261030.md).

Production is `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J` (`READY`, metadata SHA equals merge SHA). All three aliases were read back on this deployment: `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, `hunghvt-notes-git-main-hunghvt.vercel.app`. Candidate health on each: HTTP 200, Firestore native health `PASS`, `no-store`; `/`, `/app.js`, `/app.css` matched source byte-for-byte. Vercel auto-assigned only the primary alias; the other two were assigned explicitly. Temporary protected-URL share access was revoked; alias protection-bypass readback is empty. No paid service/billing change was used.

Immediate rollback: assign each of the three aliases above to `dpl_FfQQS4gaWH5j5YYpiZJYBb7uQGXu`, then verify alias mappings and health. Leave unrelated preview aliases unchanged. No physical S25 Ultra/iPad test, performance speedup, or 8/10 Google Keep claim is recorded.

## Workspace/editor redesign candidate — 2026-10-30

Phản hồi thử trên thiết bị thật cho biết bản compact PR #38 chưa đạt mong đợi. Candidate thiết kế lại workspace/editor từ main hiện hành, giữ nguyên cache-first và API/backend/Firestore/auth; chỉ thêm cấu hình chặn Vercel Preview cho branch review. PR #34 và các phần prefetch/lazy-history chưa qualify bị loại. Chưa merge/deploy; Production vẫn là `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J`. PR tài liệu [#36](https://github.com/hunghvt-cyber/web-notes/pull/36) được kiểm tra: đang mở, nội dung ghi phát hành PR #35; không chứa code UI mới hoặc bằng chứng cần nhập vào candidate.

Candidate source commit `0540d0a1faa61885243d83a178b094623bb8e6c2`, tree `52e6f5506ae34fc92df5c8ee4d9610510b2fa90e`, nhánh `ui/workspace-editor-rethink-20261030`. Xem [báo cáo, checklist, screenshot và Gemini evidence](UI-REDESIGN-20261030/REPORT.md). Screenshot CSS viewport 360×800, 390×844, 744×1133, 1133×744, 1280×720 và 1920×1080 đều dùng fixture tổng hợp. Codex đã xem ảnh; không có Notes thật.

Candidate gom trạng thái thường vào toolbar, chuyển bulk selection thành hàng ngang, sửa clipping menu bằng portal/scroll và đưa folder vào drawer dưới 1200 px. Danh sách dùng toàn chiều ngang khi không mở note; tablet/phone mở editor thành lớp rộng, PC giữ list/editor hai pane. Quick-create dùng lại editor/autosave thành bottom sheet. Bỏ custom sort/Lên-Xuống/hướng dẫn cũ nhưng giữ server order và snapshot; bỏ nút backup/lock khỏi app nhưng không đổi backup flow/API; Homepage hiện hành tiếp tục quản lý lock. Browser suite full 34/34; offline 191/191; source check 49 file; organize 4/4; simulated retry-load đạt. Trong lúc full browser chạy, phát hiện progress bar bị ẩn bởi normal-status CSS; đã sửa trạng thái busy/error và test lại. Raw/gzip tổng HTML+CSS+JS giảm 92,490→91,058 B và 24,240→23,756 B.

Trạng thái ở candidate vòng đầu, đã superseded ở vòng PR #39 mới: Folder rename **chưa có API/repository contract**; không giả lập bằng create/move/delete và khi đó được tách khỏi UI review. Phương án tối thiểu: owner-authenticated action + repository transaction rename mọi note reference, collision/snapshot/restore; hiện share target gắn tên folder nên cần ID ổn định hoặc chuyển binding atomically để giữ token/quyền/revoke. Invalidate cache folder/list cũ-mới theo revision, chống response cũ hồi sinh tên cũ. Không đổi backend trong nhiệm vụ này.

Gemini key1–3 chạy song song (tối đa 3), key4–5 review song song (tối đa 2), không lỗi/retry. Key3 xác nhận thiếu rename endpoint; key1–2 gợi ý toolbar ngang và editor layer, Codex kiểm chứng qua source/screenshot. Key4 cảnh báo aria-modal/Escape nhưng nhận định đó bị code/test bác bỏ; follow-up không có finding mới. Key5 xác nhận mapping yêu cầu/evidence nhưng nói nhầm vị trí một test và không xem pixel; Codex tự mở screenshot. Thời gian chờ batch là 17.778 giây tổng; công chuẩn bị/kiểm chứng không đo, ước lượng 45 phút, không có baseline để nói tiết kiệm. Bài học chung đã ghi vào repo canonical `hunghvt-cyber/ai-team`, nhánh `docs/gemini-coordination-lessons-20261030`, commit remote `6c3568334ee6840fe69942671927e93455716dd5`.

Candidate được giao người dùng duyệt giao diện trước khi publish; draft PR #39 mở để review. Hosted GitHub Actions run `41026303191`: `test` và `browser` success tại head `d10707fa2c4a64721a362edfe56e39706c41ee73`, tree `cc5638977b116b32d4e3d6f5f3767729f9321943`. `vercel.json` loại branch review khỏi Preview; Vercel list theo SHA/branch trả 0 deployment. Production chưa đổi. Rollback nếu sau này phát hành: gán lại cả ba alias ở mục PR #38 Production release về `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J` rồi xác minh alias/health. Chưa kiểm tra trên S25 Ultra/iPad thật; IME/bàn phím hệ điều hành chưa được thử, chỉ mô phỏng composition/typing trong Chromium.


## PR #39 — vòng sửa menu/composer và folder rename

PR #39 tiếp tục là draft, chưa merge/deploy. Production giữ `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J`; Vercel Preview branch review vẫn bị tắt. Vòng sửa mới thêm owner-only folder rename vào API/repository Firestore native, không đổi auth model. Rename trong một transaction cập nhật note refs và revision, share target, access guard và alias tên cũ; token ID/secret, permission và revoke được giữ, tokenBox dùng AAD target ban đầu qua `tokenBoxTarget`. Alias được nén trong rename nối tiếp và lưu qua snapshot/restore. Giới hạn transaction 450 writes; vượt mức hoặc mismatch guard trả lỗi mà không commit. Fixture/API tests đạt nhưng không thay thế qualification với Vercel runtime + Cloud Firestore; không promote khi chưa có bằng chứng đó.

UI đã bỏ nút tạo trùng, thay toolbar trong selection mode, gom quick composer, thêm editor PC expand, bảng folder và screenshot fixtures đa dạng. Evidence và checklist trong [UI-REDESIGN-20261030/REPORT.md](UI-REDESIGN-20261030/REPORT.md). Screenshot dùng dữ liệu tổng hợp. Offline suite 193/193, source check 49 files và full browser 34/34 pass ở local. Chưa kiểm thử S25 Ultra/iPad, IME hoặc bàn phím OS. Không có Production deploy/rollback mới.


PR #39 final candidate code verification: code SHA `a377753723c16db735e098dee03174e2af2006f5`, tree `f8953e122c9a7b2dd7e9e1cbf3dacfaed100cb3a`. Hosted Actions run `41036744748` (#502) passed `test` and `browser` on that exact code SHA. Earlier candidate runs #495–#501 exposed menu-state and portal-scroll bugs; the fix skips repositioning on scroll events originating inside `.menu-panel-portal`, opens controls from native `details.open`, scrolls to the target action and clicks the visible element scoped to the open portal. Full local browser is 34/34, offline 193/193, source check 49 files, `git diff --check` clean. No Vercel Preview or Production deployment was created; Vercel exact-SHA lookup for the code candidate returned zero.

Incremental Gemini review after the portal-scroll change: key4/key5, gemini-3.5-flash-lite, one additional call each, parallel concurrency 2, no errors/retries; observed batch wall time about 4.9 s (individual durations not recorded). Key4 raised alias ACL inheritance as a concern; source inspection verified aliases are resolved only on authenticated owner mutations inside the current vault, while share reads are bound to the renamed target/token; tests cover rename/share/read/revoke. Cloud qualification remains outstanding. Key5 matched the screenshot-path checklist against the Codex visual observations, but wrapper is text-only and did not inspect pixels; Codex opened the synthetic PNGs. No S25 Ultra/iPad physical test, OS keyboard, or Vietnamese IME test. PR #39 remains draft; Production unchanged.


## PR #39 screenshot corrections — 2026-10-30

Composer low-viewport flex sizing and folder-manager scrolling were corrected on the PR #39 draft; filtered synthetic screenshots and the focused browser evidence are in [UI-REDESIGN-20261030/REPORT.md](UI-REDESIGN-20261030/REPORT.md). Targeted Playwright case passes. The unqualified backend rename API/repository/test diff was removed from PR #39 and isolated in draft PR [#40](https://github.com/hunghvt-cyber/web-notes/pull/40). Its Firestore fake/API fixture tests pass, but Vercel runtime + isolated Firestore cloud qualification remains unavailable; the prior project/quota path was not retried, and billing/IAM/Production were left unchanged. Neither PR is merged/deployed.

Incremental review cho hai sửa PR #39: Gemini key4/key5 (gemini-3.5-flash-lite), một lượt mỗi key song song, exit 0 không lỗi; key4 gợi ý giới hạn popup theo visual viewport và fallback textarea, key5 yêu cầu evidence bounds/test chứ không suy từ ảnh. Codex áp dụng, mở screenshot thật bằng viewer và ghi chi tiết review/checks ở report. Đây không phải kiểm thử thiết bị/bàn phím OS.

Hosted verification: PR #39 code commit `3c43cf889f5a2d72bcbd54e54cb4a91635cfe4a3`, tree `be7486efe245353016da19214cf67d457dc01ae9`, Actions run [#506](https://github.com/hunghvt-cyber/web-notes/actions/runs/41039292251) passed `test` and `browser`. Separate rename draft PR #40 commit `acc5c6e04c366e3681db3a80886443c13f4d06d8`, tree `9e5eb06ca73d57915905b1f738c2c8f8b9fb6c35`, run [#505](https://github.com/hunghvt-cyber/web-notes/actions/runs/41038668746) passed both jobs; Cloud Firestore/Vercel OIDC remains unqualified. No deployment was created.


## PR #39 Production release — 30/10/2026

PR [#39](https://github.com/hunghvt-cyber/web-notes/pull/39) was approved and merged from reviewed head `300bc0180b1c172647f1db9f6e4c36afea0babce` as merge SHA `2c46ead92a06f5f0a5f09895ac3a6c2b48f77689`; tree `aee822a7617dcae15ad2537cf79407581105cd14`. Latest hosted PR-head workflow [run #513](https://github.com/hunghvt-cyber/web-notes/actions/runs/41042959470) completed successfully (test and browser jobs). No source changes were introduced between the reviewed PR head and merge tree.

Vercel Production deployment [`dpl_EvJfiw5jYps1eSmg8FChTDp72e81`](https://vercel.com/hunghvt/hunghvt-notes/EvJfiw5jYps1eSmg8FChTDp72e81) reached `READY` with metadata source SHA `2c46ead92a06f5f0a5f09895ac3a6c2b48f77689`. The verified code tree matches the merge tree above. `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, and `hunghvt-notes-git-main-hunghvt.vercel.app` all read back to this deployment. Vercel assigned the primary alias when deployment became ready; the other two were assigned explicitly. Read-only health returned HTTP 200 and `firestore-native-v1` / `firestoreRead=PASS` / `Cache-Control: no-store` on all three aliases. The served `/`, `/app.js`, and `/app.css` on all aliases matched the merged source exactly; additional cache/sort/sync assets were also byte-for-byte checked on the primary alias. The protected Git-main alias check created one temporary shareable-link bypass; it was revoked without regeneration immediately after verification. Final alias protection-bypass readback is empty. No billing, plan, or paid-service setting was changed.

Immediate rollback deployment: `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J` (the prior Production release). To roll back, assign each of the three aliases listed above to that deployment, read all three alias mappings back, then check the health endpoint. Leave unrelated aliases unchanged. PR #40 (folder rename) and PR #34 (cache/prefetch/backend work) remain draft and are not part of this release. No S25 Ultra, iPad, physical keyboard, or real-device IME verification is claimed. See [PR #39 release evidence](PR39-PRODUCTION-RELEASE-20261030.md).


## PR #41 Production release — 30/10/2026

PR [#41](https://github.com/hunghvt-cyber/web-notes/pull/41) was merged after hosted Actions run [#518](https://github.com/hunghvt-cyber/web-notes/actions/runs/41064782892) passed on reviewed PR head `35c7276d8685631e1a64f9abf671a62406276773` (test and browser jobs). Merge SHA is `322fc49a56bf43d44250cadfe19a9a2106cfb331`; merge tree `d6a80670b5496a8baf135f70493888df14ec4ffe` is identical to the reviewed PR tree. Deployment was created from a clean detached checkout at that exact merge SHA; the speed-session dirty checkout was not used. PR #34 and PR #40 were excluded and remain drafts.

Vercel Production deployment [`dpl_HL8rpL4ciJg1V4Jt3LmkkxDpUkdB`](https://vercel.com/hunghvt/hunghvt-notes/HL8rpL4ciJg1V4Jt3LmkkxDpUkdB) reached `READY`; deployment metadata records source SHA `322fc49a56bf43d44250cadfe19a9a2106cfb331`. Vercel automatically moved the primary alias when READY and initially displayed the secondary alias during initialization; final readback confirmed exactly these three app aliases on the new deployment: `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, `hunghvt-notes-git-main-hunghvt.vercel.app`. Every alias readback had an empty protection bypass object. No temporary bypass was created. The two protected aliases return Vercel Authentication redirects to anonymous NAS requests; their control-plane mapping and protection state were read back. The public primary alias returned HTTP 200 for app HTML and Firestore health. Health reported `firestore-native-v1`, `firestoreRead=PASS`, and `Cache-Control: no-store`.

On `hunghvt-notes.vercel.app`, served `/`, `/app.css`, `/app.js`, `/cache.js`, `/sort.js`, and `/sync.js` were SHA-256 byte-for-byte equal to files from the clean merge checkout. Their hashes, in that order, were `9315922f8313083e9f53c5ee134119d31a0628b673b06ce86cba8486ec089b87`, `c13f1ae7ad45ae5035556b4f5d81490095ebfbbcef1eebcce6f1a87ed5710203`, `d06025e7eabacf7d1dd3dae1f3ac90f0418285dfe0fa54dc14a6509ba9b9ad78`, `3c5d025c87a761a8bc6fd1b5b18510458e85c15b6086e00c36c048e8d165d6e1`, `e8ffeb3897734aa9a26096ce77bb4b61c13157efded278e9b337eaf728073cee`, and `2e1b16d43f2cf0a0c8b6dad44be6750478ac8e1d8984badf6c619160ea8cc77b`.

No billing, plan, IAM, environment, or paid-service setting changed. The immediate rollback target is previous Production deployment `dpl_EvJfiw5jYps1eSmg8FChTDp72e81`. To roll back, assign the three aliases above to that deployment, read back all three mappings and empty bypass state, then check `/api/app?route=health` for Firestore read PASS. No physical S25 Ultra/iPad, OS keyboard, or Vietnamese IME verification is claimed; see [PR #41 release evidence](PR41-PRODUCTION-RELEASE-20261030.md).


## PR #42 trash navigation hotfix — 30/10/2026

PR [#42](https://github.com/hunghvt-cyber/web-notes/pull/42) merged as `f2eef8490a8b9a50e3da0c987a0646e808736788`, tree `0c92a3fbe513fe46e23b492e3bd8b1f8622868f8`. Hosted CI run [#522](https://github.com/hunghvt-cyber/web-notes/actions/runs/41079573637) passed test/browser on exact head `f05e9737ede72e2035455a7266d24316876691dd`. The fix separates Trash view from normal multi-select, adds a persistent “← Ghi chú” toolbar action, and hides ordinary Move/Delete controls in Trash. It changes only frontend markup/styles/state handling and the synthetic browser test; API/backend/auth/cache/data and bottom navigation are unchanged. Local source check (50 modules), offline 191/191, focused browser flow at phone 390×844, iPad portrait 744×1133, iPad landscape 1133×744, and PC 1280×720 passed. The same focused browser test failed against the pre-hotfix source because Trash had no back-to-notes control. Fixture verified All→Trash→All, selection counts, view-note/return, empty Trash, menu/Escape/focus. No real Notes were mutated.

Production deployment [`dpl_CYyjsrnFTbUvD87w4wWF7J3VUvfX`](https://vercel.com/hunghvt/hunghvt-notes/CYyjsrnFTbUvD87w4wWF7J3VUvfX) reached READY with metadata source SHA `f2eef8490a8b9a50e3da0c987a0646e808736788`, built from a clean detached checkout. All three aliases `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, and `hunghvt-notes-git-main-hunghvt.vercel.app` point to it; alias control-plane readback showed empty protection bypass state and no temporary bypass was created. The public primary alias returned HTTP 200 Firestore native health PASS with `Cache-Control: no-store`; six app assets on that alias matched the release checkout by SHA-256. The other two aliases require Vercel Authentication for anonymous requests; their mapping/protection state was verified through Vercel readback. Detailed hashes and evidence: [PR #42 release record](PR42-PRODUCTION-HOTFIX-20261030.md).

Rollback target: previous Production deployment `dpl_HL8rpL4ciJg1V4Jt3LmkkxDpUkdB`. To roll back, assign each of the three aliases above to that deployment, read back all three mappings and empty bypass state, and check `/api/app?route=health` for Firestore PASS. No billing/plan/IAM/env changes. No physical iPad/phone test was performed.

Speed-session handoff: the existing worktree `notes-speed-no-persistent-drafts-20261029` was observed dirty (including `public/app.js` and `public/cache.js`) and left untouched. It is behind current `main` and overlaps this hotfix in `public/app.js`. Before a later speed release, reconcile with `main` at `f2eef8490a8b9a50e3da0c987a0646e808736788`, review the overlap, then rerun relevant checks; do not deploy its stale tree as-is.

## PR #43 — diagnostics and responsive UI Production release — 31/10/2026

PR [#43](https://github.com/hunghvt-cyber/web-notes/pull/43) merged at `b3a4de5b7a86d3adc95ab4064de5c0a9cdddb249`, tree `49b1392155a735500fa6a7771ad585aba6c8931f`. Hosted CI run [41180959356](https://github.com/hunghvt-cyber/web-notes/actions/runs/41180959356) passed test and browser. Production deployment `dpl_6JvV65W8wi6AQgyNfbUfA7gjC5LJ` reached READY from that exact source SHA. All three Notes aliases point to it; bypass state is empty. Read-only health reports Firestore PASS. The immediate rollback target is PR42 deployment `dpl_CYyjsrnFTbUvD87w4wWF7J3VUvfX` (source `f2eef8490a8b9a50e3da0c987a0646e808736788`).

Local verification: 199/199 offline tests, 39/39 Chromium browser cases, source check 50 files, and grid smoke 360/390 px passed. Synthetic screenshots reviewed; no physical-device check is claimed. The deployment used the exact 38 runtime/config files from the merged tree because the Vercel project is not Git-connected. Full asset hashes, alias readback, health evidence, and rollback procedure: [PR43 Production release record](PR43-PRODUCTION-RELEASE-20261031.md). This runbook-only update is after the deployed code SHA and does not change the running source.


## Performance investigation candidate — 31/10/2026

Current production remains PR #43 deployment `dpl_6JvV65W8wi6AQgyNfbUfA7gjC5LJ`, source `b3a4de5b7a86d3adc95ab4064de5c0a9cdddb249`, READY. The current candidate is isolated from the dirty original worktree and is not merged or deployed. PR #34 cache/prefetch and PR #24 read batching remain unqualified and are excluded.

Code confirms that a full note is placed in `contentCache` only after a successful server GET. Persisted content is read only from the authenticated `cacheScope`; reuse requires the note ID and revision to exactly match the list row. A server list refresh prunes content when the row is absent or revision differs. The existing per-note size is UTF-8 bytes of `JSON.stringify(note)`, so it includes `history`, `checklist`, title, text and any present metadata. Current limits remain 12 notes, 1 MiB aggregate, 256 KiB per note. Oversized notes are intentionally omitted; an entry can also be evicted by count/aggregate limits. This explains possible repeated misses but does not establish the reason for the reported old note: its cache size, persisted cache entry and list revision at each open were not captured. For a small clean note, in the same page and unchanged revision, the cache code should reuse the entry; a repeated miss then points to invalidation, eviction or cache read availability and will be distinguished by the new enum diagnostics.

On the API path, the handler validates the session, constructs/reuses the Firestore store client, then calls `FirestoreNativeStore.get()` into one Firestore transaction. The repository reads vault metadata, note metadata and up to six complete version documents; small versions contain payload in the document, and the code reconstructs the current version plus up to five history entries. Chunk documents are read in parallel when required. A known-revision request returns after vault/note metadata checks without loading version contents. Full history adds query/payload work, but current measurements do not attribute the 2.38–6.02 seconds to history or Firestore. Source shows this sequence and the retry bound (`maxAttempts: 5`), but it does not show which step consumed the delay. Client `network_ms` ends at response headers and includes Vercel/server/network time; `response_body_ms` includes receiving body bytes and JSON parsing. Opt-in response timing adds handler pre-response, auth, store initialization and store-operation durations on that same request. The pre-response span excludes JSON serialization and platform queue/cold-start time. The store-operation span includes lazy Vercel OIDC token acquisition, Google auth/Firestore SDK work and the Firestore operation; it does not split those components. See [diagnostics details](PERFORMANCE-DIAGNOSTICS-20261031.md).

Candidate adds fixed cache-miss reason counts and opt-in Server-Timing durations only when diagnostics are active; it adds no endpoint/request, logs, third-party telemetry or persistent draft access. Per-note diagnostic reason bookkeeping is in RAM and capped at 64 IDs; exported samples retain only allowlisted reason counts/durations. Cache/persistent draft behavior, auth, CAS, exact operation retry, ACK and Firestore authorization remain unchanged. Synthetic browser fixture covers small content, oversized current text, large history, reopen and interleaved list refresh. Fixture results cannot qualify Vercel OIDC/Cloud Firestore or prove device latency.

No real Notes were read; no Production writes, billing changes, IAM/WIF changes or deployments were made. No post-change S25 Ultra/iPad measurement is available and no speedup claim is made. Draft PR, source tree, exact CI result, Gemini review and rollback context are recorded in [performance investigation report](PERFORMANCE-INVESTIGATION-20261031.md) after hosted verification completes.

