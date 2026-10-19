# Notes safety boundaries

- User authorized the minimal live Notes release on 2026-10-18, preserving Blob.
- Work on release/minimal-notes; test before release and record exact source/deployment.
- On 2026-10-18 the user superseded legacy Blob preservation and authorized deleting old Homepage Notes. Keep Koofr production data intact. Homepage QR guides and login limits remain outside that cleanup scope.
- Do not claim old data was imported without verification. Do not link to the retired Homepage Notes editor.
- Never change NAS reports, Google Apps Script, expense/Gemini or backup workloads.
- This repository is public: do not commit account configs, real Notes, credentials,
  runtime logs, raw provider responses or historical private-repository artifacts.
- Live tests use fresh synthetic roots. Production provisioning uses only the exact
  configured `Hunghvt-Notes-Data-<uuid>` root, never a backup path.
- Use dedicated Koofr WebDAV secrets. Never access the backup rclone configuration.
- Preserve revision checks, lock fencing, operation idempotency, live share checks
  and snapshot-bound restore. Never replace them with read-then-unconditional-write.
- Always distinguish local simulation, old live evidence and new live qualification.
- Keep the Android-TV-like reorder idea deferred until reliable operation.

## Current handoff 2026-10-19

- Live Notes is standalone on `https://hunghvt-notes.vercel.app/`, Koofr backend; Homepage legacy Notes endpoint retired. No Blob fallback for Notes.
- Release source is `release/minimal-notes`; do not assume `main` deploys. PR #3 adds bulk selection/deletion, sticky loading, backup panel, removes refresh button. Never bulk-delete production Notes for testing.
- Bulk delete must preserve local drafts, revision checks and conflicts. GitHub Actions `Notes simulation` tests fixtures, not real Koofr. Verify Vercel deployment and non-destructive UI smoke separately.
- This repository is public. Never commit passwords, tokens, private data, production backups, or Koofr credentials.
