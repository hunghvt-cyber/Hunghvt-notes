# Firestore native backend: implementation and guarded rollout

## Current runtime state

The live release still uses Koofr. The native store is selected only when
`NOTES_BACKEND=firestore-native-v1` is explicitly present. Production selection
also requires `NOTES_FIRESTORE_PRODUCTION_REVIEW=approved-v1`; that value is not
set by this branch or in production. The isolated test project is
`notes-lab-56f0f`; no Notes data or production credentials have been read.

`FirestoreNativeStore` implements the API store contract, and both the Notes API
and Code Inbox use the same async store factory. Session cookies, cache identity,
draft handling, API response shapes, capability links, GitHub OIDC verification,
and the Code Inbox allowlist remain in their current layers. Firestore is an
Admin/server client, so application-level authorization checks remain required;
`firestore.rules` must not be treated as the authorization layer for this code.

The compatibility adapter in `lib/firestore-storage.mjs` remains useful for
transport parity tests, but it still has a whole-vault lock and is not the
native target.

## Native schema and concurrency

All native data is isolated under `notesVaults/{vaultId}`. A vault is initialized
only by an explicit provisioning/smoke/migration action; request handling never
creates a missing vault implicitly.

- `notes/{noteId}` stores the live metadata pointer, logical revision, folder,
  trash/purge state, ACL epoch, and a short list preview.
- `notes/{noteId}/versions/{contentRevision}` stores an immutable content
  snapshot and SHA-256 manifest. Payloads above 750 KiB are split into 700 KiB
  chunk documents and checked on every read. Five previous snapshots are
  retained for the existing history UI.
- `notes/{noteId}/operations/{opId}` and `operationReceipts/{opId}` store
  request hashes and compact results in the same save transaction. Replays
  validate the same operation and do not write note content a second time.
- `shares/{shareId}` stores a capability hash, scope, permission, live flag,
  epoch, target ACL epoch, and the existing encrypted token copy when present.
  Note reads/writes recheck the capability in their transaction. Revocation and
  the competing operation both read/write the same share document; Firestore
  retries one side, and a later request sees the revoked state.
- `accessGuards/{scope_hash}` fences Code Inbox against a note/folder share
  created concurrently. Inbox also checks its deterministic ID, fixed folder,
  operation ID, CAS revision, and response hash readback.
- `folders/{hash}` stores folder names and state. Folder deletion first marks a
  folder as deleting, blocks new moves/saves/shares, and processes up to 200
  note metadata rows per transaction. Its journal makes interrupted batches
  resumable. `orders/owner` has an independent revision CAS and does not change
  note content revisions.
- `folderOperations/{generation-and-mode-hash}` stores resumable folder-delete work. Deleted folder rows remain as tombstones with a generation counter so a recreated folder can be deleted independently and retries of the old delete remain idempotent.
- Purge fences one note, recursively removes only that note's versions/chunks/
  receipts, then leaves a purged tombstone. Retrying the same operation resumes;
  other notes are not locked.

An ordinary save reads the vault root, note metadata, note/global receipts, the
current content version, plus its destination folder when applicable. A save
writes metadata, immutable version, two compact receipts, and any chunks (plus a
new folder if needed). A cold owner open reads the vault root and note metadata,
then the current version plus up to five history versions; each large version
may add chunk reads. A known-revision open reads the root and metadata. Shared
opens add a capability read and, for folder shares, a folder-state read. Inbox
saves add two access-guard reads. Lists read each matching metadata document.

A move reads the root, receipt, destination folder when non-empty, and each
selected note, then writes those note rows and one receipt. An order change reads
the root, owner-order row, receipt, and active-note membership query; it writes
the order row and receipt. Folder deletion costs one start transaction, one
transaction per 200 active notes, and a final empty-page transaction. Purge
reads/deletes only the selected note's descendants and matching share rows.
Backup reads the vault/catalog metadata, all note metadata, shares, folders,
order and operation receipts, then the immutable current version/chunks. Restore
writes bounded batches while the root remains `restoring`, compares the
snapshot's note/content hashes, folders, order, shares, receipts and tombstones,
and only then makes the vault available.

These are successful-attempt logical document counts, not billing telemetry.
Transaction retries repeat their reads; only the committed attempt's writes
apply. Index-entry charges and provider retries are not included. The Firestore
service removed its former 500-write transaction cap; the 200-row folder batch
is a smaller operational batch for request size/retry duration, not a claimed
service limit. The service still has a transaction request-size/time budget.
See the official [Firestore quotas](https://docs.cloud.google.com/firestore/quotas)
and [release notes](https://docs.cloud.google.com/firestore/docs/release-notes).

## Backup, migration comparison and rollback

`FirestoreNativeRepository.exportLegacySnapshot()` exports the existing
hash-verified snapshot shape; it refuses an incomplete restore or in-progress
purge. Native restore validates the snapshot before writing, uses a deterministic
snapshot hash to resume, preserves note content/history/revisions, folder order,
shares, operation receipts, and purged-ID tombstones, and verifies before
clearing the restore gate.

`lib/firestore-migration.mjs` compares the normalized snapshot fingerprint and
reports counts for active/trash notes, folders, active/revoked shares,
operation receipts and erased IDs. It hashes note contents without printing
them. The CLI defaults to validation/dry-run; remote import/export and rollback
require `--apply`. Snapshot input files must already have mode `0600`, live
outside the repo, and are never included in diagnostic output.

Examples after an explicit reviewed snapshot is available:

```sh
node scripts/firestore-migration.mjs verify --snapshot /secure/path/notes-backup.json
node scripts/firestore-migration.mjs import --snapshot /secure/path/notes-backup.json --project notes-lab-56f0f --vault migration-preview --apply
node scripts/firestore-migration.mjs export --project notes-lab-56f0f --vault migration-preview --output /secure/path/firestore-backup.json --apply
node scripts/firestore-migration.mjs rollback --snapshot /secure/path/firestore-backup.json --namespace Hunghvt-Notes-Rollback-UUID --apply
```

The rollback command restores to a *new Koofr namespace*, never the active one.
It uses the dedicated Notes WebDAV variables only when deliberately invoked.
The explicit rollback policy rebases receipt/order revisions to the fresh epoch
and preserves capability hashes/permissions. The token-box is dropped because
it is namespace-bound; recipients who already have a link retain access, while
the owner cannot recover that old URL from the rollback copy and can still
revoke it or issue a replacement. The original Koofr root remains intact until a
separate reviewed switch; local drafts keep their previous revision and remain
available for safe conflict/rebase handling.

The current Notes backup endpoint has a 2 MB cap. The CLI can validate/import
larger local snapshots up to its 50 MB input guard, but producing a larger
source snapshot from Koofr needs a dedicated streaming export path before a
large production dataset is migrated. This has not been inferred from real
Notes data and remains a review gate.

## Google authentication paths

### NAS one-off test

The NAS has a private Google Cloud CLI 590.0.1 install for Linux ARM64 under
`/home/admin/.local/opt/notes-google-cloud-cli`; its official archive SHA-256 was
verified. `/home/admin/bin/notes-gcloud` sets a dedicated HOME and Cloud SDK
config under `/home/admin/.local/state/notes-gcloud-home`, without changing
shell profiles. The only ADC file accepted by the code is
`/home/admin/.local/state/notes-gcloud-home/.config/gcloud/application_default_credentials.json`.

Google documents `gcloud auth application-default login --no-launch-browser`
for completing the sign-in in a separate browser. With the wrapper, the person
opens the printed URL on a phone, signs into the intended Google account, and
pastes the one-time code directly into that NAS terminal prompt. The code is
not sent to Codex or written into chat/logs. The command also uses
`--disable-quota-project`; it does not enable billing. The account needs
`roles/datastore.user` on the isolated test project. See Google's [ADC setup](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment), [login command](https://docs.cloud.google.com/sdk/gcloud/reference/auth/application-default/login), and [Firestore IAM roles](https://docs.cloud.google.com/firestore/docs/security/iam).

The smoke runner is hard-bound to `notes-lab-56f0f`, requires Node 24 and the
isolated ADC file, creates two random vaults, tests read/save/CAS/sharing/revoke,
folder deletion, trash/restore/purge, snapshot/hash restore, then recursively
deletes only those vaults. It does not provision the Firestore database or
change billing. No cloud request has succeeded yet; version checks alone are
not considered proof.

### Vercel deployment path (separate)

Vercel Functions use `@vercel/oidc`'s `getVercelOidcToken()` and Google
Workload Identity Federation via `google-auth-library`. The external-account
configuration must be bound to the exact Vercel project/environment and a
separate service account with Firestore data access. Production has a second
explicit review gate. NAS ADC is never reused by Vercel. Google sign-in for the
NAS smoke does not configure Vercel trust or deploy Notes. See the official
[Vercel GCP OIDC guide](https://vercel.com/docs/oidc/gcp).

## Verification evidence and limits

- 2026-10-27: a real NAS smoke against project `notes-lab-56f0f`, database
  `(default)`, completed with `PASS`. It verified isolated-vault init,
  owner-save/open, known-revision read, CAS rejection, share/open/revoke,
  folder delete/readback, trash/restore, count/hash snapshot restore, and purge.
  The runner then deleted both synthetic vault roots; a separate authenticated
  read confirmed both roots absent. One run only: observed end-to-end times
  were about 1.35 s initialize, 0.38 s save, 0.40 s owner open, 0.95 s folder
  delete, 1.06 s trash/restore, 2.02 s snapshot restore, and 2.06 s purge.
  These include NAS/network/API overhead and are not a latency benchmark.
- The first real attempts exposed two code defects that fixtures had missed:
  first-save creation of a new folder referenced its timestamp before
  initialization, and snapshot capture mistook a completed folder tombstone for
  an in-progress deletion. Both were corrected and regression-tested. The full
  offline Node 24 suite now passes 170/170.
- Local Node 24 fixture tests exercise CAS, independent-note writes, share
  revocation, chunk hashes, Code Inbox share guards, bounded/resumable folder
  deletion, and snapshot/restore including history, revision, shares and
  idempotency. These are simulation evidence, not Cloud Firestore proof.
- The Cloud smoke requires the one-time NAS ADC sign-in described above. Until
  it passes, cloud transaction behavior, IAM access and latency remain
  unverified.
- No Koofr production read/write, Vercel deployment, billing change or real
  Notes migration is included in this branch.

## Gemini advisory

Gemini reviewed the sanitized schema/race summary once using `gemini-task`; no
Notes content, credential or provider log was sent. Its cautions about share
revocation, folder-delete races, trash/order coordination, idempotent receipts
and resumable purge were checked against the source. The current transactions
read the exact share/guard/folder documents they depend on; a racing write
causes transaction retry. Folder deletion and purge use resumable per-scope
journals. Gemini's reference to a universal 500-write transaction cap is
obsolete and was corrected using current official Firestore release notes.
