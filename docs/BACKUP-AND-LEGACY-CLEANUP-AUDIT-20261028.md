# Independent backup and legacy cleanup audit — 2026-10-28

This audit records read-only checks made against the current workspace, GitHub,
Vercel, the deployed health route, and the canonical repository. It does not
claim a backup, restore, or cleanup has succeeded.

## Workspace and source

- `/vol1` is mounted read-write with 334 GiB available. Root filesystem has
  1.1 GiB available. The target worktree
  `/vol1/Docker/.codex-admin/worktrees/hunghvt-notes-backup` is readable and
  clean; branch `codex/firestore-backup-actions-20261027`, commit
  `c5e1427d58c7a29d9f7ef4a827b003803d383c33`, tree
  `035a07789aa235f0e1b79938688633c9c963984f`. The dirty
  `/home/admin/Hunghvt-notes` checkout was left untouched.
- GitHub confirms `hunghvt-cyber/web-notes`, repository ID `1423348828`,
  default branch `main`. The latest commit observed during this audit is
  `470f480be1d61f7d367a908910b8433fea623e65`; its message records a
  documentation-only Code Inbox checkpoint. Candidate commit `c5e1427` is
  already in the integrated source history; the remote default branch has
  subsequent documentation commits, so the candidate commit is not the current
  branch head.
- On the exact clean candidate worktree/tree above, `npm test` ran
  `node scripts/test-offline.mjs` and passed 187/187 TAP tests. This is local
  offline evidence, not a cloud test.
- GitHub Actions run `40601380216` has successful `test` and `browser`
  jobs. The test job ran `npm test` and a separate simulated retry-load step;
  the browser job ran `npm run test:browser`. Run `40602314009` also has
  successful test and browser jobs. These workflow runs do not prove backup.
- Earlier handoff text cites both 187 and 172 tests. The available record does
  not identify a commit and exact command for the 172 result, so it cannot be
  equated with the 187 suite. This audit establishes only the exact local
  command/tree above and the CI job steps; it does not infer a CI test count
  from job success.
- Gemini review was unavailable in this session: no Gemini connector or
  executable was exposed. No Notes data, snapshot, or credential was sent to
  Gemini.

## Production backend evidence

### Directly observed

- Vercel project `hunghvt-notes`, project ID
  `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`, is the project serving the Notes
  aliases. Alias `hunghvt-notes.vercel.app` currently maps to READY deployment
  `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`.
- The active deployment metadata reports source `cli`, no Git source metadata,
  and an empty deployment `meta` object. This is consistent with the documented
  direct-deploy setup; it does not independently identify the deployed source
  tree or deployment-specific environment overrides.
- Project Production environment-variable metadata lists legacy
  `NOTES_MODE=live-v1` and the old Koofr namespace/user/password keys. It does
  not list `NOTES_BACKEND`, `NOTES_FIRESTORE_PROJECT_ID`,
  `NOTES_FIRESTORE_VAULT_ID`, or `NOTES_FIRESTORE_PRODUCTION_REVIEW`.
  Secret values were not requested or read. The project reports no hidden
  Production env entries.
- A read-only GET to
  `https://hunghvt-notes.vercel.app/api/app?route=health` returned
  `kind=hunghvt-notes`, `configured=true`, `production=true`. This health
  route does not report which datastore was accessed and does not instantiate a
  repository; it is not a Firestore runtime access test.
- Current main source `lib/app-config.mjs` selects Firestore only when
  `NOTES_BACKEND=firestore-native-v1`; absent that, it constructs the Koofr
  store. Vercel project environment metadata alone cannot rule out a
  deployment-specific override. No authenticated read-only operation against
  either datastore was performed.

### Conclusion

**Runtime backend is UNKNOWN from the evidence available in this audit.** The
cutover report says the deployment-specific override selected Firestore, but
that is a historical report. Project-level environment metadata points to the
legacy Koofr configuration, while the deployed health response is
backend-neutral. Neither establishes which provider the live request actually
accesses. Do not change `NOTES_BACKEND`, migrate, or clean either store based
on these observations. Before any backend-dependent change, obtain a
backend-specific read-only runtime check from an authenticated production
session or deployment inspection that exposes the effective non-secret backend
selection without reading Note content.

## Backup and restore

- Current main workflow `.github/workflows/firestore-backup.yml` contains
  schedule `30 20 * * *` UTC (03:30 Asia/Ho_Chi_Minh), `workflow_dispatch`,
  a concurrency group, bounded retry is implemented in the WebDAV client, and
  the backup job grants `contents: read` plus `id-token: write`. The workflow
  targets project `notes-lab-56f0f`, database `(default)`, vault
  `notes-production`, and names the backup identity
  `notes-firestore-backup-gha`.
- The public GitHub Actions API reports **0 runs** for workflow
  `firestore-backup.yml`. There is no manual run, scheduled run, Koofr
  readback, or restore qualification to report. The next scheduled opportunity
  after this audit is 03:30 on 2026-10-29 Vietnam time; that future run is not
  simulated here.
- Runtime WIF provider conditions, service-account impersonation bindings, and
  database IAM conditions were not accessible through the tools in this
  session. The workflow source contains the canonical repository and main-only
  provider resource, but source text does not prove live IAM configuration.
- GitHub Actions does not expose secret values through the available connector,
  and this connector has no Actions secret-existence or workflow-dispatch
  operation. Existence of `NOTES_BACKUP_KOOFR_CREDENTIAL` is therefore
  **UNKNOWN**. Source inspection confirms the value must contain a non-empty
  username and password separated by a colon; the workflow only uses the
  credential against the dedicated WebDAV backup path. A dedicated app password
  must be provided through GitHub's secret UI, never through chat or shell
  output. The code's path restriction is not evidence that Koofr itself limits
  that credential to the backup folder.
- Do not prune or delete anything in Koofr until upload, download/hash
  verification, restore parity, and exact test-vault cleanup all pass.

## Code Inbox and legacy inventory

- Current main source `lib/inbox.mjs` claims canonical repository
  `hunghvt-cyber/web-notes`, repository ID `1423348828`, and release ref
  `refs/heads/release/minimal-notes`. The Vercel deployment is a direct CLI
  deployment without Git source metadata, so this source observation does not
  prove the live handler has those claims. The recorded deployment review says
  the active deployment still has old repo claims; a successful real GitHub
  OIDC Code Inbox transaction after rename has not been observed. Do not deploy
  a Koofr-era branch to repair it.
- Alias `hunghvt-notes-hunghvt.vercel.app` still maps to
  `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`, immutable URL
  `hunghvt-notes-de329dlyt-hunghvt.vercel.app`. The deployment is still READY.
  Changing an alias would not retire the immutable URL.
- No legacy Koofr namespace, writer, cron, secret, identity, Blob dependency,
  or exact old namespace was independently inventoried in this audit. No alias,
  deployment, credential, namespace, Blob store, or Firestore data was changed
  or deleted.
- The historical cutover baseline and Koofr namespace remain protected. Current
  cleanup gates are not met because runtime backend, live WIF/IAM, backup
  credential availability, real backup/readback, and restore qualification are
  unverified.

## Minimal follow-up

The remaining prerequisite is access through authorized account surfaces to
verify the effective Production backend, live WIF/IAM, and Actions secret
presence, then dispatch the backup. The current connectors do not provide the
GCP read-only IAM inspection, Actions secret metadata, or workflow-dispatch
operations needed to complete those checks. No credentials should be sent in
chat. Keep both data stores and all legacy targets intact until those gates
are met.
