# Historical Notes sections moved from ai-nas-lab/main

This is historical handoff. Current operational status: see ../../OPERATIONS.md.
Source main CURRENT-STATE.md blob c30e1b3e53e8c598c049742d5d81b05d010cb680.

## Notes speed research — 27/10/2026

Đã đọc AI NAS Lab handoff và `Hunghvt-notes` nhánh `release/minimal-notes` tại
`ee5d75f5795bf2ce79971c7a3dfe772119ad6d1a`. Gemini được gọi trực tiếp qua
`gemini-task` một lần bằng `key1` / `gemini-3.5-flash-lite`; Codex đã kiểm chứng
phản biện với code và fixture. Không đọc Notes thật, không benchmark production,
không deploy hoặc đổi cấu hình.

Code cold-open hiện tại gồm 7 WebDAV call tuần tự; known-revision 3. Owner API
còn kiểm Homepage auth version mỗi request. Agent WebDAV `maxSockets:1` thuộc
mỗi request và bị destroy cuối request, không phải global queue. Fixture local
xác nhận candidate owner single-lease là 4 call nhưng làm writer đồng thời nhận
423 cho tới khi unlock. Chưa có số đo cold-open hoặc p50/p95 production; chỉ có
smoke save lịch sử 3.025–7.400 giây, không áp làm kết quả hiện hành.

Giữ Koofr + Vercel, draft/CAS/fencing/idempotency/live ACL và xác nhận lưu.
Ưu tiên đo riêng auth và WebDAV trên preview namespace tổng hợp trước khi quyết
định thử candidate 4-call; chưa deploy/benchmark preview. Báo cáo, nguồn và test
chi tiết: [research/notes-speed-results-20261027.md](research/notes-speed-results-20261027.md).

### Notes owner-open experiment preparation — 27/10/2026

Prepared local-only branch `codex/notes-owner-open-experiment-20261027` in
Hunghvt-notes; no Preview deploy, Koofr namespace/data, or production access.
Added opt-in Preview-only owner single-lease read, sanitized auth/WebDAV phase
telemetry, a fixture comparison script, and concurrency/redaction tests. Share
reads and writer/draft/CAS/fencing/ACL/idempotency paths stay on the current
protocol. Node 24 suite: 147/147 passed; fake 5 ms/call fixture: owner cold-open
p50/p95 47/57 ms current vs 27.1/33.1 ms candidate. In forced owner/share
contention, current got 0/1 save 423s; candidate got 1/2 attempts 423 and added
1,000 ms virtual retry delay. These numbers are synthetic and do not justify
deployment; retain current default pending real isolated Preview results.

Final Notes commit `8c75625f1756ddac91a766071557eb7c0afefcc7`, checkout
`/home/admin/Hunghvt-notes`. Branch is not pushed because Vercel automatic Preview
behavior was not verified. Real measurement still needs a dedicated lab Preview
target/authorization, Preview-only session and Koofr credentials, and a fresh
synthetic namespace. Existing Preview auth is local/synthetic and cannot time
the Homepage auth hop; that requires a separately approved synthetic auth source
or explicitly authorized safe measurement. See
[research/notes-speed-results-20261027.md](research/notes-speed-results-20261027.md).

## Notes Firestore exploration — 27/10/2026

Checked the NAS shell: no Firebase CLI, gcloud, Java, ADC config, or Google Cloud
project variables; no suitable cloud session was verifiable. RAM available was
about 2 GiB, system volume had about 1.4 GiB free, and port 8080 was already in
use. A temporary Java 21 download was canceled due very slow transfer before
install; no emulator started and no system packages/services changed.

Prepared a dependency-injected Firestore compatibility transport, chunk/hash
storage, lock/fencing adapter tests, demo-only emulator config guarded on
loopback:8089, and smoke runner. Koofr remains active; `api/app.js` does not
select Firestore. Node 24 full tests: 154/154 pass, all against the existing
suite plus an in-memory Firestore-compatible fake. **No real Firebase emulator,
cloud permission, Firestore database, billing, migration, or deployment has been
verified or used.**

Gemini advised a direct Firestore repository as the cleaner permanent design;
Codex keeps the adapter as a limited parity prototype to reuse existing CAS,
ACL, fencing, idempotency and recovery logic while the backend stays disabled.
The fake does not establish Firestore transaction behavior or latency. Vercel
OIDC federation is officially supported as a no-long-lived-key auth path, but
needs an existing GCP project administrator to set up IAM/WIF and a service
account. Details and mobile console links:
[research/notes-firestore-20261027.md](research/notes-firestore-20261027.md).

Notes commit `8e6d0dbfe63396fa2fc5b1e8c7e707a7db3cb66a` is local on branch
`codex/notes-owner-open-experiment-20261027` at `/home/admin/Hunghvt-notes`.
Nothing is pushed or deployed from Hunghvt-notes; do not migrate or create a cloud database
until emulator parity, project authorization and cost/rollback are reviewed.

### Native Firestore repository direction — 27/10/2026

Continued on local branch `codex/notes-firestore-native-20261027`; compatibility
adapter remains unchanged and Koofr remains active. Added an unwired native
repository prototype and architecture/cost handoff in `Hunghvt-notes` and this
repo’s `research/notes-firestore-20261027.md`. Focused Node 24 tests pass 8/8
against an in-memory fake only; no emulator/cloud proof. Native code covers
per-note CAS, idempotent saves, shared authorization/revoke, version history,
chunk/hash validation and Inbox share guards. Folder/order/trash/purge and
backup parity are not implemented yet and block integration. Gemini critique
was one filtered advisory; Codex corrected unsupported fixed 1-write/sec and
500-total-op claims against current official docs.

No gcloud/firebase CLI or ADC was present in the checked NAS shell. Least-work
cloud path is a synthetic namespaced probe from Cloud Shell on phone/iPad,
using an existing authorized dedicated non-production project/database plus
`roles/datastore.user` (project-level access); NAS ADC and Vercel production
OIDC are separate setups. No billing, database, cloud
call, migration, or deploy occurred. Full repository tests could not load six
files because `iron-session` is absent; existing fixture cleanup reported only
39 allowlisted synthetic folders removed and production root unchanged. Details
and official links: `research/notes-firestore-20261027.md` and
`Hunghvt-notes/docs/firestore-native-design.md`.

### Isolated Cloud Shell smoke ready — 27/10/2026

Updated Hunghvt-notes branch `codex/notes-firestore-cloudshell-20261027`, commit
`ebd704d3a149f5756dbc8b9a41eda5f326efe09b` (GitHub). `npm ci` with the committed
lockfile succeeded under Node 24; the repository's default test command now
uses an offline harness that strips Koofr/OIDC configuration and blocks network
requests outside loopback. Local Node 24 suite passed 163/163, and GitHub Actions
was running the branch CI at handoff. Vercel's exact-branch auto-deploy flag is
disabled; Vercel returned zero deployments for that branch. No Cloud Firestore
probe has run yet.

For the smallest cloud check, use an already existing dedicated non-production
project with default Firestore Native DB and a user granted `roles/datastore.user`.
On phone/iPad choose it in [Google Cloud Console](https://console.cloud.google.com/),
open [Cloud Shell](https://shell.cloud.google.com/?show=terminal), and paste the
fully prepared single command in `Hunghvt-notes/docs/FIRESTORE-CLOUD-SMOKE.md`.
It downloads Node 24 only under `/tmp`, uses the selected `gcloud` project and
Cloud Shell human auth, creates one random synthetic note/share, measures
owner/save/CAS/share/revoke, then removes those exact documents. It will not
create a project/database or enable billing. This path is separate from NAS ADC
and Vercel production OIDC. See the branch's smoke guide; no secret or credential
is needed in chat.

### Native Firestore integration prepared — 27/10/2026

Supersedes the Cloud Shell-only smoke instructions above for the next step: the
user asked to avoid Cloud Shell and result relay. On NAS, installed official
Google Cloud CLI 590.0.1 for Linux ARM64 under
`/home/admin/.local/opt/notes-google-cloud-cli`; the downloaded archive SHA-256
matched Google's published checksum. Wrapper `/home/admin/bin/notes-gcloud`
uses only its isolated config home at
`/home/admin/.local/state/notes-gcloud-home/.config/gcloud`. No ADC/account
credential exists there yet, and no Gemini or other app credential was read.

Hunghvt-notes safe branch
`codex/notes-firestore-cloudshell-20261027` now contains native Firestore
repository/runtime integration, explicit backend selection (Koofr remains the
default), migration/verification/rollback tooling, and integration tests.
GitHub commit: `4ef6be251dde9692f18b0b0f7364b7acebc5d5d4`. Full offline Node 24
suite: 169/169 pass. The tests use in-memory fakes and prove application
invariants only; they are not evidence of Firestore cloud behavior. No deploy,
billing change, real-note access, or migration occurred. Release branch was not
changed. Gemini reviewed a filtered technical summary once; its concern about
the old 500-write cap was stale, while the review highlighted share/folder/purge
race cases now covered by checks or documented as migration gates.

The Cloud Firestore smoke runner is prepared for project
`notes-lab-56f0f`, with random isolated vault names and cleanup scoped to those
two exact vaults. It exercises init, save/open, CAS, share/revoke, folder
deletion, trash/restore, backup/restore and purge. Required real-cloud proof is
still blocked by missing NAS ADC. To authorize just this NAS-only check, run the
following in an interactive NAS terminal, open Google's URL on the phone, sign
in to an account granted `roles/datastore.user` on the test project, then paste
the one-time code only into that terminal (never into chat):

```sh
/home/admin/bin/notes-gcloud auth application-default login --no-launch-browser --disable-quota-project
```

This creates ADC only in the isolated Notes gcloud config. It does not set a
quota project, enable billing, use Cloud Shell, or configure production Vercel
OIDC. Afterward Codex can run and inspect the cloud smoke itself; the user need
not relay output. Cloud authorization and a successful real smoke are still
unverified. See `research/notes-firestore-implementation-20261027.md` and the
Hunghvt-notes branch documents `docs/FIRESTORE-NATIVE.md` and
`docs/FIRESTORE-CLOUD-SMOKE.md`.

### Real Firestore smoke complete — 27/10/2026

The user completed the isolated NAS ADC sign-in. Codex ran the smoke directly
against `notes-lab-56f0f` / `(default)`; it returned `PASS` for init, owner
save/open, known-revision read, CAS conflict, share/open/revoke, folder delete,
trash/restore, snapshot count/hash restore and purge. Both synthetic vault roots
were deleted and an independent read confirmed they are absent. This was a real
Firestore API test, not an offline mock. One run's end-to-end operation timings
are recorded in Hunghvt-notes `docs/FIRESTORE-NATIVE.md`; they include network
overhead and are not a benchmark.

The first real attempts found and fixed two defects missed by fakes: first save
into a new folder used its timestamp before initialization, and backup refused
a completed folder-deletion tombstone as if work remained in progress. Both have
regression tests. A later artifact review found the published source and lockfile
had been clipped by output capture; that specific published artifact was not
valid and must not be used. It is now repaired and verified as described below.
No release branch, production deployment, Koofr data, billing, or real Notes
migration was touched.

Implementation and migration/rollback are prepared for review, not activated.
Production still needs a reviewed Vercel GCP Workload Identity Federation
configuration, exact project/service-account IAM, and production switch approval.
The current Koofr snapshot export limit remains 2 MiB; larger real data requires
a streaming snapshot export before migration. No production data size was read.

### Published source repair verified — 27/10/2026

The source-integrity review was correct: remote commit `6dc6d18` contained a
truncated `lib/firestore-native-repository.mjs`; inspection also found the
published `package-lock.json` was clipped. Both full files were restored from
verified local versions. Candidate [commit `082824c`](https://github.com/hunghvt-cyber/web-notes/commit/082824c51f305a9c94ecdea6aafb9a479a4ccf5e)
is now remote HEAD of the same safe branch.

From a fresh checkout of that exact commit on Node 24.22.1: syntax check passed,
marker scan found no hits in 124 tracked code/docs/config files, `npm ci`
installed 143 packages, full `npm test` passed 170/170, and the isolated real
Firestore smoke passed all 11 checks. A separate read confirmed both synthetic
vault roots were removed. Git blob hashes match the tested checkout:
repository `3454137816de08aaf9e7ab302c37b4f9ae1d9aea`, lockfile
`8c4e1c62ffba93eb05f2b1bf1eecbdfd0a848892`. WIF/deploy/migration remain paused;
Koofr production is unchanged. Details are in
`research/notes-firestore-published-source-review-20261027.md`.


## Firestore Vercel preparation — 2026-10-27

Prepared test-only WIF/IAM in `notes-lab-56f0f`: exact Vercel Preview subject, team audience, no user-managed SA keys; IAM readback passed. Vercel branch-scoped Preview env creation is blocked because project `hunghvt-notes` is not connected to Git. No environment variables, deployment, billing or production data were changed. The required owner action is to reconnect it to `hunghvt-cyber/Hunghvt-notes`; then Codex can finish a branch-scoped synthetic Preview check.

Migration review confirms Koofr export stops at 2,000,000 bytes. No real Notes snapshot was inspected. If exceeded, stop before import until a bounded streaming exporter is implemented. Rollback plan freezes writes, exports current Firestore state and restores it to a fresh Koofr namespace, preserving post-cutover edits and verifying hashes before switching. Details: `research/notes-firestore-vercel-migration-review-20261027.md` and Notes candidate `docs/FIRESTORE-VERCEL-MIGRATION-REVIEW.md`.


## Vercel per-deployment Preview attempt — 2026-10-27

New path checked separately from the previous branch-scoped env attempt. Official CLI v65.4.0 help confirms `--env KEY=VALUE` and explicit `--environment preview`, but secret values would be process arguments, so none were passed. CLI auth check returned `loggedIn:false`; harmless dry-run failed with `You do not have access to the specified account` for scope `hunghvt`. Vercel REST API v13 documents no per-deployment env body field. No deployment or environment mutation occurred; WIF unchanged. Minimum next step is authenticate local Vercel CLI for team `hunghvt` (device/browser flow); no Git linkage is required for this CLI path. Details: `research/notes-vercel-per-deployment-env-20261027.md`.


## Direct Vercel Preview → Firestore verified — 2026-10-27

The previous branch-scoped project env attempt remains blocked by absent Git linkage, but a separate direct CLI deployment now works without linking Git. Authenticated Vercel CLI 65.4.0 deployed exact candidate commit `082824c51f305a9c94ecdea6aafb9a479a4ccf5e` to `hunghvt-notes` with explicit `--environment preview` and a 0600 external `--local-config` runtime env file. No secret was placed in argv, Git or emitted logs; temporary files were removed. No shared Preview variable or Production setting changed.

Deployment `dpl_H1L38KavsPzE4CbYnpSetZUGnW38` is READY, target Preview (`target:null`), no aliases: https://hunghvt-notes-7akbwqjy0-hunghvt.vercel.app. Readback confirms exact existing Vercel OIDC issuer/audience/subject. Live health, login, Firestore create/read, trash and purge all passed. The synthetic note is purged; the dedicated test vault has no active/trash note data. Two earlier trial deployments were deleted. Production remains Koofr and untouched. Details: `research/notes-vercel-direct-preview-firestore-result-20261027.md`.
