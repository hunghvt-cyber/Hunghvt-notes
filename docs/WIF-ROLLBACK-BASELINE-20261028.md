# WIF rollback baseline before canonical repository update — 2026-10-28

Read-only snapshot immediately before the WIF change. It contains configuration
metadata only; no credentials or secret values.

Project: `notes-lab-56f0f` (number `989224849517`).

## Backup provider

- Resource: `projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-backup-gha/providers/github-main-backup`
- State: `ACTIVE`
- Issuer: `https://token.actions.githubusercontent.com`
- Attribute mapping:
  - `google.subject = assertion.sub`
  - `attribute.repository = assertion.repository`
  - `attribute.ref = assertion.ref`
  - `attribute.workflow_ref = assertion.workflow_ref`
- Allowed audiences: unset (default provider audience behavior).
- Previous condition:
  `assertion.repository == 'hunghvt-cyber/Hunghvt-notes' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'hunghvt-cyber/Hunghvt-notes/.github/workflows/firestore-backup.yml@refs/heads/main'`

## Restore provider

- Resource: `projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-restore-gha/providers/github-manual-restore`
- State: `ACTIVE`
- Issuer: `https://token.actions.githubusercontent.com`
- Attribute mapping is the same as the backup provider above.
- Allowed audiences: unset (default provider audience behavior).
- Previous condition:
  `assertion.repository == 'hunghvt-cyber/Hunghvt-notes' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'hunghvt-cyber/Hunghvt-notes/.github/workflows/firestore-backup-restore-qualify.yml@refs/heads/main'`

## Service-account WIF bindings

- Backup service account:
  `notes-firestore-backup-gha@notes-lab-56f0f.iam.gserviceaccount.com`
  had `roles/iam.workloadIdentityUser` for:
  `principalSet://iam.googleapis.com/projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-backup-gha/attribute.repository/hunghvt-cyber/Hunghvt-notes`
- Restore service account:
  `notes-firestore-restore-gha@notes-lab-56f0f.iam.gserviceaccount.com`
  had `roles/iam.workloadIdentityUser` for:
  `principalSet://iam.googleapis.com/projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-restore-gha/attribute.repository/hunghvt-cyber/Hunghvt-notes`
- Both bindings had no IAM condition.

## Rollback

To revert only this change, restore the two previous provider conditions above,
add each previous principalSet member back to its corresponding service account
with `roles/iam.workloadIdentityUser`, and remove the canonical member. Do not
replace full policies, alter database roles, or grant token-creator to a human
account. Re-read each resource after rollback.
