# Firestore cutover execution — 2026-10-28

## User decision

The user selected Firestore as the sole Notes source: GCP project `notes-lab-56f0f`, database `(default)`, vault `notes-production`. The user accepts Koofr-only differences and directs no merge or further cross-store analysis. This supersedes earlier merge/parity gates. Preserve every Firestore note, history, trash, share, revocation, receipt, tombstone, namespace and session/auth behavior.

Keep the verified Firestore backup/restore and private baseline from [baseline run 40649120419](https://github.com/hunghvt-cyber/web-notes/actions/runs/40649120419). No private snapshot or note body belongs in this repository.

## Read-only pre-deploy evidence

- Vercel project: `hunghvt-notes`, ID `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`; no Git link is configured.
- Before this change, Production `NOTES_BACKEND` existed but was empty. No Production variables `NOTES_FIRESTORE_PRODUCTION_REVIEW`, `NOTES_FIRESTORE_PROJECT_ID`, `NOTES_FIRESTORE_VAULT_ID`, or `NOTES_FIRESTORE_WIF_CONFIG` were present. Existing Notes mode, project ID, base URL, namespace, Homepage auth mode and Code Inbox OIDC mode were present; sensitive values were not read.
- Production WIF provider `projects/989224849517/locations/global/workloadIdentityPools/vercel-notes-production/providers/notes-production` is ACTIVE. Issuer `https://oidc.vercel.com/hunghvt`, audience `https://vercel.com/hunghvt`, subject condition is exactly `owner:hunghvt:project:hunghvt-notes:environment:production`.
- Service account `notes-production-firestore@notes-lab-56f0f.iam.gserviceaccount.com` grants `roles/iam.workloadIdentityUser` only to that principal. Its data access is `roles/datastore.user` with condition `resource.name == "projects/notes-lab-56f0f/databases/(default)"`. Database metadata confirms Firestore Native in `asia-southeast1`. No IAM or billing change was made.
- Before cutover, the primary alias pointed to `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; secondary alias pointed to `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`. Neither alias has yet been moved by this execution.

## Source and pre-deploy verification

- Canonical main base commit/tree: `f225e63005fc076d4da1e0cfaf7b4c45d2933e28` / `d97b80ca073745028dca75a24ea6b6f607e3c0cb`.
- Added a read-only health check for the explicit Firestore backend. It reads only the configured vault root document and returns backend/project/vault identifiers and whether that root exists; it never returns Notes content or writes data.
- Tested Node 24.22.1: focused Firestore/runtime tests 20/20 PASS; offline suite 191/191 PASS. Changes were committed to canonical main in commits `6c3267047b9d01d415d68efc523a69cae819f8ae`, `fd1ffcf1f0cd299e36d42d2a958bb959e97c2a82`, `2f200ca27b0022b0b5014360d353731a12cfb481`, and `9a6b37e3dad928e45183095567748baeba8be328`. No deployment or alias switch is claimed by these source commits.

## Cutover outcome

Pending. Record the exact deployment ID/URL, per-deployment config, live Firestore health response, aliases, old writer isolation, post-cutover backup/restore run, and exact namespace cleanup result here as each is verified. Do not delete the Koofr namespace until the new Firestore deployment and post-cutover restore qualification pass.


## Runtime attempt — 2026-10-28

- Candidate deployment built from canonical main commit `2de8337e860b177e9491d171aa8d0fc2a990cdd0`: `dpl_6Wbucvquftz3g9WAzf1ZUc1cYqEZ`, immutable URL `hunghvt-notes-7e4mg8q93-hunghvt.vercel.app`, state READY, target Production.
- Candidate's protected `GET /api/app?route=health` returned HTTP 500 `FUNCTION_INVOCATION_FAILED`; no health JSON was emitted, so production backend remains UNKNOWN. `/api/inbox` also returned 500; the separate preview route returned 200. Do not infer that Firestore is active from the explicit environment settings alone.
- Artifact metadata shows Node 24.x and the same declared Firestore/auth/OIDC package versions as the prior primary deployment. Candidate and old deployment share the same `api/app.js`, `api/inbox.js`, and `lib/app-config.mjs` file hashes; Firestore runtime/repository source differs. This narrows but does not establish the failure cause.
- A prior runtime-log observation reported a Node syntax error (“Unexpected identifier 'output'”), but current Hobby retention did not provide a fresh log record for this request. Runtime error aggregation also returned no cluster. The available 500 response does not expose a root cause.
- Re-read alias metadata after restoration: primary `hunghvt-notes.vercel.app` remains on `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`; secondary `hunghvt-notes-hunghvt.vercel.app` remains on `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`. Candidate aliases were not switched. The immutable old deployment URLs remain reachable; legacy writers are not claimed isolated.
- No backup was run after cutover because cutover has not occurred. No Koofr namespace, deployment, route, identity or permission was deleted. Existing verified backup/baseline remains untouched.
- Blocker: obtain an actionable deployment build/runtime diagnostic or fix the function initialization failure, then repeat the root-only Firestore health read before alias changes. Only after that can the post-cutover backup/restore gate and exact legacy deletion proceed.
## Function failure isolated — 2026-10-28

- Sent a fresh protected health request to candidate `dpl_6Wbucvquftz3g9WAzf1ZUc1cYqEZ` at `2026-10-28 08:25:21 UTC`. It returned HTTP 500 `FUNCTION_INVOCATION_FAILED`, request ID `syd1:iad1::mprgg-1793175923334-5479b3a90fc6`. Immediately queried Runtime Logs for this deployment, function source, error/fatal, 10-minute window: no records. Build event history was available and showed a restored cache, 38 source files, dependencies reported up to date, and successful build.
- Compared artifact file hashes and confirmed candidate `lib/firestore-native-repository.mjs` began with injected non-JavaScript text `Warning: truncated output ...`; the following line also contained a truncation notice. It was incomplete: 85 lines of Firestore repository code were lost, in addition to the invalid prefix.
- Reproduced the exact Node 24.22.1 cold-start failure locally from candidate commit `2de8337e860b177e9491d171aa8d0fc2a990cdd0`. Importing Firestore test modules emitted `SyntaxError: Unexpected identifier 'output'` at `lib/firestore-native-repository.mjs:1`. Importing all API entrypoints and running the health handler with a synthetic store passed, isolating the problem to parsing the corrupted repository module.
- Restored the full repository module from clean source commit `f225e63005fc076d4da1e0cfaf7b4c45d2933e28` plus the intended read-only `runtimeHealth()` method. This restores the missing trash/history/restore/purge/folder logic. Node 24.22.1 syntax check passed; full offline suite passed 191/191. No Production datastore was contacted or written during reproduction.
- Gemini review used NAS wrapper `/home/admin/bin/gemini-task`, model `gemini-3.5-flash-lite`, existing key alias `key1` only. A minimal public probe returned `RUNTIME REVIEW READY`; review received filtered deployment metadata and entrypoint/import descriptions. It recommended isolating module evaluation and a no-cache build. Those were suggestions, not evidence; the exact local reproduction established the root cause. The Vercel deployment API accepts `alias: []`, which will be used for the next candidate. Cache bypass still needs confirmation from the API/build events.
- The source correction is canonical main commit `ca18a373f0b53e26a473526de706559a1b957`. Candidate `dpl_2Ar8fGYSj7M4iorJHYUBfUGKsMDr` (`hunghvt-notes-7s1dvhwsk-hunghvt.vercel.app`) reached READY with an empty actual alias list. Deployment used force-new/no-cache; build events confirmed cache skipped and 38 files installed from the repository root. The temporary project auto-assignment setting was restored to enabled before manually assigning traffic.
- Direct candidate health at `2026-10-28 08:37:15 UTC`, request ID `syd1:iad1::fra1::mh498-1793176639174-9a214f9783f1`, returned HTTP 200 and only `backend=firestore-native-v1`, project/vault IDs, `firestoreRead=PASS`, and `vaultInitialized=true`. The endpoint performed one root-document metadata read; no Notes content was read and no data was written. Runtime Logs queried immediately returned no error/fatal records.
- Both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app` now resolve to `dpl_2Ar8fGYSj7M4iorJHYUBfUGKsMDr`; health requests to both returned HTTP 200 with the same Firestore-only response.
- The old deployments' immutable URLs still exist and can potentially write; they are not yet claimed isolated. No post-cutover backup/restore qualification has run yet. Keep Koofr namespace and old deployments until the old writer is isolated and the post-cutover backup/restore gates pass.
