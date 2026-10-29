# Notes vận hành — 28/10/2026

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

Gemini key4 không tìm thấy lỗi blocker có bằng chứng; key5 khuyến nghị đợi full CI và nhấn mạnh các mục tiêu cache chưa đạt. Tại thời điểm ghi nhận chưa có merge/deployment. Giữ Production như cũ. Chỉ phần API/backend mới trong PR #34 còn cần cloud qualification; fixture không thay thế Vercel OIDC.
