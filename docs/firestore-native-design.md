# Native Firestore repository direction

Status: local design/prototype on `codex/notes-firestore-native-20261027`.
This repository is not selected by `api/app.js`; Koofr remains the live store.
This document records the initial prototype stage. It is superseded by the
completed Firestore repository and smoke described in [FIRESTORE-NATIVE.md](FIRESTORE-NATIVE.md):
the real cloud smoke passed on 2026-10-27, while Koofr remains Production.

## Why a native repository

The compatibility transport added earlier deliberately preserves the old
`NoteStore` catalog and its single fenced root lease. That makes it useful for
parity experiments, but it keeps the whole-vault serialization point and the
extra snapshot/revalidation round trips. It should stay a compatibility trial,
not the target if the goal is lower open/save latency.

The native prototype in `lib/firestore-native-repository.mjs` uses per-note
documents and Firestore transactions. Its save/read/share paths are not wired
to production handlers yet. It is deliberately dependency-injected so local
tests can exercise CAS/idempotency logic without claiming they prove Firestore.

## Proposed schema

```text
notes/{noteId}                         # current revision, folder, trash state, pointer
notes/{noteId}/versions/{revision}     # immutable content snapshot + content hash
notes/{noteId}/versions/{revision}/chunks/{n} # only above 750 KiB encoded payload
notes/{noteId}/operations/{opId}       # immutable request hash + compact result
shares/{shareId}                       # capability hash, scope, permission, active/epoch
accessGuards/{scope_hash}              # valid active-share count for Code Inbox exclusion
folders/{folderId}                     # folder names/state; native API still to implement
order/{owner}                           # order revision and IDs; native API still to implement
purges/{noteId}                         # durable purge work journal; native API still to implement
```

Each version is a complete content snapshot. History is obtained by reading at
most five preceding version documents; it is not embedded repeatedly in the
current content or metadata. Payloads under 750 KiB stay in one version
document. Larger legal payloads are split into 700 KiB binary documents and
verified against one SHA-256 manifest. This is a safety threshold, not a
performance result. A prototype test covers one chunked version.

`operations/{opId}` is created in the same transaction as the version and
metadata pointer. It stores only request hash and compact result, not note text.
Receipts are not automatically expired: Firestore TTL deletes require billing,
so cleanup/retention needs a deliberate free-tier-compatible policy.

Folder IDs and ordering stay outside note text. The phone/iPad draft and
acknowledgement state remains in the existing browser IndexedDB/session code;
the API continues to require the exact acknowledged revision and immutable
operation ID. Code Inbox keeps its existing GitHub OIDC verification, encrypted
envelope, deterministic note IDs, and allowlist; its save uses the same CAS path
plus transaction reads of note/folder share guards.

## Transaction and race model

- **Open owner:** transaction reads note metadata, then a query of up to six
  immutable versions. No write lock is taken on another note. A known revision
  returns after metadata only.
- **Open through a share:** the same transaction also reads and validates the
  share document and note/folder scope. Share revocation is a write to that
  share document. Firestore serializable transaction commit-time isolation
  orders a racing read/write before or after the revoke; subsequent requests
  see the revoked state. There is no local token cache.
- **Save owner:** transaction reads metadata, operation receipt, and current
  version (two reads for a new note); checks the expected revision; then writes
  the immutable version, note metadata and receipt atomically. A conflicting
  writer retries the transaction, sees the new revision and gets a 409. Chunk
  documents are written in the same transaction, so a failed transaction does
  not leave a partial version.
- **Save through a share:** adds one share-document read and validates
  permission/scope in that transaction. The link is rechecked even for replay.
- **Code Inbox:** adds two guard reads, one for note links and one for a folder
  link. Share creation/revocation updates the corresponding guard in the same
  transaction, preventing a check-then-create race. Inbox never receives access
  to arbitrary notes.
- **Independent notes:** ordinary note saves no longer read/write a vault root
  catalog or acquire a common lease. Contention is limited to the note and the
  specific share/guard documents involved. Frequent edits to one note can still
  contend on that note; Firestore does not promise a universal per-document
  write rate.

Transaction callbacks must remain side-effect free because server SDKs retry
them. The injected prototype takes `maxAttempts: 5`; actual retry count and
latency must be measured against emulator/cloud. Firestore server transactions
are serializable by commit time; a mock cannot establish that behavior.

## Document operation estimates

Document counts below are logical billed reads/writes for the current prototype
shape, before retries and excluding query index-entry charges. A missing
document lookup is still a document read. `K` is the number of chunks for the
current version. Previous history chunks add their own reads. The official free
allowance is per project and does not guarantee that a cloud test is free if
other usage already consumed it.

| Operation | Reads on successful attempt | Writes on successful attempt |
| --- | ---: | ---: |
| Owner cold open (current + five history snapshots) | 1 metadata + up to 6 versions = up to 7 | 0 |
| Shared cold open | previous row + 1 share = up to 8 | 0 |
| Known-revision open | 1 metadata; +1 share if shared | 0 |
| Owner save existing note | metadata + receipt + current version = 3 | metadata + version + receipt = 3, plus K chunks |
| Owner save new note | missing metadata + missing receipt = 2 | metadata + version + receipt = 3, plus K chunks |
| Shared save existing note | previous row + share = 4 | same 3 + K chunks |
| Share permission check endpoint (not yet implemented) | share + note metadata = 2 | 0 |
| Create note share | note metadata + guard = 2 | share + guard = 2 |
| Revoke share | share + guard = 2 | share + guard = 2 |
| Code Inbox status | currently full owner open, up to 7; can become 1 if text hash is stored in metadata | 0 |
| Code Inbox save existing | note + receipt + two guards + current version = 5 | 3 + K chunks |
| List active notes | one read per returned metadata doc | 0 |
| Trash list | one read per returned trash metadata doc | 0 |

`includeNote` currently performs a follow-up open to build the history response;
that can add up to seven reads (plus chunks). A production API should return
the exact committed revision, not a newer head if another writer wins between
save and response hydration; this response path is an explicit prototype gap.

For a transaction retried `R` times before success, budget the reads for every
attempt (`sum(reads_i)`; at the simple upper bound, `R × reads/attempt`). Only
the committed attempt writes the new logical documents; failed transactions do
not partially apply writes. Network/SDK retries and query index reads can add
work, so the table is a schema estimate, not cloud billing telemetry.

## Behavior still requiring design before adapter parity

The native class currently implements note open/save, share create/revoke and
the Code Inbox guard checks. It does **not** yet implement folder management,
order CAS, a trash listing/restore/purge API, a consistent backup/restore, or a
real Firestore lifecycle test.

The current WebDAV catalog makes folder deletion, multi-note moves, order
changes, trash state, share revocation, and backup catalog publication atomic
under one root fence. The native path must preserve their visible semantics
without recreating that global lock. In particular, folder delete/move can
touch hundreds of note metadata documents; a Firestore transaction holds locks
on exactly those documents and may retry on contention. The existing store
allows batches of up to 500 notes. Before parity, define how a 500-note move
records idempotency without exceeding SDK/API request, request-size and lock
deadlines, and how interrupted trash purge resumes without deleting live or
restored data. Do not replace those actions with partial non-atomic batches
without changing/reviewing their UI guarantees.

Trash search currently searches note content. A metadata-only trash query does
not preserve that behavior; scanning bodies costs O(number of trash notes) reads
and may need chunk reads. A search index would add write/storage/privacy costs.
Backups require a separately designed consistent snapshot and restore protocol;
managed Firestore backup/PITR is outside the no-billing boundary.

## Existing compatibility logic: reuse / replace

**Keep/reuse:** `noteInput` validation and size checks, `validNoteId`, request
hash/idempotency concepts, the browser draft/CAS/frozen-operation flow, shared
UI and capability-link model, GitHub OIDC verification/decryption, deterministic
Inbox slots, and the higher-level API request/response contracts.

**Replace for native storage:** `NoteStore.locked()` and the global DAV
catalog/root lease; catalog snapshots and double-read open validation;
immutable filename/If-header fencing; catalog-level receipts/folder/order/share
maps; and DAV backup/purge internals. Firestore document transactions provide
the atomic per-note commit instead. Admin server clients use IAM and bypass
Firebase Security Rules, so application-level owner/share/Inbox checks remain
mandatory.

## Gemini review and Codex verification

One filtered advisory was sent through `gemini-task`; it contained this schema
and behavior list only, with no Notes content or credentials. Gemini correctly
flagged same-note contention, multi-note move contention, receipt retention,
chunk read amplification, trash purge fanout, and the need to validate share
scope on every shared read/write. These match the inspected code and official
transaction semantics.

Codex rejects two unsupported parts of that response: a universal “one write per
second” note limit is not in current Firestore docs (the exact rate is workload
dependent), and the cited “500 reads plus 500 writes exceeds a 500 total-op
limit” is not a documented transaction rule. Google’s release notes say the
service removed the old 500-write cap for Commit/transactions in 2023; current
quotas list a 500 field-transform limit, not a combined read/write count. Some
client SDK API references still document 500 writes, so the exact behavior of
the pinned Node server SDK must be checked against its installed version and a
real target before claiming atomic 500-note operations. We also reject Firestore
TTL for receipts under the no-billing condition, moving local drafts into cloud
storage, or using signed capabilities without a live revocation check: those
suggestions add cost or change existing semantics without a demonstrated speed
benefit.

## Smallest useful cloud measurement

The NAS check found no `gcloud`, `firebase`, Java, ADC configuration or cloud
project environment in the checked shell. Do not repurpose Gemini/Koofr/Homepage
credentials. For a one-off test, the least setup is a phone/iPad browser session
into Google Cloud Shell, using an already-authorized, dedicated non-production
project with an existing Firestore database and a user identity granted
`roles/datastore.user`; Cloud Shell supplies `gcloud` and Node and uses the
signed-in Google identity. Run a synthetic-only create/read/update/conflict/
revoke/delete probe in one named namespace, then verify and delete only that
namespace. This is separate from NAS execution and does not require Vercel
production OIDC. `roles/datastore.user` grants project-level database read/write,
so a production Notes project is not an acceptable smoke-test target. If no
isolated project/database exists, stop rather than create a project or enable
billing.

For NAS-to-cloud testing, first install/use Google Cloud CLI and authenticate a
dedicated human ADC session or a narrowly scoped workload identity; no suitable
session exists now. Do not copy a JSON service-account key into NAS. For Vercel
production, separately configure Workload Identity Federation for the exact
Vercel project/environment and a dedicated service account with
`roles/datastore.user`. That production trust setup is unnecessary for a
Cloud-Shell smoke test and must not be started just to answer a latency question.

The immediate experiment should be one synthetic owner path and one shared
path with a competing owner writer; record API wall time plus Firestore read,
write and retry counts. Emulator behavior is useful after the CLI/Java resource
question is solved but is not cloud proof. No cloud or emulator run is included
in this branch's evidence.

## Official sources checked 2026-10-27

- [Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Transaction isolation/contention](https://firebase.google.com/docs/firestore/transaction-data-contention)
- [Firestore limits](https://cloud.google.com/firestore/quotas)
- [Firestore billing](https://firebase.google.com/docs/firestore/pricing)
- [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices)
- [Server client IAM](https://cloud.google.com/firestore/docs/security/iam)
- [Launch Cloud Shell](https://cloud.google.com/shell/docs/launching-cloud-shell)
- [ADC in cloud development environments](https://cloud.google.com/docs/authentication/set-up-adc-cloud-dev-environment)
- [Firestore release notes (write limit removal)](https://cloud.google.com/firestore/docs/release-notes)
- [Vercel GCP OIDC](https://vercel.com/docs/oidc/gcp)
