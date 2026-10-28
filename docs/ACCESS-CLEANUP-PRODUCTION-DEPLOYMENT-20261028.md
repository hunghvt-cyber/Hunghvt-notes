# Temporary access retirement and live Production deployment — 2026-10-28

## WIF allowlist

Before editing, the live provider condition was saved in [WIF-BASELINE-RETIRE-ROLLBACK-20261028.md](WIF-BASELINE-RETIRE-ROLLBACK-20261028.md).

- Backup provider `notes-firestore-backup-gha/github-main-backup` remains ACTIVE. Its read-back condition now permits only canonical repo `hunghvt-cyber/web-notes`, `refs/heads/main`, and `.github/workflows/firestore-backup.yml@refs/heads/main`. The `notes-legacy-baseline.yml` workflow claim is absent.
- Restore provider `notes-firestore-restore-gha/github-manual-restore` remains ACTIVE and still permits only the existing canonical restore-qualification workflow/ref. No baseline workflow claim is present.
- Both service-account `roles/iam.workloadIdentityUser` bindings remain on the canonical repository principalSet; the former repository principal is absent. No human `serviceAccountTokenCreator` grant was added.
- Project IAM read-back still shows backup `roles/datastore.viewer` and restore `roles/datastore.user`, each conditioned on database `(default)`. Provider and IAM condition scopes were not broadened.
- Vercel API accepted clearing the canonical project's Trusted Sources object with `trustedSources: null`. The only custom external entry documented in this repo was the baseline GitHub Actions source. Project read-back confirms SSO protection remains enabled (`all_except_custom_domains`) and domains remain attached. The connected project GET projection omits the `trustedSources` property, so it cannot independently enumerate the post-change provider list; no source was re-added for backup or restore.

## Canonical Production deployment

- Project: `hunghvt-notes`, `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`.
- Production deployment: `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`, READY, source commit `480b54605c8ed8d599af486bab7817456fd6afae`, tree `657237f2c4f0714575c382f66b55acbda179f90f`.
- Both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app` were read back pointing to this deployment. The prior active firewall version remains enabled with no pending changes and the exact deny rule for 34 retired immutable deployment hosts.
- A fresh GET health request at 2026-10-28 10:12:40 UTC returned HTTP 200: `firestore-native-v1`, project `notes-lab-56f0f`, vault `notes-production`, `firestoreRead=PASS`, `vaultInitialized=true`.
- GET `/api/migration-export` and `/api/migration-rollback` on the deployed Production alias both returned HTTP 404. The main tree has no `api/migration-export.js` or `api/migration-rollback.js` entrypoint.
- Production metadata read-back retained Firestore backend/project/vault/review values, `NOTES_AUTH_MODE=homepage-v1`, `NOTES_INBOX_ENABLED=github-oidc-v1`, export disabled, and writes unfrozen. The project SSO setting remains enabled; no broad protection bypass or firewall change was made.
- The private legacy baseline and new Firestore backup objects were not modified by this cleanup.

All evidence above is metadata and status only; no Notes content, secret value, token, or raw provider log is recorded.
