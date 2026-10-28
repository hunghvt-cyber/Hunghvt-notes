# Notes Performance Baseline — 2026-10-28

## Scope and versions

Measurements were taken from the NAS on 2026-10-28, using the verified Production aliases and a separate synthetic Firestore vault. No note in `notes-production` was created, changed, deleted, or used as a fixture. The synthetic vault lived in `notes-lab-56f0f/(default)` and was recursively removed; a follow-up read confirmed that no `perf-*` vault root remained.

Production deployment: `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`, source commit `480b54605c8ed8d599af486bab7817456fd6afae`, tree `657237f2c4f0714575c382f66b55acbda179f90f`. The benchmark checkout was canonical `main` at `417bc353f7c3bbda53c05b24df0b956c347e545a`, tree `28b7b7f32ba69b62f92b2793b5b762a46bb094fc`. The app, API, Firestore library, browser assets, cloud-smoke script, and package manifest in those two commits were byte-identical. Documentation/workflow files account for the different overall tree hash.

## Production health from NAS

Twenty GET requests to `https://hunghvt-notes.vercel.app/api/app?route=health` used new TCP/TLS connections. All 20 returned HTTP 200 and each body reported `backend=firestore-native-v1` and `firestoreRead=PASS`. This confirms the health endpoint accessed Firestore during each request; it is not a Notes-content read.

| Phase | p50 (ms) | p95 (ms) |
| --- | ---: | ---: |
| DNS lookup | 6.2 | 10.8 |
| TCP connect | 23.0 | 26.2 |
| TLS handshake | 87.2 | 91.5 |
| From TLS completion to first byte | 638.6 | 2,141.7 |
| End-to-end | 754.2 | 2,259.2 |

The p95 server-side interval contains a pronounced tail spike. These 20 samples do not identify whether the delay was function scheduling/module initialization, OIDC token exchange, Firestore client transport, or the Firestore read. No health probe currently emits those separate phases. A separate earlier pooled-connection exploratory run had a 2.7 s first sample and faster later samples; it is not labeled “cold start” because the runtime state was not observed. A filtered Vercel Runtime Logs query did not provide correlatable per-request phase timings. No code or Production configuration was changed in response to this aggregate result.

## Synthetic UI backed by Firestore test vault

The browser ran the canonical app through a local request adapter, using NAS ADC and the Firestore Native repository against a unique vault in test project `notes-lab-56f0f`. It did not use Production OIDC, Production authentication, or Production data. Twenty synthetic notes were seeded. Each reported UI operation has 20 successful samples and zero operation errors.

| Operation | p50 (ms) | p95 (ms) | Errors |
| --- | ---: | ---: | ---: |
| Reload, server list response, and list render | 557.3 | 626.2 | 0/20 |
| Open distinct uncached note in editor | 1,362.3 | 1,400.7 | 0/20 |
| Reopen cached note (including revision check) | 185.7 | 216.8 | 0/20 |
| Local search and render | 76.9 | 87.8 | 0/20 |
| New editor ready | 169.0 | 186.7 | 0/20 |
| Local draft persisted to browser storage | 48.3 | 95.5 | 0/20 |
| Server-confirmed Firestore save, from click to UI acknowledgement | 901.8 | 919.3 | 0/20 |
| Reload, reopen, and verify the exact saved synthetic text | 1,229.0 | 1,344.7 | 0/20 |

The UI harness uses Chromium on the NAS and a local app handler. Latencies include local browser automation and the NAS-to-Firestore test-project path; they do not measure a remote phone, Vercel execution, or Production authentication. One sample reached 2,485.9 ms for reload/readback, outside the p95. The test vault was recursively deleted and its root absence verified.

To split local runtime components, a separate isolated test-vault run measured dynamic import of the Firestore/Auth/repository modules at 864 ms; GoogleAuth client construction at <0.1 ms; first NAS ADC access-token acquisition at 336.2 ms; repeated cached ADC-token lookup (20 samples) at p50 <0.1 ms / p95 0.1 ms; Firestore client construction at 4.2 ms; and the health document read after token warm-up (20 samples) at p50 76.0 ms / p95 88.6 ms. The vault was deleted and root absence verified. This separates the NAS ADC token and Firestore-read phases on the test project; it does **not** measure Vercel's GitHub/Vercel OIDC exchange. Therefore these numbers cannot be subtracted from Production server time or used to attribute its tail.

## Firestore operation smoke and feature coverage

Cloud smoke run ID `e0a5f66e-fff3-4ece-8da0-9434d5949034` passed on Node `v24.22.1` against test project `notes-lab-56f0f`, database `(default)`. It covered isolated vault initialization, synthetic owner save/open, known-revision read, CAS conflict, share/open/revoke, folder deletion/readback, trash/restore, snapshot restore parity, purge tombstone, and recursive cleanup. It used one sample per operation, not a percentile benchmark. Selected wall times were owner save 386 ms, owner open 368 ms, known-revision read 254 ms, folder delete 766 ms, trash/restore 1,004 ms, snapshot/restore 1,868 ms, and purge 1,970 ms.

The offline suite passed 191/191. Its fixtures cover session/auth, draft synchronization and conflict handling, sharing/revocation, Firestore repository semantics, and Code Inbox identity/claim validation. The Code Inbox tests use signed-token fixtures; they are not a live GitHub OIDC request. Cloud smoke did not test multi-device synchronization or Code Inbox against a real OIDC identity. Those remain unverified end-to-end.

## Code review and Gemini

Gemini review ran successfully through the existing NAS `gemini-task` wrapper using `gemini-3.5-flash-lite` (key selection remained with the wrapper). Only code-shape and aggregate timing data above were sent; no Notes, credentials, or logs were sent. Its plausible hypotheses included lazy OIDC token acquisition and cold Google transport. Those remain hypotheses.

Gemini also suggested that the owner read may contain seven sequential Firestore network round trips. Codex rejected that as unsupported by the inspected implementation: reads inside `runTransaction` are submitted through the transaction, and history versions are requested with `Promise.all`; the health route does not perform an owner-note history read. This does not prove a specific transaction latency. No clear, safe code optimization was demonstrated, so no performance fix or deployment was made.

## Historical Koofr reference and limits

The earlier Koofr study is in [notes-speed-results-20261027.md](history/ai-nas-lab/notes-speed-results-20261027.md). It records an older Koofr source checkpoint and old save-only smoke values of 3.025–7.400 seconds, alongside separate in-memory simulations. Those measurements differ in backend, source, auth path, timing boundary, and test method. They are context only; no relative speedup percentage or direct latency comparison is claimed.

## Next instrumentation

If the Production server-side tail remains material, add narrowly scoped, content-free duration fields around: (1) Vercel OIDC subject-token/access-token acquisition, (2) Firestore client creation/first RPC, and (3) the health document read. Correlate by the existing request reference and retain no token or document content. Re-measure the same health path before deciding whether code changes are warranted. UI production timing requires an authenticated, non-writing production session; this run deliberately did not request or use that credential.
