# PR #39 Production release evidence — 2026-10-30

## Source and CI

- Reviewed PR head: `300bc0180b1c172647f1db9f6e4c36afea0babce`.
- Merge commit: `2c46ead92a06f5f0a5f09895ac3a6c2b48f77689`; tree: `aee822a7617dcae15ad2537cf79407581105cd14` (same tree as reviewed head).
- Latest exact PR-head hosted CI: [run #513](https://github.com/hunghvt-cyber/web-notes/actions/runs/41042959470), success; test and browser jobs passed.
- No post-review code changes were present in the merge.

## Production

- Deployment: `dpl_EvJfiw5jYps1eSmg8FChTDp72e81`, state `READY`, target Production, metadata commit `2c46ead92a06f5f0a5f09895ac3a6c2b48f77689`.
- Project: `hunghvt-notes` (`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`), Vercel Hobby plan; no billing or plan changes.
- Alias readback: all three expected aliases point to the deployment:
  - `hunghvt-notes.vercel.app`
  - `hunghvt-notes-hunghvt.vercel.app`
  - `hunghvt-notes-git-main-hunghvt.vercel.app`
- Health: HTTP 200 on all three; backend `firestore-native-v1`, `firestoreRead=PASS`, `Cache-Control: no-store`. Checks were read-only and did not read or mutate Notes.
- Assets: `/`, `/app.js`, and `/app.css` exactly matched merge-source contents on each alias. SHA-256 on primary alias: HTML `c71b6857a033ad57275e80940be5b79a24d04c663df7c6f838e957ff072a90e4`; JS `bd71732f02a00507d3e3c52c71ffd43f6f379c49df30f6fa9bf084c86c7d05db`; CSS `e10dabc300a535425892616381a2e8ad36bb578cf78e57096917cb7a665aa339`. On primary, `cache.js`, `sort.js`, and `sync.js` also matched exact merge-source hashes.
- Protection: checking the SSO-protected Git-main alias created one temporary shareable-link bypass. It was revoked without regeneration immediately after verification. Final alias readback shows no bypass entries on any of the three aliases.

## Rollback

Previous Production deployment: `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J` (source `18de3fad625210f291bb84033477307283984647`). To roll back, assign each of the three Production aliases above to that deployment, verify all mappings by readback, then check `/api/app?route=health`. Do not alter unrelated preview aliases.

## Scope and device limits

PR #40 folder rename and PR #34 cache/prefetch/backend work remain drafts and were not deployed. No S25 Ultra/iPad physical-device, physical keyboard, or real Vietnamese IME verification was performed. User should check toolbar/layout, folder manager final-row menu, composer/editor sizing, touch behavior, and Vietnamese typing on those devices.
