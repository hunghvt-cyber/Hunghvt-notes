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

## Local cache and concurrency boundaries (2026-10-19)

- Exactly one owner; shared links serve viewers/editors, not separate accounts.
- Keep Koofr as source of truth; no NAS, Blob, Redis or new database dependency.
- Owner bootstrap uses `notes&includeFolders=1` and one locked catalog snapshot. Parallel calls to `notes` and `folders` contend on the same lock and can fail with 423.
- Cache is separate IndexedDB `hunghvt-notes-cache-v1`; never delete/migrate the draft DB implicitly. Obtain the HMAC cache identity only from a successful authenticated `auth` response. No persistent shared-link cache.
- Full content cache requires explicit private-device opt-in. List previews persist after authenticated use. Disabling opt-in removes only cached content, never drafts. Cached revisions never bypass server CAS or create unconditional writes.
- Revalidate cached opened notes; never replace an active dirty or edited session. Shared revocation is checked on API requests, visibility return and periodic refresh, not by cached authorization.
- Only GET retries 423 (bounded jitter). Mutation retry remains SyncDraft's exact frozen operation protocol.
- Browser fixture tests must run on PRs before merging cache changes. Local browser availability is not evidence of production UI correctness.
- Synchronized fixture bursts currently demonstrate root-lock contention, not 100-user readiness. Report 423 separately from successful latency; never quote fake-WebDAV latency as Koofr/Vercel performance.
- Trash remains incomplete: do not test deletion on real production notes.
