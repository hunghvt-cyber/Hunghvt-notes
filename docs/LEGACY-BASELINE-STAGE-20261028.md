# Legacy baseline staging checkpoint — 2026-10-28

## Source and tests

- Canonical source commit/tree deployed: `14ba6c541dc486c3e932d1a965d01413b8f1604d` / `e9abdaf464636ada7fdb81f2b6fe986593cc5203` (PR #23; PR #22 is its parent).
- PR #22 adds server-side GitHub OIDC verification for the read-only Koofr exporter and a private Koofr baseline/readback workflow. PR #23 forwards the same short-lived token to Vercel Trusted Sources while retaining the route's independent Bearer JWT check.
- Focused local tests: 9/9 passed. Offline suite on NAS Node v22.23.4: `npm test`, 190/190 passed. GitHub Actions “Notes simulation” passed for the parent and follow-up commits (runs 40646255602 and 40646812970).
- The one failure from raw `node --test` was the repository network-guard harness being invoked outside its required wrapper; the supported `npm test` command passed 190/190.

## Vercel staging

- Target project verified by project ID: `prj_c4sEp6nB4msWTsPiGoALSuVutVTK` (`hunghvt-notes`, team `hunghvt`).
- Immutable staging deployment: `dpl_CQQ9tSjTfkmJDKFJA5pyCLWnthVT`, `hunghvt-notes-jxnkvndz4-hunghvt.vercel.app`, READY, source commit above.
- This deployment was created from canonical-main source files while the three staging-only Production env values were set (`koofr-v1`, `get-only-v1`, `true`). After the immutable deployment was READY, all three project-level values were cleared to empty and metadata readback confirmed. Existing deployments retain their original env snapshots; future deploys therefore get no migration-export enablement and no write-freeze flag by default.
- The Vercel API assigned production aliases automatically despite the deployment request omitting an alias. They were promptly restored and read back:
  - `hunghvt-notes.vercel.app` -> `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`
  - `hunghvt-notes-hunghvt.vercel.app` -> `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`
- The staged deployment's alias inventory was read back as empty after restoration.
- No Notes read/export was completed. A protected fetch attempt stopped at Vercel with filtered status `401 deployment_authentication_required`, before the route ran. This demonstrates the platform layer is still in force, not that server authorization or export works at runtime.
- The exporter validates the GitHub OIDC token server-side (issuer, exact audience, immutable repo/owner subject and IDs, main ref, exact workflow_ref and push event), then requires the explicit feature flag, GET, and frozen state. Unit tests cover rejection before opening the Koofr source.

## Exact remaining access gate

To let only the canonical baseline workflow reach the protected Production deployment, add one external Trusted Source in Vercel project **Settings → Deployment Protection → Trusted Sources → External Services → Add → GitHub Actions**:

- Account: `hunghvt-cyber`; repository: `web-notes`; branch: `main`.
- Use custom audience `https://hunghvt-notes.vercel.app/notes-legacy-baseline`.
- Restrict the raw workload claims to:
  - `sub`: `repo:hunghvt-cyber@252749231/web-notes@1423348828:ref:refs/heads/main`
  - `repository`: `hunghvt-cyber/web-notes`
  - `repository_id`: `1423348828`
  - `repository_owner_id`: `252749231`
  - `workflow_ref`: `hunghvt-cyber/web-notes/.github/workflows/notes-legacy-baseline.yml@refs/heads/main`
  - `event_name`: `push`
- Apply to Production only. Keep Vercel Authentication enabled.

After this exact rule is saved, rerun the blocked protected fetch through the real main workflow. Do not treat this configuration as application authorization: the route's Bearer OIDC validation remains mandatory.

## Data and freeze status

No Koofr snapshot or Firestore comparison was performed in this checkpoint. Therefore the 28/32 note and 24/36 receipt historical counts remain different-date checkpoints only; there is no current parity result and no merge decision. No old writer was frozen or deleted. No aliases remain on the staging deployment. Legacy cleanup and Firestore alias cutover remain gated on current source snapshots, independent private baseline readback, full parity/conflict review, and restore qualification.
