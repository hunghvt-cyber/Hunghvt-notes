# Step 3: 50 readers + 10 editors, with existing client retries

Trial branch only. Application behavior is unchanged from source
`be9f1552f45d960d9a4e4d9bb1fd64e4552693df`. Added a repeatable load harness and CI
simulation, not a production change or live Koofr/Vercel test.

Run `npm run test:load` or `node scripts/retry-load.mjs`. Full deterministic output:
`results/2026-10-20-retry-load.json`. CI uploads `notes-retry-load-simulation`.

## Model and policy

- Real `createPreviewHandler`, NoteStore, `apiClient` and SyncDraft against fake WebDAV;
  independent store instances per HTTP request. No real credentials/provider traffic.
- 50 readers: 25 folder listings, 25 full content reads. 10 editors start with already
  opened notes. They edit independent notes or contend on one note at the same revision.
- GET uses the actual client: maximum four attempts, delays of 1000–1499 ms plus
  500 ms per prior retry, with seeded jitter. Only 423 is automatically retried.
- POST uses actual SyncDraft and mirrors the app.js save wrapper: four attempts maximum,
  4/8/16 second waits, terminal errors (including 409/403) stop. Every retry must keep
  the same operation ID, base revision and frozen payload. No unconditional rebasing.
- Virtual time with fixed 20/80/200 ms latency before each WebDAV call, including LOCK
  rejection. These are assumed call delays, NOT measured Vietnam/Koofr RTTs. No real
  bandwidth, CPU, cold-start, provider jitter, browser rendering, IndexedDB or HTTP
  abort/timeout model. Fake provider time advances so lease expiry remains enforced.
- The three-wave cases wait one second between completed waves. Later waves manually
  retry retained drafts with a fresh retry budget; this is not indefinite automatic
  retry or independently arriving sustained traffic. One successful save response is
  deliberately dropped to test exact replay. The spread case distributes each wave's
  60 arrivals over 10 seconds using a fixed seed.

## Outcomes, after retries are exhausted

Seed 219, independent notes, one synchronized wave:

| Assumed WebDAV call delay | Edits acknowledged / 10 | Reads completed / 50 | Remaining edits | Remaining reads |
| --- | --- | --- | --- | --- |
| 20 ms | 3 | 23 (19 list, 4 open) | 7 BUSY | 27 BUSY |
| 80 ms | 2 | 8 (5 list, 3 open) | 8 BUSY | 42 BUSY |
| 200 ms | 2 | 6 (3 list, 3 open) | 8 BUSY | 44 BUSY |

At 80 ms, additional seeds 220/221 acknowledge 3 edits and complete 11/10 reads,
respectively. Conclusions are not based on a claim that one seed predicts live traffic.

If all ten editors use the same note/base revision, only one save commits. At 20 ms,
2 editors reach 409 and 7 exhaust BUSY; at 80/200 ms, 1 reaches 409 and 8 exhaust BUSY.
All nine unacknowledged drafts remain retained. This confirms conflict protection,
not concurrent text merging.

Three-wave cases at 80 ms, independent notes, including one lost acknowledgement:

| Arrival pattern | Edit operations acknowledged / 30 | Reads completed / 150 | Saved sessions at end / 10 | Retained sessions |
| --- | --- | --- | --- | --- |
| All arrivals synchronized | 8 | 30 | 3 | 7 |
| Arrivals spread over 10 seconds | 27 | 72 | 10 | 0 |

The 27 successful operations in the spread case are distinct committed edits; failed
operations can be retried in a later wave, so this does not mean all 30 attempted edits
were accepted or that the last seven pending synchronized sessions were discarded.
Lists fare substantially better than full opens, which need a second lock after content
transfer. Even staggered arrivals do not meet the reader target in this model.

## Safety checks and interpretation

All ten scenarios verify: retry budgets, identical frozen POST payloads, current final
content/revision, one catalog version advance per unique committed operation, retained
unsaved/conflict drafts, successful-draft removal and no leaked locks. Both lost-response
scenarios recover an acknowledged replay without a duplicate commit. Two local complete
runs produced identical JSON. Existing Node suite remains required, as does browser CI.

The current root-lock protocol plus bounded retry does NOT satisfy the target in this
simulation. Fixed POST retry delays make waiting editors collide again; GET retries
remain heavily contended, especially final read validation. More retries alone are not
evidence of capacity and increase provider requests. Next evaluate seeded jitter for
exact-operation mutation retries and compare in this harness before changing the read
admission protocol. Fresh synthetic-root live qualification is still outstanding.

No merge, production deployment, production data access or provider cleanup performed.
