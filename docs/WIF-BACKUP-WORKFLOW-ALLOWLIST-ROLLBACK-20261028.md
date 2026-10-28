# GitHub baseline WIF condition rollback snapshot — 2026-10-28

Captured immediately before extending the backup provider's exact workflow allowlist. No credentials or token values are included.

- Project: `notes-lab-56f0f` (project number `989224849517`).
- Pool/provider: `notes-firestore-backup-gha/github-main-backup`, state ACTIVE.
- Issuer: `https://token.actions.githubusercontent.com`.
- Attribute mapping:
  - `google.subject=assertion.sub`
  - `attribute.repository=assertion.repository`
  - `attribute.ref=assertion.ref`
  - `attribute.workflow_ref=assertion.workflow_ref`
- Allowed audiences: unset (default provider audience behavior).
- Exact live condition before this change:
  `assertion.repository == 'hunghvt-cyber/web-notes' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'hunghvt-cyber/web-notes/.github/workflows/firestore-backup.yml@refs/heads/main'`
- Backup service account binding: `roles/iam.workloadIdentityUser` for the canonical repository principalSet; binding has no separate IAM condition.
- No service account permissions, database roles, principal sets, issuer, mappings, or restore provider are changed by the planned condition update.

Rollback: restore the exact provider condition above with `gcloud iam workload-identity-pools providers update-oidc`; leave the service-account IAM binding untouched.
