# PR #41 Production release — 2026-10-30

## Source and CI

- PR: [#41](https://github.com/hunghvt-cyber/web-notes/pull/41), merged.
- Reviewed PR head: `35c7276d8685631e1a64f9abf671a62406276773`.
- Hosted Actions run [#518](https://github.com/hunghvt-cyber/web-notes/actions/runs/41064782892) passed `test` and `browser` on that exact head.
- Merge SHA: `322fc49a56bf43d44250cadfe19a9a2106cfb331`.
- Merge tree: `d6a80670b5496a8baf135f70493888df14ec4ffe`, identical to the reviewed PR tree.
- Deployment source was a clean detached checkout at the exact merge SHA. The unrelated speed-session worktree was dirty and was not used.
- PR #34 and PR #40 were excluded and remain drafts.

## Vercel and runtime verification

- Project: `hunghvt-notes` (`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`), team `hunghvt`.
- Production deployment: [`dpl_HL8rpL4ciJg1V4Jt3LmkkxDpUkdB`](https://vercel.com/hunghvt/hunghvt-notes/HL8rpL4ciJg1V4Jt3LmkkxDpUkdB), state `READY`, target `production`.
- Deployment metadata source SHA: `322fc49a56bf43d44250cadfe19a9a2106cfb331`.
- Uploaded 37 runtime source/config files from the clean merge checkout (390,117 bytes). Vercel build completed successfully; no plan, billing, IAM, environment, or paid-service setting changed.
- All three expected aliases read back to the deployment:
  - `hunghvt-notes.vercel.app`
  - `hunghvt-notes-hunghvt.vercel.app`
  - `hunghvt-notes-git-main-hunghvt.vercel.app`
- Each alias readback had an empty `protectionBypass` object. No temporary bypass was created.
- Anonymous NAS requests to the primary alias returned HTTP 200 for `/` and `/api/app?route=health`; health reported `firestore-native-v1`, `firestoreRead=PASS`, and `Cache-Control: no-store`.
- The two secondary aliases are protected by Vercel Authentication (anonymous requests return 302); their alias-to-deployment and protection state were verified from Vercel control-plane readback.

### Asset hashes

The deployed primary alias files below were fetched and their SHA-256 hashes matched the exact source files from the clean merge checkout:

| Path | SHA-256 |
| --- | --- |
| `/` (`public/index.html`) | `9315922f8313083e9f53c5ee134119d31a0628b673b06ce86cba8486ec089b87` |
| `/app.css` | `c13f1ae7ad45ae5035556b4f5d81490095ebfbbcef1eebcce6f1a87ed5710203` |
| `/app.js` | `d06025e7eabacf7d1dd3dae1f3ac90f0418285dfe0fa54dc14a6509ba9b9ad78` |
| `/cache.js` | `3c5d025c87a761a8bc6fd1b5b18510458e85c15b6086e00c36c048e8d165d6e1` |
| `/sort.js` | `e8ffeb3897734aa9a26096ce77bb4b61c13157efded278e9b337eaf728073cee` |
| `/sync.js` | `2e1b16d43f2cf0a0c8b6dad44be6750478ac8e1d8984badf6c619160ea8cc77b` |

## Rollback

Previous Production deployment: `dpl_EvJfiw5jYps1eSmg8FChTDp72e81`.

To roll back, assign each of the three aliases above back to that deployment. Read all three alias mappings back, verify empty protection bypass state, then request `/api/app?route=health` and confirm Firestore read PASS. Leave unrelated aliases unchanged.

## Limits

No S25 Ultra or physical iPad test, OS keyboard test, or real Vietnamese IME verification was performed. Hosted browser checks do not replace those device checks. This release is not a claim of achieving an “8/10 Google Keep” rating.
