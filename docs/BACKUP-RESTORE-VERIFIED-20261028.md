# Verified backup and restore qualification — 2026-10-28

Evidence from the successful manual Actions run and its automatically triggered
restore qualification. No Notes content or credential is included.

## Backup Actions run

- [Backup run 40637421409](https://github.com/hunghvt-cyber/web-notes/actions/runs/40637421409)
- Event: `workflow_dispatch`, branch `main`, source commit
  `dcc158769bf70ee0bf80e13516eee6ef31af55ba`.
- Job and both `Authenticate with main-only Google WIF` and backup step:
  **PASS**.
- Backup object:
  `firestore-notes-2026-10-28T05-20-38Z-40637421409-1.json.gz`.
- Capture time: `2026-10-28T05:20:38.709Z`; Vietnam date: `2026-10-28`.
- Snapshot bytes: `1884395`; gzip bytes: `413198`.
- Gzip SHA-256:
  `30b1441b402064b5f9245e0ce420533f41a7d696a4229e98f4273cf27d817f23`.
- Manifest counts: notes 32 (active 5, trash 27), folders 2, shares 11
  (active 0), receipts 36, erased tombstones 0.
- Aggregate snapshot fingerprint:
  `525b16af87a11ff9fa690be6daf819475b79202e90819325ec73c8ff34011131`.
- The workflow downloaded the Koofr backup and manifest again, compared the
  manifest, compressed SHA-256, uncompressed size, counts and fingerprint.
  **Readback verification: PASS.**
- Retention: `retained=1`, `verified=1`, `deleted=0`. No existing backup was
  removed. No GitHub Actions artifact was used.

## Restore qualification

- [Restore qualification run 40637491951](https://github.com/hunghvt-cyber/web-notes/actions/runs/40637491951)
- Trigger: `workflow_run` after backup success; branch `main`.
- Restore identity's separate GitHub WIF authentication: **PASS**.
- The workflow downloaded the exact verified Koofr object, checked manifest,
  gzip SHA-256 and source snapshot fingerprint, restored to
  `notes-restore-40637491951`, and ran the source `compareSnapshots`
  parity check.
- Source and restored counts matched exactly: notes 32 (active 5, trash 27),
  folders 2, shares 11 (active 0), receipts 36, erased tombstones 0.
- Source and target fingerprint both matched the backup fingerprint above.
  **Restore parity: PASS.**
- Cleanup emitted `restore_vault_removed`. The workflow source confirms it
  reads the vault root after recursive deletion and fails unless the root is
  absent. Temporary restore vault cleanup: **PASS**.
- On successful qualification, the workflow records its Koofr control marker
  `.restore-qualification-passed.json`.

The parity comparison covers the normalized snapshot state: note IDs/content
hashes/version/deleted state, folders, ordering, share state/revocation and
capability-material hashes, operation receipts, erase/purge tombstones, and
vault epoch. It does not expose or store the Notes content in this report.

## Latest post-cutover qualification — 2026-10-28

- Backup [run 40663242871](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663242871), `workflow_dispatch`, source commit `56766025faf28679f26c117d02862d6a1a71ca56`.
- Capture time `2026-10-28T09:18:52.624Z`, equal to `16:18:52.624` Asia/Ho_Chi_Minh. Backup ID `firestore-notes-2026-10-28T09-18-52Z-40663242871-1.json.gz`.
- Upload, download/readback, manifest and compressed hash: **PASS**. Compressed bytes: `413198`; SHA-256 `30b1441b402064b5f9245e0ce420533f41a7d696a4229e98f4273cf27d817f23`. Snapshot fingerprint `525b16af87a11ff9fa690be6daf819475b79202e90819325ec73c8ff34011131`.
- Counts: 32 notes (5 active, 27 trash), 2 folders, 11 shares (0 active), 36 receipts, 0 erased tombstones.
- Restore [run 40663337366](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663337366) downloaded this exact backup ID, verified it, restored into `notes-restore-40663337366`, and matched source/target fingerprint and counts. **Parity: PASS.**
- `restore_vault_removed` followed recursive deletion and confirmed the exact test vault root was absent. **Temporary restore vault cleanup: PASS.** No Firestore Notes data was changed.
- Retention summary: `retained=1`, `verified=2`, `deleted=1`; selection is limited to managed daily backup names. The separate baseline subtree is outside this allowlist.
- Both runs were manual, not cron. At 08:52 UTC on 28 Oct it was 15:52 VN; the 03:30 VN run on 28 Oct had passed. The next schedule is 03:30 VN on 29 Oct (`20:30 UTC` on 28 Oct).

## Scope and remaining evidence

The latest backup and restore were **manual dispatches**, not cron executions.
The scheduled workflow is separate. At 08:52 UTC on 2026-10-28 it was 15:52
VN, after that day's 03:30 VN schedule; the next cron is 03:30 VN on
2026-10-29 (20:30 UTC on 2026-10-28). The exact legacy namespace deletion
workflow has been prepared with backup/readback/restore gates, but the Koofr
namespace remains pending its successful workflow run. The retired immutable
Vercel hosts are denied by the active exact-host WAF rule; their deployment
objects remain present. No Firestore Notes data was changed or deleted.
