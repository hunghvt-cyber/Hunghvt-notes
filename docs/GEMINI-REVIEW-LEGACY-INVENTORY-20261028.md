# Gemini review, baseline, and legacy inventory — 2026-10-28

This is a filtered operational record. It contains no Notes body, snapshot,
secret value, token, or raw Actions/Vercel/Google provider response. Gemini was
an adviser only; Codex performed and verified the checks.

## Gemini tool availability and review

- Current AI guidance was read from [ai-team/AGENTS.md](https://github.com/hunghvt-cyber/ai-team/blob/main/AGENTS.md), [README.md](https://github.com/hunghvt-cyber/ai-team/blob/main/README.md), [CURRENT-STATE.md](https://github.com/hunghvt-cyber/ai-team/blob/main/CURRENT-STATE.md), and [RUNBOOK.md](https://github.com/hunghvt-cyber/ai-team/blob/main/RUNBOOK.md).
- NAS wrapper: `/home/admin/bin/gemini-task`; SHA-256
  `29481dc45c6461b5f993a29f7caba32871cd826c6885abcf99a4928652c8ec00`,
  matching the saved source. Existing key store was not read; its mode was
  checked as `0600`.
- Model/route: `gemini-3.5-flash-lite` through the existing wrapper's direct
  Gemini API `generateContent` route. A minimal ping using one explicitly
  selected key returned the expected `GEMINI_WRAPPER_OK`. No key rotation
  occurred. The prior CLI `UNSUPPORTED_CLIENT` error was not retried.
- One second call submitted the filtered backend/cleanup batch. Gemini returned
  a valid response. Two calls total were used (ping plus review); no retry or
  credential change occurred.

### Review findings and Codex disposition

- **Accepted:** backup WIF/Firestore access does not establish the datastore
  used by the Production app; runtime backend remains **UNKNOWN**. Do not infer
  Firestore from the successful backup or restore workflow.
- **Rejected as a current verification method:** the existing health route is
  backend-neutral and does not access a datastore; adding an API trace would
  require a deployment or code/config change while the backend is unresolved.
- **Cloud Logging proposal:** read-only IAM audit configuration inspection found
  no Firestore or `allServices` audit log configuration. Google documents that
  Data Access audit logs are disabled by default for most services. Vercel's
  runtime-log connector rejected a 24-hour request because this Hobby project
  does not retain that range. No runtime identity evidence was inferred from
  missing logs.
- **Cleanup concern partly rejected:** Google documents default Firestore reads
  as strongly consistent. The official Node Firestore client documents
  `recursiveDelete` as deleting all documents and subcollections, resolving
  only after deletes finish and rejecting if any delete fails. The successful
  restore workflow awaits this call and then checks that the root is absent.
- **Cleanup verification accepted and independently strengthened:** a direct,
  read-only Firestore `listCollectionIds` request against the exact test-vault
  path returned HTTP 200 with zero child collection IDs. No document fields or
  Notes content were requested. This independently supports the workflow's
  cleanup result.

## Baseline integrity

The private pre-cutover Koofr snapshot copy was present on the NAS with mode
`0600` in a `0700` directory. Its size was 413,459 bytes and its SHA-256
matched the cutover record:
`ee5fa400d6e4e91d3dc900ebf07f2111271eab2bd82d97b77a41bfaafc04936e`.
The snapshot was hashed in a streaming, read-only check; content was not
displayed, copied, or committed. The remote old Koofr namespace was not accessed
because no Koofr connector/authorized legacy credential was available in this
preflight. The verified NAS copy is outside the new backup workflow's
`Notes-Firestore-Backups` retention prefix.

## Read-only legacy writer and dependency inventory

- Primary alias `hunghvt-notes.vercel.app` still targets READY deployment
  `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`. The deployed selector source matches
  current `main`; its captured effective environment remains unavailable.
  Source selects Firestore only for
  `NOTES_BACKEND=firestore-native-v1`; otherwise it creates the Koofr
  `NoteStore`. This is a conditional legacy writer until the deployment
  environment is verified.
- Secondary alias `hunghvt-notes-hunghvt.vercel.app` still targets READY
  deployment `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`, with immutable URL
  `hunghvt-notes-de329dlyt-hunghvt.vercel.app`. Read-only artifact inspection
  shows the old Koofr storage path and
  `KOOFR_NOTES_USER`/`KOOFR_NOTES_APP_PASSWORD` configuration names. This
  remains an independently reachable legacy writer.
- Exact legacy namespace in the current `release/minimal-notes`
  `notes-provision.yml` and cutover record:
  `Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e`.
- `.github/workflows/notes-provision.yml` on `release/minimal-notes` runs on
  branch pushes whose commit message contains `[notes-provision]`; it calls
  the Koofr provisioner with `KOOFR_WEBDAV_USER` and
  `KOOFR_WEBDAV_APP_PASSWORD` secrets.
- `.github/workflows/notes-inbox.yml` on that branch sends an OIDC Inbox
  request for changes to `.notes-inbox/request.json`. The deployed primary
  handler has a stale repository claim per the earlier artifact audit. If
  accepted, Inbox writes through the primary app's selected datastore.
- Primary deployment contains `POST /api/migration-rollback`, backed by the
  Firestore-to-Koofr handler. It is gated by
  `NOTES_MIGRATION_ROLLBACK_ENABLED=restore-firestore-to-koofr-v1` and exact
  namespace/baseline checks; whether the deployment-specific flag is set is
  unknown, so retain it as a conditional writer.
- The cleanup workflow remains limited to named synthetic test roots. Backup
  writes to the separate `Notes-Firestore-Backups` prefix. No shared Blob store,
  token, credential value, deployment, alias, or legacy data was read or
  changed.

## Gate status

Backup run [40637421409](https://github.com/hunghvt-cyber/web-notes/actions/runs/40637421409)
and restore qualification
[40637491951](https://github.com/hunghvt-cyber/web-notes/actions/runs/40637491951)
both passed; evidence is in
[BACKUP-RESTORE-VERIFIED-20261028.md](BACKUP-RESTORE-VERIFIED-20261028.md).
These were manual/workflow_run executions, not proof that the daily cron has
fired. Production backend remains **UNKNOWN**. Because the old alias is still
READY and the primary effective selector is unresolved, legacy cleanup remains
blocked. No alias, deployment, namespace, credential, or production data was
changed or deleted.

## Primary references

- [Firestore ListCollectionIds API](https://docs.cloud.google.com/firestore/docs/reference/rest/v1beta1/projects.databases.documents/listCollectionIds)
- [Firestore read consistency](https://docs.cloud.google.com/firestore/native/docs/understand-reads-writes-scale)
- [Node.js Firestore recursiveDelete API](https://github.com/googleapis/nodejs-firestore/blob/main/types/firestore.d.ts)
- [Cloud Logging Data Access audit configuration](https://docs.cloud.google.com/logging/docs/audit/configure-data-access)
