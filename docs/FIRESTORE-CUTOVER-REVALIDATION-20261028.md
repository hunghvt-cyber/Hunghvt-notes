# Firestore cutover revalidation — 2026-10-28

Filtered status update. No note bodies, snapshots, credentials, or provider response payloads are included. No alias, deployment, environment variable, namespace, or Notes data was changed.

## Current source and deployment metadata

- Canonical repo is `hunghvt-cyber/web-notes`; current source selector is [`lib/app-config.mjs`](https://github.com/hunghvt-cyber/web-notes/blob/main/lib/app-config.mjs), blob SHA `d496bfefdb1a59d1cdf589dc5d8a48feb7cf30ad`. It selects Firestore only when `NOTES_BACKEND=firestore-native-v1`; otherwise the Koofr `NoteStore` is selected.
- Firestore runtime source [`lib/firestore-runtime.mjs`](https://github.com/hunghvt-cyber/web-notes/blob/main/lib/firestore-runtime.mjs), blob SHA `e695ef0e99c69156314083f4acbdd2571e54af1f`, requires an explicit Vercel OIDC external-account config without a credential file.
- Read-only Vercel metadata: primary alias `hunghvt-notes.vercel.app` still targets READY `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; secondary alias `hunghvt-notes-hunghvt.vercel.app` still targets READY legacy `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B` / immutable host `hunghvt-notes-de329dlyt-hunghvt.vercel.app`.
- Current project-level Production metadata includes Notes mode/project/namespace/base URL, Homepage auth and session configuration, and legacy Koofr variable names. Sensitive values were not fetched. Metadata does not include `NOTES_BACKEND`, `NOTES_FIRESTORE_PRODUCTION_REVIEW`, `NOTES_FIRESTORE_PROJECT_ID`, `NOTES_FIRESTORE_VAULT_ID`, or `NOTES_FIRESTORE_WIF_CONFIG`. This metadata is not a readout of an existing deployment's captured environment. Therefore it does not identify which backend the primary deployment currently uses.
- The historical cutover record reports a working Vercel production WIF identity and Firestore smoke. It is historical evidence and does not itself validate any new deployment.

## Current-data evidence and parity

The last verified Koofr source snapshot is the cutover baseline dated 2026-10-27 18:11 VN: 28 notes (6 active, 22 trash), 2 folders, 11 shares, 24 receipts, zero erased tombstones, fingerprint `63ae5286e861ee8684d86f6b3db55f354b2e43e60f096508d10797e6f8218c6f`. Its private gzip copy remains on the NAS with matching recorded SHA-256. It is not a current Koofr export.

The successful Firestore backup/readback on 2026-10-28 captured 32 notes (5 active, 27 trash), 2 folders, 11 shares, 36 receipts, zero erased tombstones, fingerprint `525b16af87a11ff9fa690be6daf819475b79202e90819325ec73c8ff34011131`; restore qualification matched that snapshot. This newer Firestore snapshot does not establish current Koofr state or prove the runtime app uses Firestore.

Counts/fingerprints differ across the historical Koofr checkpoint and current Firestore backup. A timestamp-only winner or whole-vault overwrite is unsafe. The current exact Koofr namespace must be freshly exported under a read freeze and compared field/history/tombstone-wise with Firestore before planning any merge. Preserve both snapshots and do not import either over the other until that comparison is complete.

## Gemini independent review

A single filtered review used the existing NAS wrapper, model `gemini-3.5-flash-lite`; no Notes or snapshots were sent. Gemini identified blind cutover, datastore mismatch, auth/secret configuration, and reachable old writer as critical risks. It recommended verified current Koofr export, tombstone-preserving merge, synthetic isolated-vault tests, and dependency checks before deletion. Codex accepts these sequencing gates. This review is advice, not runtime evidence or authorization.

## Status / blocking gates

- No new deployment was staged: this session verified source and environment metadata but did not have a reviewed artifact plus verified current source export and a no-split-brain writer isolation plan to release safely.
- No final dual-source snapshot, cross-source parity/merge, independent new baseline upload/readback, new deployment runtime checks, or post-cutover backup/restore run was performed.
- Manual backup and restore run [40637421409](https://github.com/hunghvt-cyber/web-notes/actions/runs/40637421409) / [40637491951](https://github.com/hunghvt-cyber/web-notes/actions/runs/40637491951) remain PASS for the Firestore snapshot above; neither proves cron execution.
- Both aliases, both deployments, both data sources, all auth/session material, history, trash, shares, receipts, tombstones, and exact legacy namespace remain untouched. No billing change.

Next safe action is a read-only current Koofr export from the protected production runtime into private storage with hash/readback, then a complete semantic compare against a freshly captured Firestore snapshot. Only then freeze/isolate confirmed writers and deploy/test the explicit Firestore configuration before moving either alias.


## Read-only export route preparation

A source-only, feature-gated route was added in [PR #20](https://github.com/hunghvt-cyber/web-notes/pull/20) and merged in commit `1cc44d882fad9ad383141258c3c41bfaa0375474`. The source tree was tested as commit `2111f122387973cbdf5d29409e646264ad240906`, tree `fcb38e8ec1d7a58b3bee20037c0cc8b52c55bdcc` plus the route/timeout change. It exposes the existing bounded stable-catalog GET-only exporter and gives the function a 120-second limit. The route requires production environment, explicit `NOTES_MIGRATION_EXPORT_ENABLED=get-only-v1`, and `NOTES_WRITES_FROZEN=true`; it returns 404 when disabled, rejects non-GET, refuses a configured Firestore selector, and verifies the Koofr catalog before/after the read.

- Focused test `node --test test/koofr-migration-export.test.mjs`: 1/1 PASS.
- Full offline suite `node scripts/test-offline.mjs`: 187/187 PASS using NAS Node v22.23.4. Repository declares Node 24; CI/Vercel branch build subsequently completed READY.
- `git diff --check`: PASS.
- Gemini source-only review: no critical flaw identified in handler gates; its non-critical caveat was that Vercel deployment protection must be verified before staging. Gemini was not given Notes data.
- Vercel build for PR source completed READY in the separate `notes-firestore-exact-082` project. Its Production environment-variable metadata is empty. A direct request to that deployment's export route returned 404. This verifies only that the default-closed route compiles and remains closed without flags; it is not a Production app deployment or Koofr export.

The route is now present on canonical main but was **not enabled** in `hunghvt-notes`, and no deployment was created in the primary project. Existing aliases/deployments and all source data remain unchanged. A protected primary-project staged deployment with exact Production env, a private snapshot handoff/readback path, and safe isolation of all writers are still required before capturing the current Koofr source or moving aliases.
