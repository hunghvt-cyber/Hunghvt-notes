# Production migration package review — 2026-10-27

## Decision and verified boundary

Koofr is still the only Production backend. No Production deployment, environment
change, Koofr write, billing change, or migration has been performed.

The Vercel team/session and project were verified as `hunghvt` / `hunghvt-notes`
(project `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`, Node 24.x). The direct Preview
candidate was `dpl_H1L38KavsPzE4CbYnpSetZUGnW38`; it was READY with Preview target,
without Git linking or aliases. Its synthetic Notes flow and Preview OIDC → STS
→ Firestore path passed. This does not verify Production identity or access.

Google ADC lists only one Notes-labelled project available to this account:
`notes-lab-56f0f` (Notes Lab), which is the test project. Its only database is
`(default)`. The existing Preview runtime identity
`notes-preview-firestore@notes-lab-56f0f.iam.gserviceaccount.com` has an
unconditional project-level `roles/datastore.user` grant. Therefore it can
access any Firestore database in that test project; do not put Production Notes
there or create a Production database in that project. No dedicated Production
GCP project was discoverable in the authorized project list, so Production WIF,
service account, and destination cannot safely be provisioned yet. The Preview
identity has no grant in a separate Production project.

The Production Vercel identity must be pinned exactly to:

- issuer: `https://oidc.vercel.com/hunghvt`
- audience: `https://vercel.com/hunghvt`
- subject: `owner:hunghvt:project:hunghvt-notes:environment:production`

Use a separate pool/provider and runtime service account in a dedicated
Production GCP project, with the provider subject condition equal to the value
above. Bind only that principal to impersonate the Production service account;
grant the service account Firestore data access only in the Production project.
Do not reuse the Preview pool, provider, or account. This follows Vercel's
[documented GCP OIDC subject format](https://vercel.com/docs/oidc/gcp) and
Google's [Workload Identity Federation guidance](https://docs.cloud.google.com/iam/docs/workload-identity-federation).
No billing action is part of this plan.

## Source snapshot path

The existing app backup route is capped at 2,000,000 bytes and its server-side
`downloadSnapshot()` takes a WebDAV collection lock. The older `exportStore()`
also writes a backup file onto Koofr, so neither is used for this migration.

`scripts/koofr-readonly-snapshot.mjs` is a new local exporter. It performs GETs
only: read catalog, validate every immutable record hash/ID, read catalog again,
abort/retry if the catalog changed, then validate the complete snapshot and
write a new local file. It never calls LOCK/PUT/DELETE or logs note content. The
output directory must be mode 0700 and the new snapshot mode 0600; the JSON
contains private Notes content and must stay outside Git. It has no 2 MB cap;
the migration CLI accepts up to 50 MB. If the real export exceeds 50 MB, stop
and extend the importer before migration rather than split JSON blindly.

The exporter was tested on synthetic Koofr fixtures with Node 24: 2/2 tests
pass, all exporter requests were GET, snapshot hash/count matched source, and
rollback restored a post-cutover edit without losing token-box. It has not read
the real Koofr source. The Vercel CLI confirms six Production values are Secret
and write-only; `vercel env run` cannot retrieve them. Current production source
size/count/hash are therefore unknown, and no snapshot file exists yet.

## Namespace, shares, revisions, and drafts

Keep the current Production `NOTES_DATA_NAMESPACE`, `NOTES_SESSION_PASSWORD`,
`NOTES_BASE_URL`, Homepage auth settings, and UI/session contract unchanged.
Only set the Firestore backend and its project/vault/WIF configuration on the
Production deployment after final approval. The migration imports the original
catalog epoch, note IDs/revisions/history, folder/order state, shares and their
`tokenHash`/`tokenBox`, idempotency receipts, trash and purge tombstones. The
same namespace and session key keep token-box AAD and existing share URLs valid.
Browser drafts remain on-device and the unchanged namespace/revision contract
lets the app reconcile them through its existing CAS path.

Do not use the old rollback example that restored to a fresh Koofr namespace:
that would change namespace-bound token-box decryption and could break existing
share URLs. The new `rollbackSnapshotIntoExisting()` writes missing immutable
records under the original Koofr root lock, verifies the captured pre-cutover
catalog hash and epoch, and publishes the current Firestore snapshot as the new
catalog. It does not delete Koofr files. If any Koofr writer changed that root
after the baseline, it fails closed. This path preserves namespace, revisions,
share token-boxes, receipts and all edits captured from Firestore. Fixture tests
cover this protocol; a real Koofr rollback has not run.

## Cutover and rollback runbook (requires review)

1. Provision a dedicated Production GCP project/database and exact Production
   WIF/service account as above. Add WIF identifiers and Firestore project/vault
   values only to the Production target. Keep Koofr secrets/configuration and
   auth/session values unchanged. Do not grant the Preview identity Production
   access.
2. Read/export Koofr through the GET-only exporter into a private 0700 directory.
   Record its byte length, SHA-256, source catalog SHA-256, and active/trash note,
   folder, share, receipt, and erased-ID counts. Verify locally before import.
3. Import to the dedicated Production Firestore vault and run `compareSnapshots`
   until count/hash parity passes. Prepare and validate a Firestore backup before
   switching; do not write Notes into the production vault during preparation.
4. At the approved cutover, freeze writes, capture a final Koofr snapshot/hash,
   import/verify the exact final state, then deploy the Production backend config.
   Check owner open/save, a shared link, trash/restore and Code Inbox. Re-enable
   writes only after readback and health checks pass.
5. For rollback, freeze writes again, export the current Firestore state, and
   apply it to the original Koofr namespace with the recorded baseline catalog
   hash. Verify full counts/fingerprint including shares/token-box and receipts;
   then deploy Koofr backend configuration without changing namespace/session
   settings. Re-enable writes only after verification. Keep Firestore and the
   original Koofr root until a separate retention decision; never auto-delete
   either source.

Estimated write downtime is **not yet measurable**: it is the final source
snapshot + Firestore import + parity check + deployment/readback duration, and
the real source size/count is unknown. The prior cloud smoke was a small
synthetic test and is not an estimate for production Notes. Measure this after
the private snapshot and a pre-import dry-run; do not promise a duration before
then.

## Single missing input

Select/provide the ID of an existing dedicated Production GCP project that is
already authorized for Notes and has an existing Firestore database or can create
one without enabling billing. `notes-lab-56f0f` is explicitly test-only and is
not a safe substitute. Once that project is identified, verify IAM mutation
permissions and create the separate Production WIF/SA. Snapshot access is a
separate blocker: production Koofr credentials are write-only Vercel Secrets, so
we need an approved read-only export execution path that runs inside Vercel's
Production runtime or a user-managed secure transfer; no Secret value should be
sent in chat.

Official references: [Vercel GCP OIDC](https://vercel.com/docs/oidc/gcp),
[Google Workload Identity Federation](https://docs.cloud.google.com/iam/docs/workload-identity-federation),
[Firestore per-database IAM conditions](https://docs.cloud.google.com/firestore/native/docs/manage-databases),
[Firestore server-library IAM](https://docs.cloud.google.com/firestore/docs/security/iam),
[Vercel Environment Secrets](https://vercel.com/docs/cli/env).
