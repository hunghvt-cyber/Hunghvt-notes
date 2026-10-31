# Header and bottom navigation cleanup

Candidate: `ui/header-cleanup-20261030`, based on `origin/main` at `2ddd0eda7674878732b506eccb736d10c78aa3d8`.

## Scope

UI-only changes to the list header, sort control, status presentation, bottom navigation, and folder manager control. No API, backend, auth, cache, save, revision, or retry code was changed. `public/app.js` edits only status presentation and UI event/layout wiring; CSS keeps the in-flight progress indicator visible while suppressing quiet status text.

The existing bottom navigation for Notes/Search/Trash was removed. Search remains in the list header; Trash remains in the folder sidebar/drawer. Safe-area padding remains for the home indicator and composer. The folder manager panel and sharing actions remain available; its single control is aligned with folder navigation rows.

## Screenshots

All images below use synthetic notes and CSS viewport dimensions. `before/` and `after/` contain matching views for phone 390×844, iPad portrait 744×1133, iPad landscape 1133×744, and PC 1280×720. Additional phone views cover offline/error status, sort open, multi-select, folder manager, and composer.

Codex opened and inspected the before/after phone list, sort menu, multi-select, folder manager, plus representative iPad and PC list screenshots. Observed changes: bottom tabs and standalone selection row are gone; list heading controls share one row; sort opens as a floating menu; connection failure appears once; folder manager uses one outline. Gemini key 5 received only descriptions and test metadata because the NAS wrapper accepts text, not images.

## Checklist and evidence

| Requirement | Result | Evidence |
|---|---|---|
| Select shares list heading row; switches to context toolbar | Pass | responsive browser test checks row geometry and hidden normal controls |
| Normal status does not occupy a row; connection error appears once | Pass | offline state screenshot and DOM count assertion |
| Sort is a floating, keyboard-operable menu | Pass | radio selection, Escape focus return, viewport bounds browser assertions |
| Bottom navigation and its reserved space removed | Pass | markup/CSS/JS removal and computed layout assertion |
| Folder manager has one aligned control and keeps panel/sharing | Pass | computed border/alignment assertions and existing folder sharing suite |
| Menus and composer remain usable | Pass | menu bounds, composer low-viewport, focus and guard browser coverage |
| No API/auth/cache/save/retry changes | Pass | diff contains no API/backend/auth/cache/session/retry files; `busy()` and request paths unchanged |
| Physical devices, hardware keyboard, Vietnamese IME | Not tested | browser automation only |

A CSS regression found during review initially hid the sync progress indicator whenever status text was quiet. A CSS-only rule now keeps the thin progress bar visible during in-flight work while hiding the quiet message. The existing `loading-through-read-and-save-retry` browser test passes after this correction.

## Verification

- `npm test`: 191/191 passed.
- `npm run check:source`: passed (49 files).
- Focused responsive header/status/sort/selection/folder/composer browser test: passed.
- Focused loading/save retry browser test: passed.
- Full `npm run test:browser`: 35/35 passed.
- `git diff --check`, `node --check public/app.js`, and `node --check scripts/browser-smoke.mjs`: passed.
- The full browser suite also emits its pre-existing synthetic load measurement artifact. It is not used here as a performance comparison or claim.

## Gemini review

Wrapper: `/home/admin/bin/gemini-task`, model `gemini-3.5-flash-lite`, text-only.

- Key 4: two calls. The first invocation accidentally supplied only the diff, returned a generic summary, and was not treated as a review. The second supplied the review criteria and diff. It caught the quiet-status CSS rule hiding the progress bar; accepted and fixed with CSS, then the focused and full browser tests passed. It also claimed folder navigation disappears during selection; that is intentional because the requested context toolbar replaces the same row. Its status-reference concern was false: remaining errors explicitly set the one global banner to alert, and no `workspace-status` references remain. Its menu clipping concern was not supported by the tested bounds and existing viewport-limited menu rules.
- Key 5: one call, run concurrently with the first key 4 call. It confirmed the checklist evidence and called out that it could not inspect pixels; noted as a limitation. Codex directly inspected the listed synthetic PNGs.
- Maximum concurrent calls: 2. Per-call elapsed time was not instrumented reliably; no time-saved claim is made.

## Release state

Candidate only. No merge and no Production deployment. Production remains unchanged. Hosted CI will run after opening the draft PR. No physical S25 Ultra/iPad or real IME validation is claimed.

## Follow-up: grid row overlap reported in phone screenshots

The narrow one-column grid used implicit `auto` tracks while cards were aligned to the start. At a 360 CSS px viewport, computed rows were only 75 px high even though card boxes reached 122.7 px; the 7 px row gap therefore still allowed boxes to overlap. The fix sets `grid-auto-rows: max-content`, retaining the current columns, card sizing, preview clamp and 7 px gap. No masonry, library, or app logic was added.

A dedicated synthetic Chromium test, `scripts/grid-layout-smoke.mjs`, checks long titles, multiline preview and long folder metadata at 360×844 and 390×844. It asserts the computed track mode, each card's folder metadata fits its card, content is not vertically clipped, and every card bottom plus the computed row gap is at or above the next row. It captures normal and open-sort screenshots at both widths.

After the fix, computed rows at 360 px vary from 83.6 to 122.7 px; at 390 px they vary from 103.8 to 122.7 px. All successive rows have the full 7 px gap and the bounding-box assertions pass. Updated images: `after/list-phone-360.png`, `after/list-phone-390.png`, `after/sort-open-phone-360.png`, and `after/sort-open-phone-390.png`.

Related verification after the fix: focused header browser test passed; dedicated grid test passed at both widths; source check passed (50 files); script syntax and `git diff --check` passed. The full local browser suite is unchanged from the prior candidate; hosted CI is being rerun for this follow-up. No speed/auth/cache/save files were edited. The separate speed worktree remains dirty in `public/app.js`, `public/cache.js`, and `scripts/browser-smoke.mjs`; this follow-up only touches CSS, the CI workflow, a new standalone test, this report, and synthetic screenshots.
