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


## Trusted Source and event verification

- The baseline workflow is `push` on `main`, path-limited to `.notes-migration/baseline-request.json`, and requires the commit message marker `[notes-legacy-baseline]`. It has no `workflow_dispatch` trigger. The exporter checks `event_name == push`.
- Run [40649120419](https://github.com/hunghvt-cyber/web-notes/actions/runs/40649120419), attempt 2, decoded the actual GitHub OIDC JWT locally and logged only selected claims (never the token). Actual claims: issuer `https://token.actions.githubusercontent.com`; audience `https://hunghvt-notes.vercel.app/notes-legacy-baseline`; subject `repo:hunghvt-cyber@252749231/web-notes@1423348828:ref:refs/heads/main`; repository ID `1423348828`; owner ID `252749231`; ref `refs/heads/main`; workflow_ref `hunghvt-cyber/web-notes/.github/workflows/notes-legacy-baseline.yml@refs/heads/main`; event `push`.
- Attempt 1 failed at Google WIF because the live backup provider condition allowed only `firestore-backup.yml`. Before changing it, the exact live mapping/condition and existing repository principal binding were saved in [WIF-BACKUP-WORKFLOW-ALLOWLIST-ROLLBACK-20261028.md](WIF-BACKUP-WORKFLOW-ALLOWLIST-ROLLBACK-20261028.md). The backup provider condition now preserves the same repository and `main` ref, allowing exactly either the existing Firestore backup workflow or this exact baseline workflow. No mapping, issuer, service account, IAM binding, database role, or restore provider changed. Readback confirmed ACTIVE; attempt 2 passed Google WIF.
- The same run then stopped before source access with `KOFR_EXPORT_NETWORK_FAILED`: Vercel Deployment Protection rejected the request. No Koofr or Firestore snapshot was taken.
- The deployment remains target `production` even though its alias inventory is empty. Vercel Trusted Sources allows GitHub Actions on all plans, so this rule does not require a plan upgrade or billing change ([official documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)). Team metadata did not expose a plan name.
- Runtime log query for each interval where the stage deployment briefly held a Production alias found four `GET /api/app` invocations and zero mutating HTTP methods for each deployment. The two request intervals were 06:52:40–06:55:00Z (deployment `dpl_E1NH7Cjs6i6UVzrpQsYYimu92ukz`) and 06:56:35–07:00:00Z (deployment `dpl_CQQ9tSjTfkmJDKFJA5pyCLWnthVT`). These logs show no stage-deployment writes in those windows; they do not imply old deployments were frozen.


## Verified baseline run 40649120419

- Run [40649120419](https://github.com/hunghvt-cyber/web-notes/actions/runs/40649120419), attempt 3, completed successfully from the approved `push` on `main`. The real OIDC/WIF step and protected exporter call passed.
- The workflow completed capture, private Koofr upload, remote readback, compressed-object SHA-256 verification, and manifest/readback validation. No snapshot was uploaded as a GitHub artifact. Snapshot objects and hashes are intentionally not reproduced here.
- Filtered comparison summary: Koofr had 28 notes (6 active, 22 trash), 2 folders, 11 shares (0 active), 24 receipts, and 0 erased markers. Firestore had 32 notes (5 active, 27 trash), 2 folders, 11 shares (0 active), 36 receipts, and 0 erased markers.
- Full snapshot comparison reports `match: false`; difference categories are `notes`, `note-count`, and `idempotency-receipts`. Counts alone do not establish whether these represent post-checkpoint changes, tombstone effects, or conflicting content. Preserve both sources and their verified private baseline; do not merge, cut over, or delete legacy data until record-level comparison can classify the differences while preserving deletion state.
- This is a manual Actions run, not evidence that the scheduled cron has executed. Neither legacy writers nor aliases were changed by this run.
