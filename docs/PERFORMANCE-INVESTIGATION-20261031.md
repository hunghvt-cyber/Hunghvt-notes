# Notes performance investigation — 31 October 2026

## Current source and release

- Canonical repository: `hunghvt-cyber/web-notes`.
- Candidate base: `origin/main` at `fa8d686d077394fdee81f0bcb5f0cb464976f5c2`, tree `df8b66e5277d6c50f395b78f9903e9baf53e5943`.
- PR #43 is merged at `b3a4de5b7a86d3adc95ab4064de5c0a9cdddb249`; Production is still READY on `dpl_6JvV65W8wi6AQgyNfbUfA7gjC5LJ`, primary alias `hunghvt-notes.vercel.app`, region `fra1`. Vercel alias readback lists `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, and `hunghvt-notes-git-main-hunghvt.vercel.app`; bypass objects are empty. A read-only primary health GET returned HTTP 200, `firestore-native-v1`, `configured=true`, `firestoreRead=PASS` and initialized vault.
- Candidate branch: `codex/notes-speed-fix-20261031`. The original dirty worktree `/home/admin/Hunghvt-notes` was left unchanged. No code was merged or deployed.

## Cache findings

`cacheContent()` runs only after the note GET succeeds, and it keeps the full acknowledged response in RAM plus the authenticated cache record. `cacheAuth()` restores that content only when the list row has the same ID and revision. A server list refresh prunes entries whose row is absent or whose revision changed. Drafts are not part of this cache; the legacy IndexedDB draft database is untouched.

The limit applies to UTF-8 bytes of `JSON.stringify(note)`, which includes title, current text, checklist, history, folder and present metadata. The per-note cap is 256 KiB; aggregate content is capped at 1 MiB and 12 notes. Oversized note content is omitted. Entries can also be evicted under the aggregate/count cap. Synthetic tests exercise small notes, large current text, large checklist/history, exact revision reuse and invalidation after a changed list revision.

These rules make repeated misses plausible for a large historical note. They do not prove why the reported note missed: its size, persisted content entry and list revision were not part of the supplied samples. In a clean same-page open, an entry under the limits and with an unchanged list revision should hit. New diagnostics classify misses as `entry_absent`, `revision_mismatch`, `missing_from_list`, `note_too_large`, `content_budget_eviction`, `shared_content_disabled` or `cache_unavailable`. They export only enum counts. The reason lookup uses a RAM-only, 64-entry map keyed internally by note ID; IDs are not exported. A cause lost across reload remains unknowable.

## Request timing findings

The measured client `network_ms` is fetch start to response headers and includes Vercel, server execution and network time. `response_body_ms` includes receiving body bytes and JSON parsing. Neither identifies Firestore duration.

Source inspection traces an owner note read through session validation, store construction/reuse, `FirestoreNativeStore.get()` and one `FirestoreNativeRepository.read()` transaction. That transaction reads vault and note metadata, queries up to six complete version documents, and builds current content plus up to five history entries. Small versions carry payload in the version document; chunk reads run in parallel when needed. Known-revision validation can return before version-content reads. The Firestore client uses `maxAttempts: 5`; source does not establish which network/RPC step accounts for the device latency. Full history therefore adds query/payload work, but no supplied measurement attributes the observed delay to history or Firestore.

For the next opt-in sample, traced requests add `Server-Timing` values on the same request: handler pre-response duration, auth duration, store initialization and accumulated store-operation duration. Store operation includes any lazy Vercel OIDC token acquisition, Google auth/Firestore SDK work and Firestore operation. It does not isolate Firestore from those components. Handler pre-response excludes JSON serialization and platform queue/cold start before invocation. No extra request or server log was added. These durations are emitted only on diagnostics-enabled requests and exported into the existing bounded RAM summary.

## Changes in this candidate

- Added a fixed cache-miss reason enum and count summary; cache limits and reuse rules did not change.
- Added opt-in `Server-Timing` durations and client parsing; diagnostics remain off by default.
- Kept draft handling RAM-only, and left authentication, revision CAS, frozen operation retry, valid ACK status and Firestore authorization unchanged.
- Added synthetic cache policy and API timing tests, plus a Chromium fixture covering small/large/history notes, reopen, intervening list refresh and diagnostic server spans.

## Validation and limits

Local environment is Node `v22.23.4`, while the repository declares Node 24. `npm ci --ignore-scripts --no-audit --no-fund` completed under Node 22 with an engine warning. Final local validation on the candidate: `npm test` 203/203; `npm run check:source` 50 files; `git diff --check` pass; `npm run test:browser` 40/40 synthetic Chromium scenarios. The new browser fixture confirmed one small-note content GET followed by reusable cache hits across list refresh, and repeated large-current/history misses classified after the initial absent-entry miss. It also confirmed diagnostic Server-Timing phases in the exported summary. These are synthetic fixtures, not Vercel OIDC/Cloud Firestore runtime evidence and not device latency evidence. No real Notes were read or changed; no billing, IAM/WIF, Production configuration, or deployment was changed. No post-change S25 Ultra/iPad data is available, so no speedup is claimed.

PR and hosted CI: pending candidate publication.
