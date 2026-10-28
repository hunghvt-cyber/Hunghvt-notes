# NAS Google Cloud read-only preflight — 2026-10-28

This records a read-only preflight run after browser sign-in using an isolated
gcloud configuration on the NAS. No IAM, Firestore data, Notes backend, Vercel
deployment, alias, or GitHub secret was changed.

## Execution environment

- OS/architecture: Debian 12, aarch64.
- gcloud: 591.0.0, official Google ARM64 archive; SHA-256 matched the checksum
  published on Google's versioned archive documentation.
- Configuration and cache were isolated under
  `/vol1/Docker/.codex-admin/gcloud-session`; the existing home gcloud
  configuration was left untouched.
- Time: 2026-10-28 11:16 Asia/Ho_Chi_Minh.
- Source procedure: [BACKUP-PREFLIGHT-20261028.md](BACKUP-PREFLIGHT-20261028.md).
- The script printed only selected IAM/WIF fields, statuses and HTTP/error
  codes. It did not print account identity, access tokens, or Firestore data.

## Filtered results

- Login check: one active account in the isolated gcloud configuration.
- Project: `notes-lab-56f0f`; observed project number
  `989224849517`, matching the expected number.
- Backup and restore workload identity pools: both `ACTIVE`.
- Backup and restore OIDC providers: both `ACTIVE`, issuer
  `https://token.actions.githubusercontent.com`.
- Both provider attribute mappings include repository, ref, workflow ref, and
  subject claims.
- **Both provider conditions still allow the former repository
  `hunghvt-cyber/Hunghvt-notes`**, with `refs/heads/main` and workflow paths
  under that old repository name. The current default-branch backup and restore
  workflow files are in canonical repository `hunghvt-cyber/web-notes`.
- **Both service-account `roles/iam.workloadIdentityUser` principalSet
  bindings also name `hunghvt-cyber/Hunghvt-notes`**, not the canonical repo.
  Therefore the current canonical GitHub Actions identities do not match the
  observed WIF conditions/bindings. This is a concrete WIF configuration
  mismatch, independent of the local user's permissions.
- Project IAM data roles are present and database-scoped:
  - Backup identity: `roles/datastore.viewer`, condition restricted to
    `projects/notes-lab-56f0f/databases/(default)`.
  - Restore identity: `roles/datastore.user`, condition restricted to the
    same database.
- Local attempt to mint a token by impersonating the backup service account
  returned filtered `PERMISSION_DENIED`. This indicates the signed-in human
  identity cannot perform that local impersonation; it does not establish
  whether GitHub WIF would succeed.
- The harmless Firestore root-document GET was **not reached** because no
  backup-service-account token was obtained. Backup identity's Firestore data
  read is therefore **unverified**.
- These IAM results do not prove which datastore the Production Notes app
  currently uses. Its effective deployment configuration remains unresolved.

## Gate status

Backup dispatch, Koofr upload/readback, restore qualification, retention, and
legacy cleanup remain blocked. No backup was run and no data or configuration
was modified. The next required cloud-admin change is to update both WIF
provider conditions and both service-account WIF principalSet members to the
canonical repository/workflow claims, then rerun this read-only preflight.
Do not broaden either identity's Firestore database-scoped data role. Once WIF
matches, rerun the backup-identity read before dispatching backup.
