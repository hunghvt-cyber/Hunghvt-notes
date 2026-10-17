# Notes safety boundaries

- Work on a feature branch and open a draft PR; do not merge or release without approval.
- Production Homepage Notes remains on private Vercel Blob. Do not migrate real data.
- Never change NAS reports, Google Apps Script, expense/Gemini or backup workloads.
- This repository is public: do not commit account configs, real Notes, credentials,
  runtime logs, raw provider responses or historical private-repository artifacts.
- Live tests may only create fresh `Homepage-Notes-Vercel-Probe-<run>-<uuid>` roots.
- Use dedicated Koofr WebDAV secrets. Never access the backup rclone configuration.
- Preserve revision checks, lock fencing, operation idempotency, live share checks
  and snapshot-bound restore. Never replace them with read-then-unconditional-write.
- Always distinguish local simulation, old live evidence and new live qualification.
- Keep the Android-TV-like reorder idea deferred until reliable operation.
