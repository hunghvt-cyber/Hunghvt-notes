# PR43 Production release — 2026-10-31

## Source and checks

PR [#43](https://github.com/hunghvt-cyber/web-notes/pull/43) merged at
`b3a4de5b7a86d3adc95ab4064de5c0a9cdddb249`. The merge tree is
`49b1392155a735500fa6a7771ad585aba6c8931f`, identical to reviewed PR head
`153f3651f80ccb3c1dff0e97e4890a86da7a0fbe` and the locally tested tree.
Final hosted Actions run
[41180959356](https://github.com/hunghvt-cyber/web-notes/actions/runs/41180959356)
passed both `test` and `browser` jobs.

Local checks on Node 24.22.2: `npm test` 199/199, `npm run check:source`
50 files, `npm run test:browser` 39/39, and `scripts/grid-layout-smoke.mjs`
passed at 360 and 390 px. New browser regressions measured card row and composer
bounding boxes, folder-plus centering, saved-state/content preservation, and
diagnostics off/on at phone, iPad portrait/landscape, and PC viewports. Synthetic
Chromium screenshots were reviewed; this is not a physical-device qualification.

PR43 preserves the opt-in `?diag=1` instrumentation. The three UI fixes equalize
cards within each row while keeping two-line previews and folder metadata,
override the quick-composer high-specificity sizing rules for real expand/shrink,
and center a 44×44 folder-create SVG while retaining its aria-label. No backend,
auth, CAS, ACK/retry, or persistent-draft behavior changed. Gemini source review
returned no actionable finding.

## Production deployment

The canonical Vercel project is not Git-connected. Deployment
`dpl_6JvV65W8wi6AQgyNfbUfA7gjC5LJ`
(`hunghvt-notes-2r3dlhgq7-hunghvt.vercel.app`) was created from the exact
merge source SHA above using the 38 tracked runtime/config files from tree
`49b1392`. Vercel metadata records source SHA
`b3a4de5b7a86d3adc95ab4064de5c0a9cdddb249`; deployment reached `READY` in
`fra1`. No project setting, plan, billing, or paid service was changed.

All three application aliases read back on that deployment with empty protection
bypass objects:

- `hunghvt-notes.vercel.app`
- `hunghvt-notes-hunghvt.vercel.app`
- `hunghvt-notes-git-main-hunghvt.vercel.app`

The public primary alias returned HTTP 200 and byte-for-byte source matches for
the app and diagnostics assets:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `/` | 10,867 | `f8a7ceb18f9f4e0b48d9c64ba7a20597aab7960a96401180df50d57d13943dd5` |
| `/app.css` | 29,058 | `161ffd35f1f3db37bf24b85ea96585a0eca1746bd4b44ea5256bd4c4a33f4918` |
| `/app.js` | 67,859 | `f296ed1bcbd3a147ea4ed2cec9b665082d86e74af2515ec26fa4abd3868cbbf3` |
| `/performance-diagnostics.js` | 8,253 | `d0840ae5b1eb832a8802391739e027461ae2cf5f36ec9bafb4c6b6aacf3bb433` |
| `/cache.js` | 1,309 | `3c5d025c87a761a8bc6fd1b5b18510458e85c15b6086e00c36c048e8d165d6e1` |
| `/sort.js` | 1,343 | `e8ffeb3897734aa9a26096ce77bb4b61c13157efded278e9b337eaf728073cee` |
| `/sync.js` | 7,159 | `73616a0af8b4da24f098b5dc6da1ba55a2c12da073dde6f0ad05d0963b9eaa19` |

Read-only `/api/app?route=health` returned HTTP 200, backend
`firestore-native-v1`, and `firestoreRead=PASS` with `Cache-Control: no-store`.
No production Notes were read or mutated beyond this health probe.

## Rollback

Immediate rollback target remains READY deployment
`dpl_CYyjsrnFTbUvD87w4wWF7J3VUvfX`, source
`f2eef8490a8b9a50e3da0c987a0646e808736788` (PR42). To roll back, assign the
three aliases above to that exact deployment, read back all mappings and empty
bypass state, then check `/api/app?route=health` for Firestore PASS. No rollback
was performed during this release.
