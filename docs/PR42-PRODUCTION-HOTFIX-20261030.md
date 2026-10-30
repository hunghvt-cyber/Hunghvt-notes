# PR #42 Production hotfix — 2026-10-30

## Change and verification

- PR [#42](https://github.com/hunghvt-cyber/web-notes/pull/42) merged as `f2eef8490a8b9a50e3da0c987a0646e808736788`.
- Merge tree: `0c92a3fbe513fe46e23b492e3bd8b1f8622868f8`.
- Hosted Actions [run #522](https://github.com/hunghvt-cyber/web-notes/actions/runs/41079573637) passed `test` and `browser` on exact PR head `f05e9737ede72e2035455a7266d24316876691dd`.
- Local `npm run check:source` passed (50 files); `npm test` passed 191/191; focused synthetic browser flow passed at 390×844, 744×1133, 1133×744, and 1280×720; `git diff --check` clean.
- The same focused browser flow against the pre-hotfix Production source failed as expected: while in Trash the accessibility snapshot contained only the count/actions and no back-to-notes control. The fixed source passed on all four viewports.
- Browser fixture covered All → Trash → All through the touch drawer and desktop sidebar, 0/1/multiple selected notes, no Move/Delete actions in Trash, restore/permanent-delete menu visibility, viewing a trashed note and closing back to Trash, empty Trash, Escape closing the menu, focus restoration, and the explicit Close selection action in the normal list.
- No backend/API/auth/cache/data behavior or bottom navigation changed. Tests only used the synthetic fixture.

## Production deployment

- Clean detached release checkout at exact merge SHA/tree; the dirty speed-session worktree was not used.
- Vercel deployment [`dpl_CYyjsrnFTbUvD87w4wWF7J3VUvfX`](https://vercel.com/hunghvt/hunghvt-notes/CYyjsrnFTbUvD87w4wWF7J3VUvfX) reached `READY`, target `production`, metadata source SHA `f2eef8490a8b9a50e3da0c987a0646e808736788`.
- All three Production aliases read back to this deployment: `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, `hunghvt-notes-git-main-hunghvt.vercel.app`. Every alias readback had empty `protectionBypass` state. No temporary bypass was created.
- Anonymous GET to the public primary alias returned HTTP 200 for `/api/app?route=health`; response had `Cache-Control: no-store`, backend `firestore-native-v1`, and `firestoreRead=PASS`. The other two aliases are protected by Vercel Authentication; their control-plane mappings and empty bypass state were verified.
- On the primary alias, `/`, `/app.css`, `/app.js`, `/cache.js`, `/sort.js`, and `/sync.js` matched files from the exact release checkout byte-for-byte by SHA-256:

| Asset | SHA-256 |
| --- | --- |
| `/` | `2f82815cdb8e08872b9d0cacdd3e416dc47f8e9a146460a50128f079b2a485ce` |
| `/app.css` | `7f9717cdb15f4ce3e7c8665637be44f5ab747e031eaec84e85a0f5887f16115b` |
| `/app.js` | `f27adbfa86606a0b958feaabe682701292d111a77c62226701dfcfd3d4a5be86` |
| `/cache.js` | `3c5d025c87a761a8bc6fd1b5b18510458e85c15b6086e00c36c048e8d165d6e1` |
| `/sort.js` | `e8ffeb3897734aa9a26096ce77bb4b61c13157efded278e9b337eaf728073cee` |
| `/sync.js` | `2e1b16d43f2cf0a0c8b6dad44be6750478ac8e1d8984badf6c619160ea8cc77b` |

No billing, plan, IAM, environment, or paid-service setting changed.

## Rollback and speed-session handoff

Previous Production deployment: `dpl_HL8rpL4ciJg1V4Jt3LmkkxDpUkdB` (PR #41 release). To roll back, assign all three aliases above to that deployment, read back all three mappings and empty bypass state, then check `/api/app?route=health` for Firestore read PASS. Do not move unrelated aliases.

The local worktree `notes-speed-no-persistent-drafts-20261029` was observed with uncommitted edits to `public/app.js`, `public/cache.js`, repository/API code, browser tests, and docs; it was left untouched and was not used for this hotfix. It is behind current `main` and has overlap in `public/app.js`. Before any later speed deployment, reconcile its work with main at `f2eef8490a8b9a50e3da0c987a0646e808736788` and re-run the relevant tests; do not deploy its stale tree as-is.

No physical iPad/phone test was performed. The viewport results are Chromium fixtures, not device verification.
