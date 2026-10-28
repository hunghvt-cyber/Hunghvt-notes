# Koofr legacy deployment and writer inventory — 2026-10-28

Scope: Vercel project `hunghvt-notes`, project ID `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`, team `team_gCsQcRiaCja0GafKj8JZLINI`. Read-only deployment metadata was collected after cutover. Exact Koofr namespace approved for eventual deletion: `Hunghvt-Notes-Data-78cd53a3-e871-40e5-bf04-5e70ac20901e`.

## Current Firestore deployment and aliases

- Keep: `dpl_2Ar8fGYSj7M4iorJHYUBfUGKsMDr`, `hunghvt-notes-7s1dvhwsk-hunghvt.vercel.app`, READY, source `ca18a373f0b53e26a473526de706559a1b957`.
- Aliases `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app` target this deployment.
- A separate Vercel project `notes-firestore-exact-082` (`prj_24XdIpwUoTqfoMNgNUB4y73Iyz1M`) received the main push as a `production` target but is not the canonical `hunghvt-notes` project and its domain set does not include either Notes alias. Its deployment `dpl_8csSwdeiCaztCvbWDcXAXCEUz7F2` failed build because `vercel.json` still referenced the removed migration endpoints. The cleanup commit removes those stale function mappings. This project has no environment variables in metadata and is not treated as a verified/runtime candidate or alias target.
- After removing the stale mappings, the same separate project built `dpl_4nXrVhhx4ywQ98CNoSdBEe8kbjyc` to READY/production. It still has no app environment variables and is not runtime qualified; its aliases are only the `notes-firestore-exact-082` domains. It is not the canonical Production application and must not receive the Notes aliases.
- Runtime health read on 2026-10-28 08:37:15 UTC returned `firestore-native-v1`, project `notes-lab-56f0f`, vault `notes-production`, `firestoreRead=PASS`.
- Vercel project setting: SSO enabled for `all_except_custom_domains`; custom-domain list contains only `hunghvt-notes.vercel.app`. Secondary alias is not listed as a custom domain.
- One temporary shareable protection bypass on the secondary alias was revoked; reread showed `protectionBypass={}`. No bypass secret is recorded here.
- Vercel active firewall configuration is enabled and contains the exact deny rule for retired immutable deployment hosts described below.
- Unauthenticated HEAD to each prior immutable URL returned HTTP 302 to `https://vercel.com/sso-api`. Response bodies were not read. This proves anonymous requests are gated; it does not prove credentialed Vercel/Trusted Source principals cannot access old deployments.

## Prior immutable deployments

Inventory source: Vercel deployment list (35 total, one current Firestore deployment). Every prior host was probed once using unauthenticated HEAD on 2026-10-28. IDs and hosts are exact; status/source metadata are included where present. Do not remove the current Firestore deployment.

| Deployment ID | Immutable host | State / target | Source repo | Ref | Commit |
|---|---|---|---|---|---|
| dpl_C1GyaD89weue2bfEVPWLwzex5WXh | `hunghvt-notes-pmiyn04c0-hunghvt.vercel.app` | ERROR/production | web-notes | main | ca18a373f0b53e26a473526576de706559a1b957 |
| dpl_6Wbucvquftz3g9WAzf1ZUc1cYqEZ | `hunghvt-notes-7e4mg8q93-hunghvt.vercel.app` | READY/production | web-notes | main | 2de8337e860b177e9491d171aa8d0fc2a990cdd0 |
| dpl_CQQ9tSjTfkmJDKFJA5pyCLWnthVT | `hunghvt-notes-jxnkvndz4-hunghvt.vercel.app` | READY/production | web-notes | main | 14ba6c541dc486c3e932d1a965d01413b8f1604d |
| dpl_E1NH7Cjs6i6UVzrpQsYYimu92ukz | `hunghvt-notes-1m4imukw8-hunghvt.vercel.app` | READY/production | web-notes | main | 4a25d90e15bf3940178007574f823680bcb91756 |
| dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1 | `hunghvt-notes-m9km57e78-hunghvt.vercel.app` | READY/production | metadata empty |  |  |
| dpl_RYcLDnzBq1nQd7CALFQNCzooyVdk | `hunghvt-notes-dwtpas5se-hunghvt.vercel.app` | READY/production | metadata empty |  |  |
| dpl_ttdTQbLFDadVX566tKnyVtbA6vGb | `hunghvt-notes-b5dj3b5yx-hunghvt.vercel.app` | READY/production | metadata empty |  |  |
| dpl_H1L38KavsPzE4CbYnpSetZUGnW38 | `hunghvt-notes-7akbwqjy0-hunghvt.vercel.app` | READY/none | metadata empty |  |  |
| dpl_CQ27eV3fHP5ebfTTEhci86PxwA41 | `hunghvt-notes-ebvcn01pw-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 6dae95abc76ffc10c4062817e7357147daa46e36 | 6dae95abc76ffc10c4062817e7357147daa46e36 |
| dpl_6qoNSjLVFDjPRhhAiykGQipbjV5w | `hunghvt-notes-p8bfmvi4v-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 4739ad9e59a9a5b3a77e74164b2411349ed8ff38 | 4739ad9e59a9a5b3a77e74164b2411349ed8ff38 |
| dpl_EESNjsEpJkd2N7V45rkJ28mn3kwf | `hunghvt-notes-nxkxqulof-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 0c8c0761c2625ae2be747e448a7259f974dccb34 | 0c8c0761c2625ae2be747e448a7259f974dccb34 |
| dpl_HWmxfFUXYGKf6hfH1s61rViRkwBv | `hunghvt-notes-ldfg217yp-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 77df09884cd3b52feb1c6c9a42addf4a117f9dbf | 77df09884cd3b52feb1c6c9a42addf4a117f9dbf |
| dpl_2rdgnmV8TFDZp6HvzaaumLrFMHF7 | `hunghvt-notes-28z5vimk1-hunghvt.vercel.app` | READY/production | Hunghvt-notes | a258ffc5ca309d16c71c7f0e1a6348efea8fb7e1 | a258ffc5ca309d16c71c7f0e1a6348efea8fb7e1 |
| dpl_7Fv3KcsC2HYJCMBsS1Joct2rpGXL | `hunghvt-notes-k1yrlp3at-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | 09bf7dd4a955d715680b2a7cf758705b04be9875 |
| dpl_GfGNJu71URhfbgb1JUyNtxpTupGb | `hunghvt-notes-8xcoefizh-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | 87c7249dc0e50e81f60609b6dca1f258a82be3c5 |
| dpl_FEgBfxasivp3gkhZpLmzMYUZUS4w | `hunghvt-notes-d3fmbstgv-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 5602dce65c3d1731cb9edb77a8fa2763cc3b7732 | 5602dce65c3d1731cb9edb77a8fa2763cc3b7732 |
| dpl_8jSxXadFsikkNAuhQuG5aqeVQ4we | `hunghvt-notes-hpmksyo77-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 9a2f6889ed4163832ebed821851db0f2295c63f2 | 9a2f6889ed4163832ebed821851db0f2295c63f2 |
| dpl_GzmdBMvTBA2tPwXnt8vDe2C2ktDr | `hunghvt-notes-r6d65hut0-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 13dcf5145dce4ff487622c5a664d3d43082a1985 | 13dcf5145dce4ff487622c5a664d3d43082a1985 |
| dpl_F8xk96jagGqj1gwTFFAXBrJei6Gx | `hunghvt-notes-ovjkgzd0v-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | d76f9311298ad8aa37c3734075df834c66227e36 |
| dpl_Ekqfjjmry38BQvYkGWw2BH5MnS6U | `hunghvt-notes-amwzju0mm-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 9f504aa7266b2930f8fa233da7ad619bf7e8e13e | 9f504aa7266b2930f8fa233da7ad619bf7e8e13e |
| dpl_834Ucjs6UPtsS9P8tZjnjanLLudQ | `hunghvt-notes-jqsdw5adf-hunghvt.vercel.app` | READY/production | Hunghvt-notes | c4fc2d358a9dd32de39cb719bafdbea86635da8a | c4fc2d358a9dd32de39cb719bafdbea86635da8a |
| dpl_FxvTGfccawAoDUFooxm3smgJKJwv | `hunghvt-notes-joc62zjat-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 9f4c914bf5eb06c304c7186a839d40e1d0fa4238 | 9f4c914bf5eb06c304c7186a839d40e1d0fa4238 |
| dpl_DyQXS6h9ZpgmWcHDvHeHyK2MRVgS | `hunghvt-notes-hjecx5rum-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 9f380b916c61796338f9601c254166b4c16ec273 | 9f380b916c61796338f9601c254166b4c16ec273 |
| dpl_AxdEPmXSkWKfyg9BZ6mNb5aajixM | `hunghvt-notes-doo36yc9x-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 06b1709dec8786e0b501d9a4a31d3aca89b062db | 06b1709dec8786e0b501d9a4a31d3aca89b062db |
| dpl_DNWbePGrpFH6bDa1uZRi6G8W5AqM | `hunghvt-notes-8areeuqkl-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 89f55529e2f092dd218885f39b1bc8626444bcf0 | 89f55529e2f092dd218885f39b1bc8626444bcf0 |
| dpl_6dj9S7QJACVo9U6FUxJNZTG7AT7L | `hunghvt-notes-9t1v5694z-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 0ea57f7b57fd02f20277d53fa8652d408a7dd1e0 | 0ea57f7b57fd02f20277d53fa8652d408a7dd1e0 |
| dpl_CgnqVR6BB1ir7JvtPAYrg7MPEj4H | `hunghvt-notes-m71oqfzxt-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 86202ee6c0103e2749c12ff98954c9603a86fbc8 | 86202ee6c0103e2749c12ff98954c9603a86fbc8 |
| dpl_3CzGXx1bRFrN2mu4CM2q7tfop1Lk | `hunghvt-notes-71ulzglme-hunghvt.vercel.app` | READY/production | Hunghvt-notes | 9405e6081b94c707e751e4ff52f8ae9df68f4458 | 9405e6081b94c707e751e4ff52f8ae9df68f4458 |
| dpl_F8GWVoWwoKFXSDpXqo7gaRJgK988 | `hunghvt-notes-iiubts2du-hunghvt.vercel.app` | READY/production | Hunghvt-notes | e4e3ae50dc510c8f5d20b339d552dc3c742542f9 | e4e3ae50dc510c8f5d20b339d552dc3c742542f9 |
| dpl_dzwHisdhZ2ky5VYQSLkqGJX3rFBT | `hunghvt-notes-rl9ecgwvp-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | 7c77fa04925b73d3dc4e8b74fdfae823841723af |
| dpl_7sWRDkPkNwYfhUx6VJDfHmN5h2xp | `hunghvt-notes-jgogximit-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | 2de00944c05b5f566708c3e028aa00e6f7dbb615 |
| dpl_97WThiMJ427dyDB2ajMHYLgDQjVP | `hunghvt-notes-cn75pg0j0-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | 85f01a65a8473b5e5eb02d44a3b235f711a9d39f |
| dpl_BNPiGYePB3ecjsZF6Uo8BcGiNZjy | `hunghvt-notes-kdywy08fu-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | 34be6a30a1ea6865081937cd8ac71b6d867ce299 |
| dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B | `hunghvt-notes-de329dlyt-hunghvt.vercel.app` | READY/production | Hunghvt-notes | release/minimal-notes | e4bf6d2f478f29acbb8954c07031fa11ba3c85a3 |

## Writer/route inventory and gate

- Old primary deployment: `dpl_SrEHLu6jv6tjTUEPR7F25sxdsFZ1`, host `hunghvt-notes-m9km57e78-hunghvt.vercel.app`. Its old primary alias moved; its immutable URL is SSO-gated for anonymous requests.
- Old secondary alias deployment: `dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`, host `hunghvt-notes-de329dlyt-hunghvt.vercel.app`, source `Hunghvt-notes` / `release/minimal-notes`. Its immutable URL is SSO-gated for anonymous requests.
- Legacy provision writer: branch `release/minimal-notes` commit `c0fe02f340b338275678733d77e622120cafb8fc` deleted its `.github/workflows/notes-provision.yml` and `scripts/provision-notes.mjs`; the source scan then found the same exact provisioner still present on `main`. Main commit `07c99df14e1ae90018ff9a9732647e1cf483443e` removes it from `main`, together with the old 39-folder cleanup workflow/script/allowlist that acted only within legacy Koofr test roots. Release branch fast-forward `6472613ce99e12a4febc6dc160f4f0cfe724fa56` removes its remaining test-folder cleanup trigger and sets `git.deploymentEnabled['release/minimal-notes']=false`; Vercel inventory returned no deployment at this new branch head.
- Cleanup commit removes `.github/workflows/notes-legacy-baseline.yml`, `.notes-migration/baseline-request.json`, `scripts/notes-legacy-baseline.mjs`, and API entrypoints `api/migration-export.js` / `api/migration-rollback.js` from canonical `main`. `NOTES_MIGRATION_ROLLBACK_ENABLED` is absent in current project environment metadata; the export switch is disabled for future deployments. The current alias deployment has no configured rollback enablement, and the surviving export endpoint is read-only and its old baseline workflow has been removed.
- Production env values were not retrieved. `NOTES_MIGRATION_EXPORT_ENABLED` is now `disabled` and `NOTES_WRITES_FROZEN` is `false` for future deployments, confirmed by metadata readback. `NOTES_MIGRATION_ROLLBACK_ENABLED` is absent. Shared Koofr WebDAV and synthetic-test credentials remain unchanged.
- Vercel active firewall config version 1 has `firewallEnabled=true`, `changes=[]`, and active rule `rule_block_retired_notes_deployment_hosts_P2DiU9` (`deny`, `host inc`, 34 exact prior immutable hosts). The current Firestore candidate and both app aliases are excluded. Vercel evaluates deployment protection before WAF, so anonymous 302 responses do not test this rule. No authenticated request probe was performed; the active control-plane rule is the configured all-request deny for those exact hosts. Vercel documents custom WAF rules as available on all plans; no billing change was made.
- The separate `notes-firestore-exact-082` project had six older `release/minimal-notes` immutable deployment hosts. Its active firewall is enabled with `rule_block_retired_notes_release_deployments_HYeGk7`, action `deny`, matching exactly those six hosts. Its current candidate domains are excluded. This is active control-plane evidence, not an unauthenticated 302 response; no authenticated runtime probe was made.
- The exact legacy host WAF denies on both Vercel projects, retired provisioner and test-root cleanup workflow, disabled release-branch deployments, removed baseline OIDC workflow, and absent rollback enablement close the known writer paths. Canonical source has removed the migration routes; the deployed canonical alias still needs a source deployment for those file removals to take effect. Connected Vercel tools expose no deployment-delete operation. Old deployment objects remain; do not describe them as deleted.

## Backup gate

- Backup [40663242871](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663242871), manual dispatch, source commit `56766025faf28679f26c117d02862d6a1a71ca56`, captured at `2026-10-28T09:18:52.624Z` (`16:18:52.624` VN).
- Exact backup ID: `firestore-notes-2026-10-28T09-18-52Z-40663242871-1.json.gz`. Upload/readback, manifest, compressed SHA-256 and snapshot fingerprint verification: **PASS**. SHA-256 `30b1441b402064b5f9245e0ce420533f41a7d696a4229e98f4273cf27d817f23`; fingerprint `525b16af87a11ff9fa690be6daf819475b79202e90819325ec73c8ff34011131`.
- Counts: 32 notes (5 active, 27 trash), 2 folders, 11 shares (0 active), 36 receipts, 0 erased tombstones. Retention reported `retained=1`, `verified=2`, `deleted=1`; only the managed backup prefix is eligible, separate baseline subtree is outside retention.
- Restore [40663337366](https://github.com/hunghvt-cyber/web-notes/actions/runs/40663337366) used that exact backup ID. `restore_parity_pass` matched counts and fingerprint, then `restore_vault_removed` confirmed recursive deletion and absent root for `notes-restore-40663337366`. **Restore qualification: PASS.**
- These were manual runs, not cron. At 08:52 UTC on 28 Oct it was 15:52 VN; the 03:30 VN run that day had passed. Next cron is 03:30 VN 29 Oct (`20:30 UTC` 28 Oct).

## Exact namespace deletion workflow

`.github/workflows/notes-legacy-namespace-delete.yml` is manual only and requires `DELETE_KOOFR_NOTES_NAMESPACE_20261028`. Before deleting the legacy namespace it rereads latest backup/restore controls, downloads the exact snapshot, and rechecks manifest, compressed hash, size, counts and fingerprint; the restore marker must match that backup ID and fingerprint. It verifies the namespace ownership marker, locks the exact root, deletes only descendants under that root, and requires the root to return 404. It emits counts and identifiers only. The namespace has not yet been deleted.

The 03:30 Asia/Ho_Chi_Minh cron for 2026-10-28 had already passed at 08:52 UTC (15:52 VN). The next scheduled run is 03:30 VN on 2026-10-29 (2026-10-28 20:30 UTC). Runs 40663242871 and 40663337366 were manual backup/restore qualification, not cron evidence.

The default-branch CI [run 40665543426](https://github.com/hunghvt-cyber/web-notes/actions/runs/40665543426) passed after commit `1f1c638ba8b5dd6ae7421063a0e4b1ccf96c1cd7`; run [40666407214](https://github.com/hunghvt-cyber/web-notes/actions/runs/40666407214) passed both test and browser jobs for writer cleanup commit `07c99df14e1ae90018ff9a9732647e1cf483443e`. The added synthetic recursive-delete test passes locally as part of 191/191 offline tests; its next CI run is pending. The Vercel check for the separate, unconfigured `notes-firestore-exact-082` project moved to success after removing stale function mappings; that project was not promoted or assigned either Notes alias.

