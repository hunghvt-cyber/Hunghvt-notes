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
