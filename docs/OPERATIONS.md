# Notes vận hành — 28/10/2026


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

The project API reports SSO protection enabled for all non-custom deployment
URLs. An unauthenticated HEAD request to every one of the 34 prior immutable
deployment hosts returned 302 to Vercel SSO; both app aliases resolve to the
Firestore deployment. A temporary shareable bypass on the secondary alias was
revoked. No WAF config exists (active config lookup returned 404). Exact
deployment inventory is in [legacy writer inventory](LEGACY-WRITER-INVENTORY-20261028.md).
This is evidence of unauthenticated isolation; it does not prove that a
credentialed Vercel/Trusted Source principal cannot enter an old deployment.
Do not delete Koofr namespace until the new restore qualification passes and
remaining authenticated writer access is confirmed closed. The exact provisioner
on `release/minimal-notes` was retired at `c0fe02f`; the default-branch
baseline OIDC workflow still reaches the old read-only export deployment and
must be removed with its endpoint after the same-backup restore gate.

CI now runs `npm run check:source`, which syntax-checks and imports all `api/`
and `lib/` JS modules and rejects known truncated-output markers. On the NAS
Node 24.22.1, source check passed (29 modules) and offline tests passed (191/191).


## Cron timestamp correction — 2026-10-28

Backup `40659900983` at 08:52 UTC on 28 October was 15:52 Asia/Ho_Chi_Minh; the 03:30 VN run on 28 October had already passed. Backup `40663242871` captured at 09:18 UTC, or 16:18 VN, on 28 October. The next scheduled run is 03:30 VN on 29 October (20:30 UTC on 28 October). Both Actions runs cited above were manual dispatches; neither is cron evidence.
