# Backup WIF baseline allowlist before baseline retirement — 2026-10-28

Captured immediately before removing the retired Koofr baseline workflow from the backup provider condition. This file contains no credentials or tokens.

- Project: `notes-lab-56f0f` (project number `989224849517`).
- Pool/provider: `notes-firestore-backup-gha/github-main-backup`, observed state `ACTIVE`.
- Issuer and attribute mappings are unchanged.
- Current condition before change:
  `assertion.repository == 'hunghvt-cyber/web-notes' && assertion.ref == 'refs/heads/main' && (assertion.workflow_ref == 'hunghvt-cyber/web-notes/.github/workflows/firestore-backup.yml@refs/heads/main' || assertion.workflow_ref == 'hunghvt-cyber/web-notes/.github/workflows/notes-legacy-baseline.yml@refs/heads/main')`
- Backup service-account principalSet binding and the restore provider are outside this change. Backup read-only Firestore role and restore qualification role remain unchanged.

Rollback is only if explicitly required: restore the exact condition above with `gcloud iam workload-identity-pools providers update-oidc`. Do not modify service-account IAM bindings or Firestore roles.
