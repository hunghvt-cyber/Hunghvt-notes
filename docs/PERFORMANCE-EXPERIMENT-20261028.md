# Notes Firestore performance experiment — 2026-10-28

## Scope and source checkpoint

Production project metadata and a fresh read-only health request were checked before this experiment. The serving project is `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`; the response reported `firestore-native-v1`, Firestore project `notes-lab-56f0f`, vault `notes-production`, and `firestoreRead=PASS`. This proves the health path reached Firestore, not that the synthetic measurements below represent Production latency.

Candidate base commit: `92f1fcaac50a2be6b59ef1b2484b1049c2bcdc61` (tree `7c6571ef9a4d050738d622b2fa35168e0b0061cd`). The Production app/API/library/browser/package files at source commit `480b54605c8ed8d599af486bab7817456fd6afae` were byte-identical to canonical main's corresponding files at the prior audited checkpoint. This experiment has not been deployed.

Tested source candidate commit: `6d355b7f34b4450eaa83b60bca28518709cb407e`, tree `90739a681bada8e5a9d6e0db37f9c4ab5d11c5c8`. The evidence document is a follow-up commit and does not change that tested source tree.

Canonical GitHub candidate branch commit (source plus initial report): `b6389a7b0cb0d9348506f5a3171c0b28756d72b4`, tree `ce8ba44630266ae429167e818e96f38fd035a496`. CI runs [40710978280](https://github.com/hunghvt-cyber/web-notes/actions/runs/40710978280) and [40711231295](https://github.com/hunghvt-cyber/web-notes/actions/runs/40711231295) both completed successfully. Draft review: [PR #24](https://github.com/hunghvt-cyber/web-notes/pull/24), not merged.

Existing cache-first note opening and IndexedDB draft persistence were already present. A cache hit renders the cached note immediately, then checks its known revision; a response is accepted only while the selection and draft version still match. No persistent cache policy, auth cache, editor debounce, or draft durability was changed.

## Method

The same private `/vol1/notes-ui-benchmark.mjs` Playwright harness ran against a fresh, isolated synthetic vault in `notes-lab-56f0f` / `(default)`, using NAS ADC. It seeded 20 synthetic notes; all tested reads/writes used that vault. Each reported action had 20 samples. `open_cached_note_ui` includes completion of the known-revision response. Reload/readback saves a synthetic edit before timing reload, reopen, and value verification. API request counts are per measured action. The harness recursively deleted the exact test vault and verified its root was absent after each run.

The baseline cache-hit method was corrected to wait for the completed revision-check response; its earlier 189 ms result omitted that wait and is excluded. The before run was saved privately as `/vol1/notes-perf-before-verified.json`; after runs were `/vol1/notes-perf-after.json` and `/vol1/notes-perf-after-timed.json`. No snapshot or synthetic content was put in GitHub.

## Before and after

All times are milliseconds, end-to-end in the same NAS Chromium harness. `n=20` for every UI metric; errors were zero in every group. Small changes in groups other than owner read are within this small-run variability and are not claimed as improvements.

| Operation | Before p50 / p95 | After p50 / p95 | Requests per sample |
| --- | ---: | ---: | ---: |
| Reload, server list, render | 601.6 / 633.5 | 623.5 / 677.5 | 3 |
| Open uncached note | 1,362.0 / 1,435.6 | 882.8 / 1,337.7 | 1 |
| Open cached note including revision check | 403.9 / 426.2 | 352.4 / 378.3 | 1 |
| Local search and render | 76.4 / 97.9 | 75.8 / 104.8 | 0 |
| New editor ready | 165.3 / 202.5 | 169.7 / 189.2 | 0 |
| IndexedDB local draft persisted | 55.4 / 75.4 | 46.5 / 68.2 | 0 |
| Server-confirmed synthetic save | 905.1 / 934.8 | 916.1 / 932.7 | 1 |
| Reload, reopen, verify saved value | 1,226.5 / 1,377.8 | 1,240.8 / 1,288.9 | 4 |

The candidate changes the owner read transaction to fetch the independent vault root and note metadata with the Node Firestore SDK's transactional `getAll`, instead of awaiting two `tx.get` calls sequentially. It does not remove transaction validation, permission/revocation checks, revision/CAS, history, or drafts. SDK source documents `Transaction.getAll` as a transaction read operation: https://github.com/googleapis/nodejs-firestore/blob/main/types/firestore.d.ts.

In a separately captured after run, 80 owner-note `get` request records had handler p50/p95 173.4/237.5 ms, store factory 0.2/0.4 ms, session auth 4.1/11 ms, cached ADC access-token retrieval 0/0.1 ms, Firestore repository operation 164.1/233.4 ms, and application residual 0.4/0.6 ms. These measurements use NAS ADC; `oidcSubjectTokenMs` was not observed in this path. They do not measure Production's Vercel OIDC exchange. The explicit `GoogleAuth.getAccessToken()` call is a public SDK API and its result is neither retained in the metrics nor logged: https://googleapis.dev/nodejs/google-auth-library/latest/classes/GoogleAuth.html.

## Safety tests

- Source syntax/import check: PASS, 48 files, no truncation markers.
- Offline suite: PASS, 194/194. Includes draft persistence failures, pending writes, idempotent retry, CAS conflict, history, shares/revocation, and Code Inbox fixtures.
- Browser smoke: PASS, 15/15. Includes new-note draft preserved after an older read returns late, typing during save, lost-response replay, two-tab conflict, offline reload/draft recovery, cache-fast-paint/draft preservation, and share revocation.
- Firestore cloud smoke: PASS, synthetic test project only. Owner save/open, known-revision, CAS conflict, share/open/revoke, trash/restore, snapshot hash/restore, tombstone, and exact test vault cleanup.
- `git diff --check`: PASS.

These checks do not use real Notes as fixtures and do not test a remote phone, Production session, or Production WIF timing.

## Gemini independent review

The existing NAS `gemini-task` wrapper returned a valid response from `gemini-3.5-flash-lite`; wrapper-selected key 1 was used without rotation. At most two calls were attempted for this batch. Only code structure and aggregate filtered timings were supplied.

Accepted and independently checked: batching independent owner-read references with the SDK transaction `getAll` can remove one sequential client/server wait; keep current cache-first rendering and avoid a persistent content cache; measure client setup, supported access-token acquisition, OIDC subject-token supplier duration, Firestore operation, and residual application time. Rejected: periodic WIF prewarming, because serverless instance lifetime and concurrency make it speculative and it risks doing auth work without a request. Gemini's review is not runtime evidence.

## Decision and deployment gate

Synthetic results show a substantial median improvement for uncached opens and a smaller cached-open improvement; uncached-open p95 improved only 6.8%, so tail improvement is modest. Save, list, editor, search, and reload p95 did not demonstrate a consistent improvement. No broad UI cache or auth change is justified.

GitHub's Vercel check did create an isolated staging deployment `dpl_CMj1HkLnpkgopaz4GG58WAcTvyCY` in project `notes-firestore-exact-082` (`prj_24XdIpwUoTqfoMNgNUB4y73Iyz1M`), not the Production project. It had only a preview deployment URL and its project SSO protection remained enabled. Preview environment metadata was empty. A new health request at 2026-10-28 14:57:51 UTC returned HTTP 200, request ID `KP-6678fe87`, `configured=false`, `production=true`; there was no backend field or Firestore read result. This is an explicit staging failure to configure, not a Firestore health pass.

The active Firestore WIF provider condition is restricted to Vercel `environment:production`, so the empty Preview configuration cannot reach the test Firestore identity with verified settings. Deploying with Production target could change aliases; copying unavailable Production secrets or broadening WIF solely for this experiment would weaken the gate. Production aliases, environment, IAM, and data were left untouched. Do not promote this candidate until a staging deployment can use an explicitly scoped test vault and accepted WIF identity.

Production's earlier NAS health p95 and ChatGPT's cross-environment latency are not compared with this local synthetic benchmark. Repeat the same browser/server procedure on a staging deployment with an explicitly scoped test vault and WIF identity before deploying the optimization or using the new timing fields in Production.

## Production-target staging feasibility review — 2026-10-28 15:24 UTC

The user proposed staging in `hunghvt-notes` with Production target and no domain assignment. Official Vercel CLI documentation confirms `vercel --prod --skip-domain` disables automatic domain assignment while retaining a Production-target deployment, and `--env KEY=value` can provide per-deployment runtime overrides. The current Production deployment remains `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`, READY, with aliases `hunghvt-notes.vercel.app` and `hunghvt-notes-git-main-hunghvt.vercel.app`. These target/alias facts were read back; no deployment was created.

Read-only Google IAM/WIF inspection used the dedicated NAS ADC without printing a token. The existing provider is ACTIVE, issuer `https://oidc.vercel.com/hunghvt`, audience `https://vercel.com/hunghvt`, and condition exactly `assertion.sub == "owner:hunghvt:project:hunghvt-notes:environment:production"`. The Production runtime service account `notes-production-firestore@notes-lab-56f0f.iam.gserviceaccount.com` accepts `roles/iam.workloadIdentityUser` for that exact Vercel subject. So target Production would match the existing WIF identity; no provider-condition change is needed to reach that account.

The same account's live project IAM binding is `roles/datastore.user` conditioned on resource name `projects/notes-lab-56f0f/databases/(default)`. It applies to the database, not to a Notes vault/document path. Setting a candidate vault ID to a synthetic value would direct normal application calls to that vault, but would not restrict the server identity from reading or writing `notes-production` in the same `(default)` database. Deployment Protection/SSO and `--skip-domain` prevent alias traffic; they do not narrow this IAM permission. Therefore this is not an acceptable write-test identity.

The project billing API currently reports `billingEnabled=false`; read-only project listing found no other existing Notes project. Google documents that creating a named Firestore database requires billing and named databases have no free quota. That option cannot be used under the no-billing instruction. No billing, database, IAM, identity, Vercel environment or alias was changed.

### Prepared isolated WIF alternative

Use a separate Google Cloud test project, with billing disabled and a Firestore Native `(default)` database containing only synthetic test data. Match the existing Production database region `asia-southeast1` for a comparable server-region path; do not change Production's region. Keep the existing Vercel WIF provider and its exact Production subject condition. Create a dedicated test service account in the test project; bind only `principal://iam.googleapis.com/projects/989224849517/locations/global/workloadIdentityPools/vercel-notes-production/subject/owner:hunghvt:project:hunghvt-notes:environment:production` to that service account with `roles/iam.workloadIdentityUser`; grant that test account `roles/datastore.user` only in the test project and condition it on that project's `(default)` database. Do not add any test permission to the Production service account or `notes-lab-56f0f` project.

For the candidate deployment, use per-deployment runtime overrides for the test project ID, synthetic vault ID/namespace, synthetic Notes auth/session settings and a `NOTES_FIRESTORE_WIF_CONFIG` whose audience/provider remain unchanged but whose service-account impersonation URL names only the test account. The Vercel Production system variable `VERCEL_URL` supplies the immutable deployment hostname; the app's Production origin check currently uses `NOTES_BASE_URL`, so a test-only, strictly gated dynamic origin path is needed before functional HTTP tests can use that hostname. Any such path must require this project, `VERCEL_ENV=production`, the test-only marker and synthetic Firestore project/vault values, and must never be enabled in normal Production configuration.

First benchmark the current Production-source commit through the isolated test project and actual Vercel OIDC; then benchmark the PR commit under the identical runtime conditions. Test the verified deployment URLs while SSO remains on and no Production aliases move. Do not promote the test-configured deployment: after the gate passes, build a separate Production-configured, alias-free candidate from the same source commit, verify its read-only Firestore health points to `notes-production`, then promote that Production-configured deployment.

Required administrative capabilities are limited to creating/setting up that test project and default database, creating the dedicated service account, setting the exact service-account impersonation binding and database-scoped test-project data role, plus a Vercel CLI deployment session that can supply runtime overrides. No new WIF provider or broad IAM condition is needed. Project/identity/IAM administration was not performed in this audit.

Cost: Google lists a no-cost Firestore free tier per project for up to 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored and 10 GiB egress/month. A new default database in a project without billing can remain within that tier; keep benchmark traffic below those limits and do not attach billing. Named Firestore databases cannot use the free tier and require billing, so they are excluded. Vercel deployment/function usage remains subject to the existing team plan and quotas; no plan upgrade is part of this proposal. Google sources: [Firestore quotas/free tier](https://docs.cloud.google.com/firestore/quotas), [Firestore pricing and named database billing](https://cloud.google.com/firestore/pricing), [IAM database resource conditions](https://docs.cloud.google.com/iam/docs/conditions-resource-attributes). Vercel sources: [deployment CLI options](https://vercel.com/docs/cli/deploy), [system `VERCEL_URL`](https://vercel.com/docs/environment-variables/system-environment-variables).

## Production target deployment and IAM isolation check — 2026-10-28 15:24 UTC

The Vercel Production project was re-read without decrypting environment values. The current READY deployment is `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`; its existing primary and Git-main aliases remain on that deployment. Production variable metadata includes Firestore/WIF settings, but values were not read. Official Vercel documentation confirms `vercel --prod --skip-domain` leaves domain assignment disabled and `--env KEY=value` can override runtime variables for that deployment. No deployment was created during this check.

Using the isolated Notes ADC for read-only Google IAM/WIF API calls, the live Vercel provider was ACTIVE with issuer `https://oidc.vercel.com/hunghvt`, audience `https://vercel.com/hunghvt`, and condition exactly `assertion.sub == "owner:hunghvt:project:hunghvt-notes:environment:production"`. The `notes-production-firestore@notes-lab-56f0f.iam.gserviceaccount.com` service-account policy grants `roles/iam.workloadIdentityUser` to that exact subject. Therefore a Production-target deployment in this Vercel project can use the existing WIF trust without changing its provider condition.

The live data binding is `roles/datastore.user` conditioned on `projects/notes-lab-56f0f/databases/(default)`. The scope ends at the database; it does not distinguish `notes-production` from another Notes vault in that database. A per-deployment override of the vault ID alone would route normal app methods to synthetic IDs but would not restrict the runtime identity from other documents in `(default)`. SSO and `--skip-domain` protect/avoid aliases, not Firestore data permissions. Same-project candidate writes therefore fail the user's isolation gate.

The current GCP billing API reports `billingEnabled=false`, and the accessible project listing contained only this Notes project. Google states a named Firestore database requires billing and does not get the free tier, so creating a second database in `notes-lab-56f0f` would violate the no-billing constraint. No IAM, project, database, Vercel env, alias or billing change was made.

Prepared alternative: create a separate test-only GCP project with billing disabled and its own Firestore Native `(default)` database containing synthetic Notes only. Use the same region as Production (`asia-southeast1`) to hold the server-region factor constant. Create one staging service account in that test project. Bind only the exact Vercel Production principal shown above to that service account with `roles/iam.workloadIdentityUser`; grant `roles/datastore.user` only in the test project, conditioned on its `(default)` database. Do not add permissions to the existing Production service account or `notes-lab-56f0f`. No additional WIF provider is required because the deployment has the same Vercel project/environment subject; the candidate's per-deployment WIF config changes only the impersonated test service account. Runtime overrides must point to the test project and a synthetic vault/namespace. The existing Production-configured deployment must not be used for writes.

For functional testing at the immutable deployment URL, Production `appConfig` currently pins `NOTES_BASE_URL` to the public alias. A future stage-only code path must use `VERCEL_URL` only when a strict marker, exact Vercel project, `VERCEL_ENV=production`, a non-production Firestore project, a synthetic-only vault prefix, and non-Homepage test auth all match. The path must reject the production Firestore project and `notes-production`. It has not been added or deployed yet. Benchmark baseline and PR candidate only after this explicit guard and test-project WIF are available; then build a separate Production-configured alias-free candidate and health-check its read-only `notes-production` root before any promotion. Never promote the test-configured deployment.

Additional authority needed for the prepared option: create the isolated GCP test project/database with billing still disabled; create the test service account; bind the exact existing Vercel subject to it; grant the database-conditioned data role in that project; and use an authenticated Vercel CLI session for a per-deployment `--env` Production-target deployment with `--skip-domain`. These permissions were not changed. Google documents a default database free tier of up to 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored, and 10 GiB egress/month per project. Keep the synthetic benchmark below those limits and leave billing disabled. Named databases are excluded because they require billing. Vercel function/deployment use remains within the existing team plan and quotas; no plan upgrade is proposed. Sources: [Firestore free-tier limits](https://docs.cloud.google.com/firestore/quotas), [Firestore named database billing](https://cloud.google.com/firestore/pricing), [Firestore IAM database resource names](https://docs.cloud.google.com/iam/docs/conditions-resource-attributes), [Vercel `--prod`, `--skip-domain`, and runtime `--env`](https://vercel.com/docs/cli/deploy), [Vercel `VERCEL_URL`](https://vercel.com/docs/environment-variables/system-environment-variables).
