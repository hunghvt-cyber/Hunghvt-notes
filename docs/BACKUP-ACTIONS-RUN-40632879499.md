# Backup Actions run 40632879499 — 2026-10-28

Filtered evidence from the first real GitHub Actions run after the canonical WIF
update. No token, secret value, Notes content, or raw provider response is
included.

## Run identity and result

- [GitHub Actions run 40632879499](https://github.com/hunghvt-cyber/web-notes/actions/runs/40632879499)
- Workflow: `Firestore Notes backup to private Koofr`
- Event/branch: `workflow_dispatch` on `main`
- Workflow source commit: `d3cfedf71e4e06b8232d7f410fb860de628bdf96`
- Result: job `backup` failed.
- Checkout, Node setup, dependency install, and **Authenticate with main-only Google WIF** all succeeded. This is runtime evidence that canonical GitHub Actions OIDC exchanged successfully and authenticated as the backup identity after the WIF update.
- The backup script failed with the filtered code `BACKUP_ROOT_CREATE_HTTP_401` at the Koofr backup-root authentication check.

## What this establishes

The workflow passed the configured Koofr credential to the backup script: a
missing/empty credential would fail earlier with
`BACKUP_KOOFR_CREDENTIAL_MISSING`. Koofr rejected authentication at the root
check. This indicates the injected value is nonempty but not accepted by the
Koofr endpoint; the value itself and GitHub secret metadata were not read.

The source calls `remote.ensureRoot()` before exporting Firestore. Thus this run
did not read/export the Notes snapshot, upload a snapshot or manifest, perform
download/readback verification, or execute retention. The workflow-run restore
qualification did not start because it is gated on a successful backup run.
No GitHub artifact was used.

The run proves backup identity WIF authentication, but not backup identity
Firestore data read access. Production Notes backend remains **UNKNOWN**.

## Next gate

In GitHub repository Settings → Secrets and variables → Actions, update the
existing `NOTES_BACKUP_KOOFR_CREDENTIAL` value directly in the secret form with
a valid dedicated Koofr WebDAV credential in the source-verified
`username:app-password` format. Do not reveal it in chat or a shell command.
If the dedicated app password is invalid or revoked, issue a valid dedicated
Koofr app password through Koofr's own account UI, then enter it only in the
GitHub secret form. Do not create a second secret with a different name.

After saving, start a **new** workflow_dispatch on `main` with
`confirm=BACKUP_FIRESTORE`; do not re-run this failed job. A successful run
must complete Koofr upload/readback verification before the restore
qualification workflow can proceed.
