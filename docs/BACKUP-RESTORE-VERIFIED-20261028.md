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

## Scope and remaining evidence

This was a **manual dispatch**, not a cron execution. The scheduled workflow is
separate; this run does not prove the daily cron has fired. Production Notes
backend remains **UNKNOWN**. No legacy writer, alias, deployment, namespace,
or production data was changed or deleted.
