# Vercel project retirement — 2026-10-29

## Scope and pre-delete verification

Team: `team_gCsQcRiaCja0GafKj8JZLINI` (CLI scope `hunghvt`). At 2026-10-28 17:10 UTC / 2026-10-29 00:10 Asia/Ho_Chi_Minh, authenticated Vercel project metadata was read by exact project ID. Each target's returned name and `accountId` matched the user's requested values:

| Name | Project ID | Team ID | Pre-delete state |
|---|---|---|---|
| `notes-firestore-exact-082` | `prj_24XdIpwUoTqfoMNgNUB4y73Iyz1M` | `team_gCsQcRiaCja0GafKj8JZLINI` | present |
| `homepage-koofr-lab` | `prj_ZJDuwQOKVSzqfs3z0IMLAOrlNudX` | `team_gCsQcRiaCja0GafKj8JZLINI` | present |

Before deletion, serving aliases were read:
- `hunghvt-notes.vercel.app` -> project `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`, deployment `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`.
- `homepage-nas.vercel.app` -> project `prj_3CCmGVbfaymDVoO66d6MPU1CQ1nw`, deployment `dpl_4T9PcviEaivkFGqDGsYKhRgVX4jE`.

## Action and readback

Using Vercel CLI 65.5.0, each exact verified project name was deleted with `project delete <name> --yes --scope hunghvt`. Both commands returned `Deleted`. No storage, integration, credential, Firestore database, backup, or baseline command was run.

After deletion:
- Team project listing returned exactly four projects: `homepage-nas` (`prj_3CCmGVbfaymDVoO66d6MPU1CQ1nw`), `hunghvt-notes` (`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`), `home-ai` (`prj_NNcgJZhGPzvZcch121ktc7Ycfy08`), and `homepage-automation-info` (`prj_KV0bSpnREDAtS1GUKA1ceU1zawvE`).
- Exact-ID reads for both deleted projects returned 404 `Project not found`; `homepage-koofr-lab.vercel.app` alias lookup also returned 404.
- `hunghvt-notes.vercel.app` remains on `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM` in the canonical Notes project.
- `homepage-nas.vercel.app` remains on `dpl_4T9PcviEaivkFGqDGsYKhRgVX4jE` in the retained Homepage NAS project.
- Readbacks confirmed all four retained projects still exist in the same team.

This record contains project/deployment metadata only; it contains no customer content, secret, token, or credential. The change is on the open draft PR #24 branch and is not merged or promoted.
