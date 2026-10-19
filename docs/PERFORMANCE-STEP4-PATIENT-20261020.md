# Step 4: visible waiting and patient delivery (trial only)

User prioritizes successful reads/saves over short waiting time. This extends the
trial branch without deploying production or changing server publication/auth/CAS.

## Application behavior

- Existing sticky indeterminate loading bar now covers every API request, including
  opening content, and stays visible through delivery backoff. It does not display a
  fabricated percentage. Reduced-motion preference disables animation.
- GET and save delivery use the same `patientRetry`: randomized 1–10 second backoff,
  maximum 32 attempts within a 120-second retry window. A request already in flight
  may finish after the window; individual network timeouts remain separate.
- GET legacy retries are disabled inside this wrapper, so attempts are not multiplied.
  POST retry is only around SyncDraft, retaining its exact durable operation ID,
  payload and base revision. Other mutations are not automatically replayed.
- Each session has one delivery promise. Save clicks/autosave while delivery waits
  join it rather than start a second retry chain. Typing stays enabled; newer text
  remains a separate dirty draft until the pending operation is acknowledged.
- While waiting, UI says the draft is retained and server confirmation is pending.
  Verified save status still comes only from SyncDraft's matching acknowledgement.
- Conflict, revoked permission, missing note, login, size and validation errors stop.
  Offline/disposed sessions and local storage errors stop delivery. Drafts remain;
  exhausted delivery allows manual retry. This is not a background service that can
  run while iPad suspends/closes the page. Existing online recovery remains in place.
- Owner drafts are offered before network bootstrap, so a slow/retrying connection
  does not block opening a local draft after reload.

## Simulation comparison

`node scripts/retry-load.mjs --patient` runs the ten legacy-policy scenarios plus
seven new-policy scenarios. Output: `results/2026-10-20-patient-retry-load.json`.
All timings below are virtual fixed call delays, NOT Koofr/Vercel measurements.
Independent notes, seed 219, synchronized 50 readers + 10 editors:

| Assumed call delay | Old save/read success | New save/read success | New successful open p95 (virtual) |
| --- | --- | --- | --- |
| 20 ms | 3/10; 23/50 | 10/10; 50/50 | 16.7 s |
| 80 ms | 2/10; 8/50 | 10/10; 50/50 | 40.5 s |
| 200 ms | 2/10; 6/50 | 10/10; 46/50 | 117.0 s |

At 80 ms, seeds 220 and 221 also complete all ten saves/fifty reads. Same-note
editing produces one acknowledged save and nine retained conflicts, not silent
merges or overwrites. Three spread-arrival waves at 80 ms complete 30/30 edit
operations and 150/150 reads, including exact replay of a deliberately lost ack.

The improved admission rate costs more requests: seed 219 at 80 ms uses 307 HTTP
attempts versus 229 previously; at 200 ms, 654 versus 233. There is no fairness or
live capacity guarantee, and four slow-profile readers still exhaust their window.
This does not solve the root-lock bottleneck or justify a production release.

## Verification

127 Node tests pass locally. Four new tests cover delivery beyond three BUSY
responses, terminal statuses, bounded/cancelled delivery, and absence of nested GET
retry loops. Existing draft/replay/ACL/race tests remain in place.

Browser smoke adds a held content read and two BUSY save responses: loading must
remain visible while waiting, save must not claim success early, repeated POSTs must
be identical, and final server content must match. Local Chromium remains unavailable;
updated browser CI must verify this head. CI also runs the seventeen-scenario matrix.

No production data accessed, production deployment, merge or provider cleanup.
