# Firestore backup cron verification — 2026-10-29

## Runs and evidence

- Scheduled backup: [run 40792366146](https://github.com/hunghvt-cyber/web-notes/actions/runs/40792366146). GitHub metadata reports `event=schedule`, `main`, conclusion `success`, start `2026-10-29T00:11:06Z` (07:11:06 ICT), source commit `585e7a7a99f88c4dbf7df78818f6860b41884411`.
- The workflow log emitted `backup_verified` at `2026-10-29T00:11:17.299Z`. Backup ID: `firestore-notes-2026-10-29T00-11-17Z-40792366146-1.json.gz`. The event is emitted only after remote upload, download/readback, manifest equality, gzip/hash/size checks, snapshot fingerprint/count parity, and retention safety checks. The scheduled job and verification step concluded successfully.
- Aggregate manifest counts: 33 notes total (6 active, 27 trash), 3 folders, 11 shares (0 active shares), 42 receipts, 0 erased records. Snapshot size 1,888,597 bytes. No note bodies or backup payloads are stored here.
- Restore qualification: [run 40792452239](https://github.com/hunghvt-cyber/web-notes/actions/runs/40792452239), triggered by `workflow_run`, concluded `success`, started `2026-10-29T00:11:54Z` (07:11:54 ICT). Its restore log names the same backup ID, reports matching source/restored aggregate counts and fingerprint, then emits `restore_vault_removed` for `notes-restore-40792452239`. The run-scoped test vault was therefore cleaned after parity passed.
- The observed cron was about 3h41m late relative to the 03:30 ICT schedule (20:30 UTC on the prior date). This is one delayed run; the schedule remains unchanged.

## Suggested verified-backup age monitoring

Keep the current daily cron. Monitor run metadata and successful verification rather than changing the schedule based on one observation.

- **Late:** the scheduled slot has passed and its run has not started/completed within a grace period, or its start time is later than 03:30 ICT. Record scheduled time and actual `run_started_at` to calculate delay. This run is classified as late.
- **Failed:** a scheduled run exists but has a failed, cancelled, or timed-out conclusion, or its backup verification job/step did not pass. Alert immediately.
- **No run observed:** no `event=schedule` run for the expected day by 05:30 ICT (two-hour observation grace). Alert as missing; if Actions later creates the run, resolve as late instead of failed.
- **Verified backup age:** track the newest successful main-branch backup whose verification job passed. Warn when its age exceeds 28 hours and escalate at 32 hours. This catches a missed daily backup even if run enumeration is delayed. A failed/manual restore qualification should be a separate restore-qualification alert, not counted as a new backup.

The monitor can use read-only GitHub Actions run/job metadata. It does not need to read snapshots, Notes, or Koofr credentials. Keep no backup data in GitHub artifacts. Thresholds are a proposal; no monitor workflow, cron, IAM, or backend configuration was changed by this record.
