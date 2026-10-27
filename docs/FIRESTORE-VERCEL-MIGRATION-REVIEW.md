# Vercel to Firestore migration review (2026-10-27)

## Scope and current state

- Candidate Notes source: `codex/notes-firestore-cloudshell-20261027` at `082824c51f305a9c94ecdea6aafb9a479a4ccf5e`. The exact commit was checked from a clean checkout: Node 24 syntax check and 170 tests passed; isolated Firestore smoke passed and its synthetic vaults were removed.
- Production is still Koofr. No production deployment, production environment variable, billing setting, or real Notes data was changed.
- A dedicated WIF pool/provider and service account now exist only in test project `notes-lab-56f0f`. The provider trusts issuer `https://oidc.vercel.com/hunghvt`, audience `https://vercel.com/hunghvt`, and the exact subject `owner:hunghvt:project:hunghvt-notes:environment:preview`. The service account has `roles/datastore.user` in that test project and `roles/iam.workloadIdentityUser` only for that exact pool subject. The external-account config has no static credential source. Readback confirmed these bindings. Service account key metadata showed zero user-managed keys (one Google-managed system key).
- This WIF setup is not yet proven by a Vercel-issued token. Branch-scoped Preview environment creation was rejected by Vercel: project `hunghvt-notes` has no connected Git repository. No broader Preview or Production variables were created. Do not broaden the trust condition or add an unscoped credential as a workaround.
- The isolated cloud smoke used ADC from the NAS. That verifies Firestore behavior only; it is not evidence that Vercel OIDC works.

## Vercel WIF configuration

The intended Preview subject and audience follow Vercel's documented GCP OIDC issuer/audience and subject pattern. Runtime code calls `getVercelOidcToken()` without an explicit audience, so the provider's allowed audience is the documented team audience. Keep the provider condition exact; test a real Preview deployment before considering any change.

The preview environment should be branch-scoped to `codex/notes-firestore-cloudshell-20261027` and contain only:

- `NOTES_MODE=live-v1`
- `NOTES_PROJECT_ID=prj_c4sEp6nB4msWTsPiGoALSuVutVTK`
- a fresh synthetic `NOTES_DATA_NAMESPACE` matching the documented Preview probe format
- `NOTES_BACKEND=firestore-native-v1`
- `NOTES_FIRESTORE_PROJECT_ID=notes-lab-56f0f`
- `NOTES_FIRESTORE_VAULT_ID=preview-notes-firestore`
- the external-account JSON for the test provider/service account
- newly generated Preview-only `NOTES_PASSWORD` and `NOTES_SESSION_PASSWORD`

Do not set Production variables or use Homepage shared authentication in this Preview. These variables have not been created because branch scoping is unavailable while the Vercel project is disconnected from Git. The minimum unblock is to reconnect this Vercel project to `hunghvt-cyber/Hunghvt-notes`, then recreate the branch-scoped Preview variables and deploy the candidate branch. Verify the branch filter returns only those Preview names before deployment. Environment updates affect future deployments.

## Preview verification after reconnecting Git

1. Create a fresh synthetic namespace and ensure its namespace ID is not used by another environment. Initialize only vault `preview-notes-firestore` in the test project.
2. Add the branch-scoped variables above, create a Preview deployment from the candidate branch, and confirm the build commit is `082824c` or a later reviewed fix.
3. Confirm Vercel OIDC exchange and service-account impersonation succeed in the runtime without printing token material. Exercise one synthetic owner create/read/update/CAS-conflict, folder order, share/revoke, trash/restore/purge, and Code Inbox operation.
4. Compare counts and normalized hashes, then remove only the exact synthetic namespace/vault data. A failed auth or smoke check leaves Koofr production untouched.

## Migration preflight and cutover

1. Keep Koofr as the active backend while preview is under review. Confirm the production GCP project, Firestore billing state, quotas, Vercel Production WIF subject, and a separate production service account/IAM policy before requesting a final switch. The Preview identity must never access production.
2. Schedule a short write freeze. Preserve browser drafts on each device; do not clear local storage or ask clients to discard drafts. Capture the existing Koofr snapshot privately outside Git with mode `0600`, then run `verify`. Record active/trash note, folder, share (active/revoked), receipt, and erased-ID counts plus normalized fingerprint. Never log snapshot bodies.
3. If Koofr export returns `SNAPSHOT_TOO_LARGE` (the existing endpoint/encoder guard is 2,000,000 bytes), stop before importing anything. The current implementation has no streaming Koofr export. Do not split arbitrary JSON or relax the guard. A reviewed streaming exporter must capture catalog metadata/epoch and fetch immutable note heads in bounded pages, validate each existing head hash, and write a private local manifest plus record files with an aggregate manifest hash. Re-run `verify` against that complete export before import. This is a known prerequisite for datasets above 2 MB, not a tested production size estimate.
4. Import into a fresh production Firestore vault only after explicit final approval. Verify normalized counts and hashes, folder/order, revisions/history, tombstones, idempotency receipts, Code Inbox guards, and active/revoked share permissions before changing Vercel Production.
5. Publish the new production deployment and switch only after the review gate. Keep the old Koofr root and credentials intact. Start a monitored write window and capture a Firestore baseline immediately after the switch.

## Rollback that preserves post-cutover edits

Do not simply point the old deployment at the old Koofr namespace. That would lose all edits made since cutover.

1. Freeze writes and keep browser drafts intact. Export the *current* Firestore state after the freeze to a new private `0600` snapshot; verify counts/hash and compare to the post-cutover baseline to identify every subsequent edit.
2. Restore that current snapshot into a fresh, never-before-used Koofr rollback namespace. Preserve the frozen epoch semantics, note revisions/content, folder order, trash state, receipts and permission/revocation records. Rebase only the namespace/epoch-specific order/receipt fences as the rollback tool documents.
3. Read the new Koofr snapshot back and compare normalized counts/hash with the Firestore export. Do not switch if any comparison differs.
4. Existing recipients' capability URLs remain valid only if their token hashes and share state are restored. The owner token-box is namespace-bound, so the owner may need to issue a replacement link; do not expose raw share tokens in the migration artifact. Revoke any questionable link after the restored backend is verified.
5. Switch the application namespace/backend only after verification. Clients with stale drafts keep their old base revision; resolve them through normal conflict handling. If the snapshot exceeds the Koofr 2 MB restore transport limit, stop and use the same reviewed streaming/chunk transport prerequisite before rollback.

No dual-write is assumed. The write freeze and full-current-state export are what prevent post-cutover changes from being dropped.

## Gemini review and independent disposition

Gemini's useful cautions were: keep branch-scoped env isolated; test the actual STS exchange; treat the 2 MB export cap as a hard preflight gate; and take a current Firestore export after freezing writes for rollback. These are reflected above.

Gemini proposed broadening the subject condition, injecting unscoped variables guarded only by runtime checks, and switching namespace pointers inside a Firestore transaction. Those suggestions are rejected: Vercel's official GCP guide documents the team issuer/audience and subject structure; the current provider is already exact and the project-level Preview env is unavailable; and the active Notes backend/namespace is Vercel configuration, not a Firestore pointer. Do not weaken the WIF condition to work around missing Git linkage.

## Evidence limits

Measured: exact candidate commit tests and isolated Firestore smoke; Google IAM readbacks; Vercel rejection of branch-scoped env creation; no production data touched.

Not yet verified: Vercel-issued OIDC token exchange, deployed Preview runtime behavior, Koofr snapshot size for real Notes, production IAM/billing/quotas, and any production cutover. These remain explicit review gates.
