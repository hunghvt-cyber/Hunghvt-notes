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

## Historical candidate: cache-first trước tải theo viewport — superseded 2026-10-29

Ghi chú: đoạn dưới ghi snapshot PR #34 trước khi chuyển sang tải trước theo
viewport. Các con số/hành vi `first 8`, `2 note/phiên` và phép đo rapid switch
chỉ mô tả snapshot lịch sử; candidate hiện hành và trạng thái phát hành nằm ở
phần [viewport-driven prefetch follow-up](VIEWPORT-PREFETCH-20261029.md).

Đây là số liệu bàn giao lịch sử của candidate trước trên nhánh
`codex/cache-first-note-cache-20261029`, bắt đầu
từ `main` tại `d735659d1457f5aa2144ed45fb1aaa9ca07ec495`. Chưa merge và chưa
deploy. Dữ liệu IndexedDB dùng để cache chỉ là snapshot đã được server ACK,
scoped theo auth; client xác thực trước khi đọc, hiện bản cache với trạng thái
chưa kiểm tra, rồi đối chiếu revision. Cache không cấp quyền. Draft chưa ACK
chỉ ở RAM; database draft legacy không được mở, di chuyển hay xóa. Giới hạn
cache hiện hành là 12 nội dung, 1 MiB tổng nội dung, 256 KiB mỗi note và tối
đa 1.000 hàng danh sách/512 KiB.

Candidate đọc nội dung hiện tại mà không tải history; history chỉ tải khi
người dùng mở mục lịch sử. Prefetch chỉ xét một số note đầu danh sách, tối đa
2 note/phiên auth, tuần tự, và bỏ note trên 64 KiB trước khi đọc chunks.
Firestore native, CAS, ACK, `clientOpId`, retry và ACL không bị bỏ qua.

So sánh 20 mẫu mỗi trường hợp bằng Chromium headless trên NAS với fixture
tổng hợp, không có Notes thật: warm list 293.4/371.6 → 271.5/293.4 ms p50/p95;
cached small note 142.5/194.3 → 140.3/174.3 ms; cached 128 KiB note
234.2/269.9 → 204/231.2 ms; typing khi revalidation trễ 120 ms
73.8/101.1 → 70.6/87.1 ms; quick switch trễ 120 ms
348.7/390.9 → 521.7/552.6 ms. Cold-cache list p95 tăng 381.5 → 398.1 ms.
Đọc cached large note giảm 2,625,940 xuống 1,440 response bytes/20 lần;
warm list dùng thêm prefetch giới hạn (26 prefetch request/20 lần). Vì mở note
còn trên 100 ms và quick switch chậm hơn fixture baseline, không kết luận app
đã nhanh hơn tổng thể hay đạt trải nghiệm 8/10. Xem [bảng số đo đầy đủ đã
lọc](CACHE-PERFORMANCE-20261029.json).

Offline/source/browser tests chạy local bằng Node 22.23.4. Candidate được lưu
trong PR draft [#34](https://github.com/hunghvt-cyber/web-notes/pull/34).
GitHub CI run [40891155789](https://github.com/hunghvt-cyber/web-notes/actions/runs/40891155789)
đạt cả test và browser trên Node 24 cho candidate commit
`80439c206bc8b8021e2f1cb08d3afed4e39a0bae`, tree
`85ac693dab747d5f9a10d4adb6a66c7ac6e12d8f` (khớp tree candidate local).
PR head sau cập nhật hồ sơ là
`9ca07c08fc272f45a662e3a2deadb22fc194e014`, tree
`79a747ae6f4c1c70b293f6a000ddd4e63bb7cde3`. Workflow
[40891609172](https://github.com/hunghvt-cyber/web-notes/actions/runs/40891609172)
đạt cả hai job ở attempt 2 trên exact head này; attempt 1 có browser flake ở
keyboard focus của menu backup (`#backup`), job test đạt. Không có code đổi
giữa hai attempt; rerun browser job đạt.
Vercel Production chưa được qualify cho candidate. Cloud gate còn thiếu là
đường đọc note/history qua Firestore thật bằng Vercel OIDC với vault thử cô
lập và dữ liệu tổng hợp. Không dùng Production Notes/session để thay thế và
không promote alias cho tới khi có bằng chứng an toàn cho đường đọc đó.
Health-only probe không chứng minh API đọc note. S25 Ultra/iPad thật chưa
được đo; deployment/rollback hiện tại tiếp tục là bản cũ.

## Tải trước theo viewport — 2026-10-29

PR #34 vẫn draft. Candidate thay danh sách cố định đầu trang bằng
`IntersectionObserver`, ưu tiên hướng cuộn, concurrency 1 và đợi tối đa 80 ms
trước request nền để thao tác cuộn kịp đổi vùng ưu tiên. Giới hạn 40 lần bắt
đầu/768 KiB prefetch mỗi phiên; bỏ body trên 64 KiB, không tải history. Cache
đã ACK vẫn giới hạn 12 note/1 MiB tổng/256 KiB mỗi note. Open/save không xếp
sau prefetch; click cùng note đang tải dùng lại request đó. Sửa nội dung hủy
prefetch và stale response phải khớp request/session/note.

Preview 200 ký tự tiếp tục lấy từ query metadata/list được phép đọc. Số lần
Firestore document read không đổi; metadata, response và lần ghi note sau này
có thêm bytes. Preview cũ không được migrate hàng loạt. Không đọc, di chuyển
hoặc xóa database draft cũ; nội dung chưa ACK chỉ ở RAM.

Đo main/candidate bằng Chromium headless/NAS, 20 mẫu mỗi case với fixture
Firestore-compatible trong RAM, không dùng Notes thật. Main/candidate p50/p95:
list cold 341.6/413.9 → 305.0/345.8 ms; list warm 283.1/332.8 →
275.5/332.8 ms; cuộn tới preview 109.0/131.6 → 113.3/136.1 ms; mở note
chưa cache 217.7/265.4 → 195.8/240.9 ms (candidate tắt prefetch); mở cached
note sau reload 150.7/186.5 → 120.8/295.1 ms; gõ khi revalidation trễ
73.2/85.2 → 74.6/403.0 ms; chuyển nhanh ba note 340.0/778.5 →
268.6/391.1 ms. Đuôi latency biến động, không khẳng định tăng tốc tổng thể.
Riêng candidate: click-to-paint note đã prefetch 22.6/29.0 ms và click khi
request đang chạy 60.3/74.5 ms; broad action wall-time lần lượt p95 127.9 và
154.4 ms. List-only cold/warm có 35/26 prefetch response, 9,680/4,325 bytes;
không có note click trong chính các cửa sổ đo đó. Đây là traffic suy đoán trong
cửa sổ thao tác, không khẳng định không dùng về sau. Xem [báo cáo đã lọc]
(VIEWPORT-PREFETCH-20261029.md) và [JSON](VIEWPORT-PREFETCH-20261029.json).

Source check đạt; offline 193/193; browser 33/33; retry/load harness mô phỏng
đạt. Gemini key1–3 phân tích độc lập; key4/5 review bản cuối. Chi tiết nhận/
bác bỏ có trong báo cáo. Vercel OIDC chưa có Preview scope/vault cô lập; không
thực hiện note/history read trên cloud. Không deploy, không đổi alias/bypass,
không bật billing. Production và rollback giữ nguyên; S25 Ultra/iPad chưa đo.
Không tuyên bố đạt 8/10 Google Keep trước người dùng đánh giá.

Candidate cuối được lưu tại commit `f4408dcc285484401773af100302d5050519b9ec`,
tree `8cd0526e79265507f3785fd0948df1dc5055c34b`. GitHub Actions run
[40906542285](https://github.com/hunghvt-cyber/web-notes/actions/runs/40906542285)
đạt cả `test` và `browser` trên exact commit này. PR #34 vẫn draft. Đây là
CI/source evidence, không thay thế cloud OIDC qualification hay phép đo trên
thiết bị thật.

Sau đó chỉ cập nhật hồ sơ release: PR head
`c850f4ce070631569c71b003c4c2d12af877e0be`, tree
`a20806fcc1dde1e92b2f155d38773dd609846a43`; CI run
[40906908055](https://github.com/hunghvt-cyber/web-notes/actions/runs/40906908055)
đạt `test` và `browser` trên exact head. Production readback ngày 2026-10-29
giữ deployment `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`, SHA
`7991b8045f36835dc8e69f829c5399a4ac31d4ec`. Ba alias hiện hành:
`hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`,
`hunghvt-notes-git-main-hunghvt.vercel.app`; alias readback không có bypass.
Rollback target vẫn `dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst` (SHA
`96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a`). Không có deployment mới hay
thay đổi alias trong nhiệm vụ này.

### Follow-up typing profile và cloud gate — 30/10/2026

PR #34 vẫn draft; Production tiếp tục giữ deployment `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`. Profile tổng hợp chuẩn hóa click → nội dung hiện/editor dùng được (2 animation frames), đo revision nền riêng và profile từng input event. Main/candidate cùng fixture Chromium headless/NAS, 20 lần mỗi điều kiện; kết quả và giới hạn tại [typing profile](TYPING-PROFILE-20261030.md) và [JSON](TYPING-PROFILE-20261030.json). Candidate click p95 95 ms, revision p95 160.9 ms; input-to-two-frame p95 29.9 ms, handler p95 0.1 ms. Không thấy long task, cache put, prefetch HTTP hoặc DOM subtree replacement khi gõ. Playwright 403 ms cũ không tái hiện (cùng End+x replay p95 83.23 ms), nhưng nguyên nhân outlier chưa chứng minh. Đây không phải phép đo thiết bị thật.

Gemini key4 (`gemini-3.5-flash-lite`) review profile/source: giữ nhận định chưa có dấu hiệu app task cần sửa; hạ mức kết luận rằng 403 ms chắc chắn chỉ là measurement noise. Key5 cùng model xác nhận mốc benchmark và giới hạn headless/n=20; bác bỏ nhận định Git/custom domain là blocker bản chất bằng bằng chứng direct deployment lịch sử. Chi tiết có trong report.

Cloud read-only: WIF pool `vercel-notes-preview` state ACTIVE nhưng `disabled: true`; provider subject đúng Preview environment; Preview service account tồn tại nhưng không có binding, và không có `roles/datastore.user` cho identity này. `notes-gcloud` không có active CLI account, nhưng IAM API read-only qua dedicated ADC trả HTTP 200; không mutation. Quyền Firestore hiện khả dụng theo database, không theo vault. Vercel CLI không cài; MCP đọc được project/deployment metadata nhưng không liệt kê environment variables. Không tạo deployment/vault hoặc thử Firestore read khi OIDC bị disable. Cần cloud owner khôi phục Preview WIF/SA binding theo database scope được duyệt, cung cấp công cụ xác minh env OIDC, rồi chạy read/revision/lazy-history/auth/cleanup với vault tổng hợp. NAS ADC/fixture không thay thế gate. GitHub Actions [run 40921433107](https://github.com/hunghvt-cyber/web-notes/actions/runs/40921433107) đạt `test` và `browser` trên exact PR head `ba362b86446499bca55131bcfe7b414f72ddd97d`, tree `19c5a6aed35be32fade69c00a9e55a14b868141f`; CI không thay thế cloud qualification. Production, aliases và rollback giữ nguyên; không bật billing hay nới quyền.
