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

## Verified status update — 2026-10-27

This section supersedes the earlier project-selection, identity, and “no real
snapshot” statements above. The owner selected the existing `notes-lab-56f0f`
project for eventual Notes data; no additional project or billing change is
needed. Its `(default)` database is Firestore Native.

The Preview service account's project-level Firestore role and exact Preview
impersonation grant were removed, and its `vercel-notes-preview` pool was
disabled. Two real requests from the old Preview runtime identity were denied
after propagation. The original project and service-account policies were
inspected; no inherited grant to that Preview identity was found. Do not
re-enable this identity for Notes.

A separate `notes-production-firestore` service account and
`vercel-notes-production` pool/provider now use issuer
`https://oidc.vercel.com/hunghvt`, audience `https://vercel.com/hunghvt`, and
the exact subject `owner:hunghvt:project:hunghvt-notes:environment:production`.
Only that subject can impersonate the account. `roles/datastore.user` is
conditioned on `projects/notes-lab-56f0f/databases/(default)`. There are no
user-managed service-account keys. A staged Production runtime made an
authenticated read of a synthetic nonexistent probe document successfully;
the request confirmed Vercel OIDC → STS → Firestore, without writing a Notes
document.

A temporary exporter ran only on an SSO-protected staged Production deployment
with the existing Koofr runtime Secrets. Unauthenticated access redirected to
Vercel protection, authenticated health reported `koofr-v1`, and POST was
rejected with 405. The endpoint exposed only health, catalog/record reads,
identity check, and final source-stability verification; it had no write route
or background job. Its GET-only run verified each record ID/hash and the same
catalog hash before and after export. The private snapshot is stored outside
Git, under a 0700 directory, as a 0600 gzip file; its raw JSON is 1,829,423
bytes, below the 50,000,000-byte migration limit. The migration verifier
returned `VALID` with fingerprint
`5d652b5743f3d79735a1df1f917ff378649a89a767e80073934a9e78192235b5`.
Counts and content remain in the private NAS state, not this public repository.

The exporter routes and all three temporary staged deployments were removed
after verification. The two existing Production aliases still resolve to
their original deployment IDs (`dpl_CQ27eV3fHP5ebfTTEhci86PxwA41` and
`dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`). The live backend remains Koofr; no Notes
data has been imported into Firestore and writes were never frozen.

The migration CLI now verifies `.json.gz` directly with a 50 MB expanded-size
limit. Its native Firestore export can use that same 50 MB limit while the
existing app backup route retains its 2 MB cap. This permits rollback to export
the post-cutover Firestore state, including later edits, and restore it into the
original Koofr namespace against the recorded pre-cutover catalog hash. Do not
roll back from the pre-cutover snapshot: capture the current Firestore state
first, preserve namespace/session settings, and fail closed if Koofr's catalog
changed outside the approved write freeze.

At the cutover review, capture a fresh final Koofr snapshot after writes are
frozen, verify it, import and compare it in the chosen vault, then switch only
the Production backend configuration. No production switch, Firestore import,
or write freeze has been performed in this preparation.
