# Canonical GitHub WIF update — 2026-10-28

This records the filtered before/after configuration diff. The rollback baseline
was saved first in [WIF-ROLLBACK-BASELINE-20261028.md](WIF-ROLLBACK-BASELINE-20261028.md).
No service-account JSON key or personal impersonation grant was created.

## Changes applied

Both OIDC provider conditions and the matching service-account
`roles/iam.workloadIdentityUser` repository principal were updated from
`hunghvt-cyber/Hunghvt-notes` to `hunghvt-cyber/web-notes`.

- Backup provider:
  `projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-backup-gha/providers/github-main-backup`
  - Ref remains `refs/heads/main`.
  - Workflow remains
    `hunghvt-cyber/web-notes/.github/workflows/firestore-backup.yml@refs/heads/main`.
  - Backup service account remains
    `notes-firestore-backup-gha@notes-lab-56f0f.iam.gserviceaccount.com`.
  - Binding role remains `roles/iam.workloadIdentityUser`, now for
    `principalSet://iam.googleapis.com/projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-backup-gha/attribute.repository/hunghvt-cyber/web-notes`.

- Restore provider:
  `projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-restore-gha/providers/github-manual-restore`
  - Ref remains `refs/heads/main`.
  - Workflow remains
    `hunghvt-cyber/web-notes/.github/workflows/firestore-backup-restore-qualify.yml@refs/heads/main`.
  - Restore service account remains
    `notes-firestore-restore-gha@notes-lab-56f0f.iam.gserviceaccount.com`.
  - Binding role remains `roles/iam.workloadIdentityUser`, now for
    `principalSet://iam.googleapis.com/projects/989224849517/locations/global/workloadIdentityPools/notes-firestore-restore-gha/attribute.repository/hunghvt-cyber/web-notes`.

## Read-back verification

After the change, direct gcloud reads confirmed:

- Both providers remain `ACTIVE`, use the GitHub Actions OIDC issuer, retain the
  original attribute mappings, and have the exact canonical repository,
  `main` ref, and workflow-ref conditions listed above.
- Each service account has the canonical repository principal under
  `roles/iam.workloadIdentityUser`; the former repository principal is absent.
- Backup data role remains `roles/datastore.viewer`, restricted to database
  `(default)`.
- Restore data role remains `roles/datastore.user`, restricted to database
  `(default)`.
- No human account was granted `roles/iam.serviceAccountTokenCreator`.

This gcloud read-back verifies the stored policies only. It is not proof of
GitHub OIDC exchange or Firestore access as the service account. A real GitHub
Actions execution is still required. The restore qualification workflow is
configured to run only after a successful backup workflow on canonical
`main`.

## Remaining gate

The available GitHub connector cannot read repository Actions secret metadata.
Before dispatching, verify that repository secret
`NOTES_BACKUP_KOOFR_CREDENTIAL` exists in GitHub Settings. If present, leave
its value untouched. If absent, create this one repository secret directly in
GitHub's secret form using the dedicated Koofr backup credential; never send
its value through chat or a shell command.

Then dispatch **Firestore Notes backup to private Koofr** from branch
`main` with required text input `confirm=BACKUP_FIRESTORE`. This actual
workflow run will exercise backup WIF and Firestore access, perform upload and
download verification, and, on success, trigger the separate restore
qualification workflow. Do not infer success from a manual gcloud impersonation
attempt under a human account.
