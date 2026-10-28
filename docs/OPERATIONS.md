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

The active Vercel firewall now has an exact-host `deny` rule for all 34 prior
immutable deployment hosts. The current Firestore deployment and both app
aliases are excluded. The rule is active in control-plane configuration;
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
truncated-output markers. On Node 24.22.1, source check passed for 50 files
and offline tests passed (195/195).


## Cron timestamp correction — 2026-10-28

Backup `40659900983` at 08:52 UTC on 28 October was 15:52 Asia/Ho_Chi_Minh; the 03:30 VN run on 28 October had already passed. Backup `40663242871` captured at 09:18 UTC, or 16:18 VN, on 28 October. The next scheduled run is 03:30 VN on 29 October (20:30 UTC on 28 October). Both Actions runs cited above were manual dispatches; neither is cron evidence.

## Final backup qualification and legacy writer lock — 2026-10-28

Backup [40663242871](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663242871) and automatic restore qualification [40663337366](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663337366) both PASS for the exact backup ID `firestore-notes-2026-10-28T09-18-52Z-40663242871-1.json.gz`. Readback SHA-256 is `30b1441b402064b5f9245e0ce420533f41a7d696a4229e98f4273cf27d817f23`; fingerprint `525b16af87a11ff9fa690be6daf819475b79202e90819325ec73c8ff34011131`; parity counts are 32 notes (5 active, 27 trash), 2 folders, 11 shares, 36 receipts, 0 erased tombstones. Restore reported parity pass and removed `notes-restore-40663337366` after recursive delete.

Vercel active firewall config version 1 now contains active exact-host deny rule `rule_block_retired_notes_deployment_hosts_P2DiU9`, matching only the 34 pre-cutover immutable deployment hosts; current Firestore deployment and both aliases are excluded. `firewallEnabled=true`, no pending config changes. Vercel processes deployment protection before WAF, so anonymous 302 is not treated as the deny test. The rule is the control-plane writer lock; no authenticated request probe was run. Custom WAF rules are available on all plans per Vercel documentation; no billing change was made. The old provision workflow was removed from `release/minimal-notes` at `c0fe02f`.

The cleanup source removes the default-branch baseline OIDC workflow and request, exporter and rollback API entrypoints; the Production export flag is set to `disabled` and freeze flag to `false` for future deployments. The exact namespace deletion workflow revalidates the latest backup bytes/hash and matching restore marker at execution, then locks/deletes only `Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e` and verifies its root is absent. This deletion has not run yet. See [inventory](LEGACY-WRITER-INVENTORY-20261028.md) and [backup evidence](BACKUP-RESTORE-VERIFIED-20261028.md).
