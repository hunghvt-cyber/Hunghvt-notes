# PR #34 cloud qualification — 30/10/2026

## Decision

**Hold PR #34 as draft. Do not deploy.** No safe isolated Firestore target is available under current quota and billing constraints. Production remains on deployment `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`.

No app code, Firestore IAM, Vercel environment, deployment, alias, or protection setting changed in this task. A temporary GCP project create request failed; readback confirms it was not created. No vault or test note was seeded.

## Source comparison

PR head `80b67b10207cc8e97ec7eb16a501f9e8cd028be2`, tree `fbba9b74d13e6cc487655f59dca21dbd01eed21e`; Production deployment source `7991b8045f36835dc8e69f829c5399a4ac31d4ec`, code tree `107dc688af1a6953d407ae9eb3ab7566a762ce8b`.

| Change | Risk | Evidence present | Cloud evidence still needed |
|---|---|---|---|
| `public/app.js`, `public/cache.js`: authenticated cache-first list/note, background revalidation, bounded viewport prefetch/adoption, stale-response/session guards, lazy history UI | stale scope/revision, late response or UI/editor overwrite; offline cache may be old | Offline/browser tests cover stale responses, logout, dirty editor, late selection, ACK-only cache, bounds, paste/undo and IME; cache stores server-confirmed content only | Real Vercel Preview request verifies list, cached and uncached open, scope/logout and revision behavior |
| `lib/preview-api.mjs`: accepts `history=0/1` and `prefetch=1`, maps to store options | access control or route contract regression | Synthetic route and API tests; auth implementation itself unchanged | Authenticated Preview requests, ACL, malformed/unauthorized request and no-store headers |
| `lib/firestore-native-repository.mjs`: read root/meta/share in one transaction concurrently, known-revision early return, direct current-version read, optional history query, manifest-size prefetch skip; metadata summary grows 100→200 chars | transaction consistency, revision mismatch, chunk/history correctness, extra metadata bytes | Repository fixtures verify known revision, lazy history, large-note skip, CAS and summary source; no schema migration | Actual Firestore list preview, body, known revision, history revisions, chunk behavior and read permission via Vercel OIDC |
| `lib/store.mjs`: mirrors `includeHistory`/`maxBytes` for adapter | adapter/API behavior divergence | offline/synthetic tests | Only if route uses this adapter in qualified runtime; determine via health/config without reading real Notes |
| Auth/session, save/CAS/clientOpId and Firestore schema | expected contract unchanged | Production-vs-candidate diff shows no auth module or save transaction change; app config contract is unchanged | Synthetic save ACK/CAS/idempotent retry and conflict through candidate runtime still required because the same deployment also contains the changed read path |
| Vercel/GCP runtime env | Preview OIDC may point at wrong project, database or identity | Current production env metadata read without decrypt; branch Preview query empty | Branch-scoped Preview config using temporary identity and test database, then remove/read back |

The application calls the same notes GET API; lazy history changes its query contract, not an entirely new backend service. Firestore transaction reads are within a single `runTransaction`; Firestore documents serializable transaction isolation, so concurrent read calls use transaction semantics rather than unrelated snapshots. No code change was justified by Gemini's speculative consistency warning.

## Resource and permission inspection

- `git fetch origin` completed. Worktree was clean before inspection; local HEAD matched PR #34 `80b67b10207cc8e97ec7eb16a501f9e8cd028be2` and its tree matched `fbba9b74d13e6cc487655f59dca21dbd01eed21e`.
- Vercel CLI/`vc` are absent. Vercel MCP **does** list environment-variable metadata (without decrypting values): existing app variables are Production-targeted; branch-filtered Preview variables for `codex/cache-first-note-cache-20261029` are empty; custom environment inventory is empty. This corrects the earlier 30/10 report that MCP could not list variables. Project `hunghvt-notes` is not Git-connected. Its production aliases still target the current deployment.
- Read-only Cloud Resource Manager showed six visible projects. Notes project `notes-lab-56f0f` has one Firestore Native database `(default)` in `asia-southeast1`; that is the Production database, and its IAM `roles/datastore.user` binding is explicitly conditioned to the default DB. Billing API reports `billingEnabled=false`.
- Existing `vercel-notes-preview` WIF pool is `ACTIVE` but `disabled=true`; its provider allows the exact Preview subject, but the existing Preview service account has no bindings. Production WIF and IAM remain unchanged. The old pool cannot be re-enabled under this task's constraints.
- Four visible projects denied Firestore database listing. The one other visible project with an accessible default Firestore database is `home-ai-55a88`, an unrelated application; it was not inspected for data or used.
- `/home/admin/bin/notes-gcloud` version 590.0.1 is available. Its CLI has no active user account. Read-only IAM/Firestore API calls via the isolated ADC path succeeded. Permission checks showed resource-creation/IAM capabilities in Notes Lab, but not API-enable permission; no policy mutation was made.
- One exact Cloud Resource Manager `projects.create` request for `notes-pr34-qual-20261030`, with no billing account, completed with `QuotaFailure`: “The project cannot be created because you have exceeded your allotted project quota.” A follow-up list returned six projects and confirmed no project with that ID. No resources were created.

## Minimal safe route, once an admin gate is cleared

The preferred path does not require enabling billing or creating a named database:

1. Request a Cloud Resource Manager project-creation quota increase **or** have an owner provide a dedicated isolated GCP project. Keep billing disabled. Enable Firestore API and provision only the default Firestore Native database, with no Production data. A default database is eligible for Firestore's free quota; named databases require billing and have no free quota.
2. Create temporary service account `notes-pr34-qual@<test-project>.iam.gserviceaccount.com` and a new WIF pool/provider (do not reuse or re-enable `vercel-notes-preview`). Provider issuer `https://oidc.vercel.com/hunghvt`, allowed audience `https://vercel.com/hunghvt`, exact attribute condition `assertion.sub == "owner:hunghvt:project:hunghvt-notes:environment:preview"`, mapping `google.subject=assertion.sub`.
3. Bind only that pool subject to the service account using `roles/iam.workloadIdentityUser`. Grant `roles/datastore.user` only on the test project default database, with condition `resource.name == "projects/<test-project>/databases/(default)"`. Do not grant a binding on `notes-lab-56f0f` or any Production database.
4. Add only branch-scoped Vercel Preview env vars for PR branch `codex/cache-first-note-cache-20261029`: native Firestore backend, test project/database vault, external-account WIF config, synthetic password and session secret. No production env is edited. No real password/session is used.
5. Inspect deployment creation behavior/auto-aliases before creating it. Use target Preview and exact candidate source; never assign a Production alias. Test synthetic list preview, current content, known revision, lazy history, unauthenticated/authorized access, save ACK, CAS conflict, same-operation retry and cleanup. Verify served JS/CSS hashes against candidate assets and read-only health.
6. Remove synthetic records, exact Preview env rows, WIF binding/provider/pool and service account; delete the temporary project if created. Read back every removal and Vercel alias state.

Expected Cloud Firestore cost for a small test on the default DB is within its free quota (up to 50,000 reads/day, 20,000 writes and deletes/day and 1 GiB stored). No billing account is to be activated. A named database in Notes Lab is not an acceptable substitute. Vercel plan-specific deployment usage was not estimated because no deployment was created.

## Gemini reviews

Wrapper `/home/admin/bin/gemini-task --help` succeeded; keys 4 and 5 used `gemini-3.5-flash-lite`. Prompts contained only source summaries, resource metadata and synthetic metrics—no Notes, sessions, tokens, credentials or secrets.

- **Key 4, cloud/IAM and read-contract review:** accepted its finding that no safe existing Notes test database/project is available and that avoiding Production IAM edits is correct. Its concern that root/meta/share reads within the same Firestore `runTransaction` can produce unrelated snapshots is rejected: official Firestore transaction semantics provide serializable isolation and reads in one transaction are isolated at commit time. Its blanket statement that any resource setup would exceed authority is not accepted as a general rule—the user authorized least-privilege temporary resources within existing permissions—but the only isolated-project attempt failed quota, so no IAM changes were made.
- **Key 5, requirements/evidence/release gate:** accepted its NO-release recommendation and confirmation that Production should stay put. Its wording that fixture performance gates are “met” applies only to the focused 95 ms cached click and 30 ms typing metrics; broader list tails remain noisy/unmet. Its inference that the old 403 ms is likely environmental noise is rejected: the measurement did not reproduce, but the cause is unknown.

## Release and remaining blocker

Current exact Production readback: deployment `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`, source SHA `7991b8045f36835dc8e69f829c5399a4ac31d4ec`, READY. All three aliases remain on it; no alias bypass was added. Rollback remains `dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst` (SHA `96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a`). No deployment, alias, env, IAM, or billing change occurred.

**Required admin action:** either (a) increase Cloud Resource Manager project creation quota so a no-billing isolated project can be created, or (b) provide a pre-existing dedicated GCP test project with Firestore enabled/default DB and permission for the temporary scoped WIF/SA setup. Do not delete or reuse unrelated projects. If the only offered path is a named DB in Notes Lab or enabling/linking billing, that requires separate explicit authorization and is outside this task's current constraints. Until then, keep PR #34 draft.

S25 Ultra/iPad have not been tested. No Production performance improvement or “8/10 Google Keep” claim is made.

### Official references

- [Firestore pricing and free quota](https://cloud.google.com/firestore/pricing)
- [Per-database IAM Conditions](https://docs.cloud.google.com/datastore/docs/manage-databases#configure_per-database_access_permissions)
- [Firestore transaction isolation](https://docs.cloud.google.com/firestore/native/docs/transaction-data-contention)
- [Vercel OIDC token reference](https://vercel.com/docs/oidc/reference)
