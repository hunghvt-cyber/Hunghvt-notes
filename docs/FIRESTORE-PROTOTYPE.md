# Firestore compatibility prototype — historical

This prototype note predates the native repository, real Firestore smoke, and
direct Vercel Preview OIDC deployment. Git linking is not required for the
verified direct Preview path. Current evidence and Production blockers are in
[FIRESTORE-NATIVE.md](FIRESTORE-NATIVE.md) and
[FIRESTORE-PRODUCTION-MIGRATION-REVIEW.md](FIRESTORE-PRODUCTION-MIGRATION-REVIEW.md).
The historical resource observations below describe an earlier NAS state.

## Scope and current state

`lib/firestore-storage.mjs` maps the current `NoteStore` fixed-file transport to Firestore documents and transactions. The API/UI and existing business logic remain unchanged in this prototype. It is not wired into `api/app.js` or `appConfig`, and cannot change the live backend. A caller must explicitly inject a Firestore client into `createFirestoreNoteStore`.

Each namespace is isolated under a SHA-256-derived root ID. The catalog and immutable record files have manifest documents plus binary chunks (700 KiB maximum per chunk) so the existing 3.1 MB store-record ceiling does not become a Firestore single-document write. Every file read checks chunk count, byte count and SHA-256. The root lease is an expiring Firestore document; claim, write fencing and unlock each use a Firestore transaction. A stale lease token cannot write or unlock a later owner's lease. Existing `NoteStore` code continues to enforce revision/CAS, idempotency, sharing/revocation, trash/purge/restore and snapshot validation.

This is a compatibility adapter, not the final preferred data model. It preserves tested behavior with a small change surface, but one root lease remains a serialized contention point, and emulating each WebDAV call creates additional Firestore document reads/writes and transactions. It has no measured latency or cost advantage. A direct Firestore repository could use native transactions more efficiently, but would duplicate/rewrite the business logic and require a broader parity review. Keep the current Koofr+Vercel path until an isolated comparison and migration/rollback plan are approved.

## Local checks

`test/firestore-storage.test.mjs` exercises the adapter with an in-memory Firestore-compatible transaction fixture: CAS, idempotency, immutable hash validation, chunked revisions, concurrent root lock, lease expiry/fencing, live share revocation, trash/purge, and export/restore into a distinct namespace. This is a mock protocol test, **not** a Firestore emulator or cloud test.

The Local Emulator Suite configuration is prepared in `firebase.json` with only Firestore bound to `127.0.0.1:8089`, project `demo-hunghvt-notes`, and all client security rules denied in `firestore.rules`. `scripts/firestore-emulator-smoke.mjs` refuses non-`demo-*` project IDs and non-loopback/non-8089 endpoints. The official emulator supports demo projects with no live resources; its Admin SDK client connects when `FIRESTORE_EMULATOR_HOST` is set.

The current NAS inspection found no `firebase` or `gcloud` executable, no Java runtime, no `~/.config/gcloud`, and no `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, or `FIREBASE_CONFIG` environment variable. `FIRESTORE_EMULATOR_HOST` was not configured. Java is required by the Emulator Suite; the Firestore emulator documentation currently warns that Java 21 will be required in an upcoming release. System RAM is 3.6 GiB (about 2 GiB available at inspection), root volume has 1.4 GiB free, and the default Firestore port 8080 is already bound. A temporary Java 21 download was attempted for a loopback-only emulator test; the transfer was below 50 KiB/s with an ETA over 20 minutes, so it was canceled before installation. All temporary download/cache directories were removed. The real emulator was not started, and no cloud session/permissions could be verified.

## Cloud auth plan, only when a project is authorized

Do not reuse Gemini CLI/API, Koofr, Homepage, or another app's credentials. Firestore server clients use Google Cloud IAM; server Admin/Google Cloud client access bypasses Firestore client Security Rules. Keep the application API as the only user-facing path and deny client SDK access. Prefer Vercel's documented Google Cloud Workload Identity Federation so the Preview/Production function receives short-lived access without storing a service-account JSON key. Grant only the dedicated service account `roles/datastore.user`, with Vercel identity trust scoped to the intended project and environment. Do not enable billing as part of this prototype.

For a real emulator run, install/use Firebase CLI and a supported Java runtime only after checking NAS resource headroom and package space. Run only with the prepared `demo-hunghvt-notes` project; never run the smoke script with a real project ID. Do not create a Firestore database or write real Notes until separately authorized.

When cloud authorization is needed, use the existing Google Cloud project if one
is available; do not create a new project or enable billing as a workaround. On
a phone or iPad, start at [Firebase Console](https://console.firebase.google.com/)
or [Google Cloud Console](https://console.cloud.google.com/). Setup requires a
project administrator who can create the Firestore database, a workload identity
pool/provider, and a dedicated service account; assign that runtime account only
`roles/datastore.user` and grant the Vercel identity scoped impersonation. Share
only non-secret project/pool/provider identifiers when ready. Never download a
service-account JSON key or send a token/password through chat. Vercel can store
the non-secret identifiers and exchange its short-lived OIDC identity; no
long-lived Google key is needed.

Official references:

- [Firebase Local Emulator Suite installation and configuration](https://firebase.google.com/docs/emulator-suite/install_and_configure)
- [Connect to the Firestore Emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore)
- [Firestore billing and free quota](https://firebase.google.com/docs/firestore/pricing)
- [Firestore server library IAM](https://cloud.google.com/firestore/docs/security/iam)
- [Vercel OIDC to Google Cloud](https://vercel.com/docs/oidc/gcp)
- [Google Cloud Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
