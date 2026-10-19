# Performance qualification, 2026-10-19

## Evidence and release boundaries

PR #4 passed CI and 95 local fixture tests, but subsequent burst qualification exposed that parallel notes/folders reads contend on the root lock. PR #5 replaces them with one atomic owner bootstrap snapshot. This reduces API requests from 2 to 1 and catalog lock cycles from 2 to 1, without removing fencing or revision checks. No measured real-provider before/after milliseconds are available.

Owner cache is keyed by a server HMAC of namespace, account and password generation, delivered only after authentication. Authentication does not access Koofr. Cached list paint waits for owner authentication; this deliberately does not unlock sensitive data offline. Existing draft database is untouched. Complete content is opt-in for private devices; shared links do not use persistent cache. Opening cached content renders immediately and checks the current server revision. A response cannot replace a session once typing has started. Saves still require exact revision and acknowledged operation ID.

GET-only BUSY retries: at most 4 attempts with 1–3 second jittered waits. POST is not retried by the transport. Existing SyncDraft retries preserve operation identity. Shared pages revalidate on return and every minute including while editing; revocation hides the editor and cards, preserving unsynced drafts.

## Synthetic load

Run `node scripts/fixture-load.mjs`. This is an in-process HTTP handler with fake WebDAV, no real credentials/network and no Vercel billing metrics. See `results/2026-10-19-fixture-load.json` for timings and request counts. The synchronized zero-delay bursts are deliberately adversarial: 50 viewers yield 1 success/49 BUSY; 100 viewers yield 1 success/99 BUSY. Mixed 5/50 and 10/100 edit bursts have the same admission result. Reported p50/p95 include fast rejected requests and are NOT successful-request latency or Koofr capacity.

These results demonstrate that current per-request root locking is insufficient for burst traffic. Do not declare 50–100-user support. A future change needs a separately verified read path or controlled request admission, preserving live revocation and fencing across Vercel instances. In-process coalescing alone cannot guarantee cross-instance behavior. No new service has been added.

## Remaining qualification

Real PC/iPad/phone hardware, real Koofr read/open/save latency, Vercel usage, sustained load and provider retry behavior have not been measured here. Chromium fixtures cover iPad viewport, drafts, conflicting tabs, uncertain responses and share permissions; they are not live Koofr tests. Trash list/restore remains unimplemented. No destructive production smoke test or real-data benchmark is authorized.

## Follow-up: simpler cache and searchable Trash

User removed the private-device option. Only list previews persist by default; full content is kept automatically in session memory, cleared on lock or failed authentication, and revalidated on reopen. Legacy persisted full-content entries and the separate drafts database are preserved. Owner-only Trash searches full text and checklist on the server under the existing collection lock. Restore requires the tombstone revision and preserves immutable content, falls back to unfiled when the original folder no longer exists, and revokes individual Note links to avoid resurrecting old capabilities. No permanent deletion or cleanup was added.
