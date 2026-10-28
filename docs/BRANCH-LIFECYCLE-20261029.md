# web-notes branch lifecycle inventory — 2026-10-29

## Current decision

This inventory uses read-only remote refs from `git ls-remote --heads --tags`, GitHub PR state, workflow definitions on `main`, and local worktree status. It does not merge legacy code or modify Production or Firestore data.

| Keep | Exact ref | Reason |
|---|---|---|
| Yes | `main` | Canonical Firestore application, operational guidance and current evidence. |
| Yes, operational dependency | `release/minimal-notes` | `.github/workflows/notes-inbox.yml` is explicitly restricted to this ref and `.notes-inbox/request.json`; the Code Inbox WIF subject/workflow trust also names this ref. Keep only until that publisher/trust dependency is migrated and verified. The legacy Koofr app on this branch is not to be merged into `main`. |
| Yes, experiment only | `notes/firestore-read-batching-perf-20261028` | Draft PR #24 holds the unqualified Firestore read-batching experiment and synthetic harness/results. Keep isolated; do not merge/promote its source patch until Vercel OIDC qualification. PR-specific Vercel retirement evidence is copied separately to `main` in [Vercel project retirement](VERCEL-PROJECT-RETIREMENT-20261029.md). |

PR #24 remains open/draft. The obsolete Koofr/Blob proposals PR #1 (`split/notes-standalone`) and PR #2 (`release/minimal-notes`) were closed unmerged. PR #2's branch remains temporarily because of the Code Inbox trigger/trust dependency above; closing the proposal does not disable that workflow.

## Branches approved for archive and retirement

The refs below were present on the remote at inventory time. Each proposed tag preserves that exact remote branch HEAD; tags use `archive/web-notes/2026-10-29/<branch>`. Reason group:
- **legacy Koofr/Blob**: preserve old source/history without merging it into Firestore `main`.
- **superseded**: source, claim fix, backup/cutover, or evidence was incorporated into or replaced by current `main`; no remaining open PR or workflow dependency requires the branch.
- **retired exporter/baseline**: temporary migration/export/trust work is retired; preserve its history but do not re-enable it.

| Remote branch | Remote HEAD at inventory | Reason | Archive tag / status |
|---|---|---|---|
| `codex/firestore-backup-candidate-20261028` | `a5df69b3c98b26e6e2f27bad8f0a686923386c65` | superseded by merged Firestore backup source | `archive/web-notes/2026-10-29/codex/firestore-backup-candidate-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-baseline-export-oidc-20261028` | `977a98f75d8e55ef52b889472b1c0daf33566a44` | retired baseline export | `archive/web-notes/2026-10-29/codex/notes-baseline-export-oidc-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-baseline-export-oidc-v2-20261028` | `c5331bf77f51b5944e453e9f8d0894f9dba9e344` | retired baseline export | `archive/web-notes/2026-10-29/codex/notes-baseline-export-oidc-v2-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-baseline-export-oidc-v3-20261028` | `70b926c79810684ed69541d892421544d3ec09d0` | retired baseline export | `archive/web-notes/2026-10-29/codex/notes-baseline-export-oidc-v3-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-baseline-vercel-trust-20261028` | `f545df90409206f61defd50edc7e9bef9a0d7006` | retired baseline trust | `archive/web-notes/2026-10-29/codex/notes-baseline-vercel-trust-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-code-inbox-runtime-status-20261028` | `57ad2b82a7b7da63c054688777bd9d130c77d20c` | superseded evidence; current Code Inbox source remains in `main` | `archive/web-notes/2026-10-29/codex/notes-code-inbox-runtime-status-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-evidence-handoff-20261028` | `1bbde1615d7d13c529d30e7aa4c6da7ce0b3d973` | superseded evidence | `archive/web-notes/2026-10-29/codex/notes-evidence-handoff-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-firestore-cloudshell-20261027` | `4c30e51ef303d5f29948f10a0ab5ff70741472ed` | superseded Firestore candidate | `archive/web-notes/2026-10-29/codex/notes-firestore-cloudshell-20261027` — created, remote SHA verified, branch deleted |
| `codex/notes-firestore-prod-final-20261027` | `7fccf15e11896f1f397f1d893fa2a8dab0876b0a` | superseded Firestore candidate | `archive/web-notes/2026-10-29/codex/notes-firestore-prod-final-20261027` — created, remote SHA verified, branch deleted |
| `codex/notes-firestore-production-package-20261027` | `d4dee26d1c992affd0a4f7d20d402fe2e0523fa2` | superseded Firestore candidate | `archive/web-notes/2026-10-29/codex/notes-firestore-production-package-20261027` — created, remote SHA verified, branch deleted |
| `codex/notes-migration-export-route-20261028` | `2111f122387973cbdf5d29409e646264ad240906` | retired migration export route | `archive/web-notes/2026-10-29/codex/notes-migration-export-route-20261028` — created, remote SHA verified, branch deleted |
| `codex/notes-production-cutover-20261027` | `97c84e74d2e21ceb3a72b36dd16e6d9505a8e742` | superseded cutover candidate | `archive/web-notes/2026-10-29/codex/notes-production-cutover-20261027` — created, remote SHA verified, branch deleted |
| `codex/notes-repo-rename-release-20261028` | `3198449fc7e4a4bd28715f8fe41818b6fa6f91c8` | superseded canonical repo rename/release candidate | `archive/web-notes/2026-10-29/codex/notes-repo-rename-release-20261028` — created, remote SHA verified, branch deleted |
| `feat/folder-share-badges-20261020` | `68367cd5072c035e89fbced4d38bd0f03b44577f` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/folder-share-badges-20261020` — created, remote SHA verified, branch deleted |
| `feat/hide-home-link-shared-20261020` | `48400a4f10b1910d3a0285667cab5b3fae09d357` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/hide-home-link-shared-20261020` — created, remote SHA verified, branch deleted |
| `feat/notes-bulk-toolbar-progress-20261019` | `64a64148a30836e6141125320562265f9bf243a0` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/notes-bulk-toolbar-progress-20261019` — created, remote SHA verified, branch deleted |
| `feat/notes-code-inbox-20261026` | `87d1729704310ca32ada2d64dc1b3e8d827cd93a` | feature incorporated/replaced; workflow dependency is on `release/minimal-notes`, not this branch | `archive/web-notes/2026-10-29/feat/notes-code-inbox-20261026` — created, remote SHA verified, branch deleted |
| `feat/notes-fast-refresh-20261019` | `fb4ea19341ed2534669e6fb04a3cc4278bf0b281` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/notes-fast-refresh-20261019` — created, remote SHA verified, branch deleted |
| `feat/notes-sort-move-20261019` | `465891477701136794f0fac2e12fbd45cf9e9b33` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/notes-sort-move-20261019` — created, remote SHA verified, branch deleted |
| `feat/scoped-local-cache-20261019` | `3113239140eee46a361d60005f6926031bfaff72` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/scoped-local-cache-20261019` — created, remote SHA verified, branch deleted |
| `feat/share-folder-cleanup-20261020` | `518e1a5cde8d51ce0b8ddd0ded8c479169eb42f9` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/share-folder-cleanup-20261020` — created, remote SHA verified, branch deleted |
| `feat/share-link-copy-20261020` | `28cf4efeb94f648cbaee4102aae08d6556ffb389` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/share-link-copy-20261020` — created, remote SHA verified, branch deleted |
| `feat/shared-password-20261026` | `e1ad9a47faf603739e917b212ce114ca9d4b2d6b` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/shared-password-20261026` — created, remote SHA verified, branch deleted |
| `feat/trash-simple-cache-20261019` | `5299c844a55f44c6ee73b9a0cb395fa2468166df` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/feat/trash-simple-cache-20261019` — created, remote SHA verified, branch deleted |
| `fix/bootstrap-single-lock-20261019` | `9288c88ed414c25e90011e0e417a1f7416a0a65f` | legacy feature; superseded in current app | `archive/web-notes/2026-10-29/fix/bootstrap-single-lock-20261019` — created, remote SHA verified, branch deleted |
| `perf/reduce-lock-cycles-20261020` | `1f1f7639891371c1ee17c232d5253d783632736c` | legacy performance branch; superseded by the isolated PR #24 experiment | `archive/web-notes/2026-10-29/perf/reduce-lock-cycles-20261020` — created, remote SHA verified, branch deleted |
| `split/notes-standalone` | `235371c05a7ec91db15bd9b339b535571b005645` | old Koofr/Blob standalone system; its preview workflow references the retired lab project | `archive/web-notes/2026-10-29/split/notes-standalone` — created, remote SHA verified, branch deleted |

## Workflow and CI dependency check

- `.github/workflows/notes-inbox.yml` runs only on `release/minimal-notes` when `.notes-inbox/request.json` changes. The branch and its exact ref trust are retained to preserve Code Inbox until a separately qualified migration.
- `notes-inventory.yml` also targets `release/minimal-notes`; its job additionally requires a `[notes-inventory]` commit marker. It is not triggered by this cleanup.
- `notes-preview-qualify.yml` targets `split/notes-standalone` and its old Vercel preview hosts. Closing PR #1 and retiring that branch removes its push source; workflow file cleanup can be done with the next source hygiene patch.
- `notes-ci.yml` previously had unfiltered `push:`, which would also launch two CI jobs and artifacts for every archive tag. It now filters push runs to `main`, `release/minimal-notes`, and the PR #24 experiment branch; PR events remain enabled. Main update commit: `08be0b036c4b03368b4e51a036043a79a07d78bb`. The Actions connector returned no run for that commit at the time of checking.
- Backup is `workflow_dispatch`; restore qualification is a `workflow_run` of successful backup on `main`. Neither uses the retired branches.
- Per `AGENTS.md`, Vercel is not Git-linked, so docs/workflow changes do not themselves deploy Production. No Production source/configuration or data was changed.

## Local worktree preservation

No local worktree was reset, cleaned, removed, or switched. At inspection time, these worktrees contained uncommitted tracked or untracked changes and remain untouched: `/home/admin/Hunghvt-notes`, `/vol1/Docker/.codex-admin/worktrees/hunghvt-notes-backup`, `/vol1/Docker/.codex-admin/worktrees/notes-perf-opt-20261028`, `/vol1/Docker/.codex-admin/worktrees/web-notes-backup-gate-20261028`, `/vol1/Docker/.codex-admin/worktrees/web-notes-cutover-20261028`, `/vol1/Docker/.codex-admin/worktrees/web-notes-legacy-cleanup-20261028`, and `/vol1/Docker/.codex-admin/worktrees/web-notes-runtime-fix-20261028`. Several are detached worktrees. The local branch `codex/firestore-runtime-lazy-import-20261028` is ahead/behind `origin/main` and has dirty files; it is not a remote branch and was left untouched. The local perf branch also has a modified report and untracked `node_modules`; preserved.

## Retirement result — 2026-10-29

The initial remote inventory had 30 branches. After the user completed GitHub CLI device-flow login in the dedicated configuration directory, 27 lightweight archive tags were created through the GitHub API. A fresh `git ls-remote --heads --tags` readback verified every archive tag's remote SHA equals the recorded exact branch HEAD; the branch HEADs also still matched immediately before deletion. Only then were the 27 retired refs deleted by exact GitHub API ref. Final readback has exactly three remote branches: `main`, `release/minimal-notes`, and `notes/firestore-read-batching-perf-20261028`; all 27 archive tags remain and resolve to their recorded SHAs. No force-push was used.

PR #1 (`split/notes-standalone`) and PR #2 (`release/minimal-notes`) remain closed unmerged; PR #24 remains open/draft and isolated. `release/minimal-notes` remains because the current Code Inbox publisher workflow and WIF trust still require its exact ref. Its legacy application source was not merged to `main`. `main` remains the Firestore source and operations/evidence branch. The perf change remains unqualified and unpromoted.

The GitHub CLI used a dedicated `GH_CONFIG_DIR` under `/vol1`; no token/code was recorded in this repository. No dirty worktree was reset, cleaned, or removed. Production configuration, aliases, Firestore data, backup, and shared credentials were not changed.
