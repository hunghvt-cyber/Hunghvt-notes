# Step 1: fewer collection lock cycles (trial branch only)

Base: `89f55529e2f092dd218885f39b1bc8626444bcf0`.
Scope: retain Koofr + Vercel, collection locking, immutable revisions, catalog schema,
CAS, fencing, durable operation receipts and live share authorization. No production
release, schema migration, credentials, provider test roots or production data changes.

## Changes

- Shared GET validates capability scope/membership and returns its listing/content and
  permission from the same locked catalog snapshot instead of a separate `linkInfo` call.
- HTTP saves request the note inline from `save`. New writes return the immutable value
  already verified within the operation, only after catalog publication/readback succeeds.
  Replays still return the current head alongside the original acknowledged revision;
  changed heads remain conflicts in SyncDraft. Existing receipt hashes remain compatible.
- Owner revision revalidation checks current authorization, deletion and catalog revision
  before reading immutable content. Matching revisions avoid the content GET.
- Existing collection locks and per-request socket limits are unchanged. Content reads
  have NOT been moved outside the lock. No unverified lock-free reads or staging writes.

## Deterministic fixture request counts

These are protocol counts, NOT production timings. Existing-note fresh save, no retry.

| Shared operation | Before provider calls / lock acquisitions | After |
| --- | --- | --- |
| List | 6 / 2 | 3 / 1 |
| Open | 7 / 2 | 4 / 1 |
| Save | 16 / 3 | 9 / 1 |

Six new tests cover exact counts and acknowledgements, route scope, revoked replay,
shared-note target selection, current-head replay, revision revalidation authorization,
and failed catalog verification followed by exact replay. Full Node suite: 114/114 pass.
Local Chromium smoke was attempted but could not run: the browser download returned an
invalid/truncated archive. This is an environment blocker, not a passing browser test.
The unchanged CI browser job must pass before this trial can be considered for release.

## Burst qualification: still NOT ready for 10 editors + 50 readers

Run `node scripts/fixture-load.mjs`. The fake WebDAV provider is deterministic and
in-process, with no network or credentials. The test sends raw simultaneous HTTP requests
without browser GET/mutation retry, so it measures initial admission only.

- 50 readers: 1 HTTP 200 / 49 HTTP 423 (unchanged admission); provider calls 55 -> 52.
- 50 callers including 5 editors: 1 HTTP 200 / 49 HTTP 423.
- 60 callers including 10 editors and 50 readers: 1 HTTP 200 / 59 HTTP 423.
- 100 callers: 1 HTTP 200 / 99 HTTP 423.

The mixed run does not establish editor throughput: concurrent requests contend first
for the same lock. Success and rejected-response latency are now reported separately in
`results/2026-10-20-lock-cycle-fixture-load.json`; neither is real Koofr/Vercel latency.

## Next qualification

The reduction removes duplicate lock cycles; it does not remove the global bottleneck.
Next investigate a shorter verified read snapshot / separate read path, preserving
revocation and cross-instance safety. Do not remove locks, increase sockets, or claim
60-user readiness based on this step. Real-provider atomic read/publication behavior,
load with retries, sustained mixed traffic, iPad experience and Vercel usage remain unmeasured.
