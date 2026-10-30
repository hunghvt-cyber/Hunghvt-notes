# Compact responsive UI refresh — 2026-10-30

## Scope and decision

This change is a small presentation and interaction cleanup on top of the verified cache-first Production source `c0199c381b5deafd7a939bd405a16a71710aee32`. Firestore, API routes, auth, cache/revision behavior, autosave, ACK, CAS, `clientOpId`, retry, conflicts, and in-memory-only unacknowledged edits are unchanged. No Notes data, draft database, user session, or paid resource was used.

The UI groups the normal workspace into a compact header/status and list toolbar; selection exposes contextual controls and grouped move/other menus; folders are flat rows; note cards use responsive CSS grid without fixed-height tiles; the editor uses a compact toolbar and readable 16px body. Touch targets remain at least 44 CSS px in the checked touch layouts. On phone, list and editor remain a simple one-pane flow. On tablet/desktop, folder/list/editor widths use the available space without icon-only folder labels. Search now toggles existing cards based on a local index instead of replacing every card on each keystroke, preserving card identity during typing.

No new UI dependency, font, icon package, animation, masonry, or feature was added. Existing API/backend/auth/config files did not change.

## Synthetic screenshots and layout evidence

All captures use synthetic browser fixture data (no real Notes). Before is the unmodified `c0199c3` source and after is this candidate. Chromium/Playwright ran on the NAS; these are layout and interaction evidence, not physical-device measurements.

| CSS viewport | Before header/status/list widths (px) | After (px) | Result |
| --- | ---: | ---: | --- |
| 360×800 | 48 / 36 / 340 | 23 / 28 / 346 | One-column phone list |
| 390×844 | 48 / 36 / 370 | 23 / 28 / 376 | One-column phone list |
| 744×1133 | 53 / 38 / 724 | 24 / 28 / 724 | Two-column list where readable |
| 1133×744 | 79 / 42 / 320; folder 64 | 26 / 30 / 358; folder 170 | Wider usable list/editor and folder labels |
| 1280×720 | 79 / 42 / 340; folder 232 | 26 / 30 / 400; folder 210 | Compact header and balanced columns |
| 1920×1080 | 79 / 42 / 340; folder 232 | 26 / 30 / 650; folder 210 | List uses available width |

Representative images: [phone list before](UI-COMPACT-20261030/before/list-390x844.png), [phone list after](UI-COMPACT-20261030/after/list-390x844.png), [tablet portrait after](UI-COMPACT-20261030/after/list-744x1133.png), [tablet landscape after](UI-COMPACT-20261030/after/list-1133x744.png), [desktop after](UI-COMPACT-20261030/after/list-1280x720.png), [wide desktop after](UI-COMPACT-20261030/after/list-1920x1080.png). Additional browser captures and assertions cover folder management, move menu, workspace menu, trash and trash actions; representative images for editor, folders and selection are committed alongside list images. Screenshots are synthetic fixture data under `docs/UI-COMPACT-20261030/{before,after}/`.

Touch audit measured a minimum 44×44 CSS px target at 390×844 and 744×1133; desktop touch emulation minimum was 75×44. Browser assertions also check no horizontal overflow at the six requested viewport widths, menu behavior, Escape/focus return, editor preservation, and that search retains the same card DOM node.

## Size and performance limits

| Asset | Before raw | After raw | Delta | Before gzip | After gzip | Delta |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `public/app.css` | 18,070 B | 25,583 B | +7,513 B (+41.6%) | 4,654 B | 5,859 B | +1,205 B |
| `public/app.js` | 56,429 B | 57,790 B | +1,361 B (+2.4%) | 15,288 B | 15,640 B | +352 B |
| `public/index.html` | 8,209 B | 8,563 B | +354 B (+4.3%) | 2,593 B | 2,683 B | — |

Gzip figures use the same local gzip tool/settings on source files. CSS grew because this app keeps its responsive styling in one hand-written stylesheet; no library was added. A performance speedup is not claimed: the variable synthetic load benchmark is not a same-condition, 20-sample comparison for this visual change. The DOM-identity assertion verifies that typing no longer triggers a full list rebuild; it does not quantify device typing latency.

## Verification

- `npm run check:source`: passed (49 source files).
- `npm test`: passed, 191/191 offline tests.
- Full browser suite on the candidate before the final screenshot-only fixture additions passed all 31 scenarios, including cache, offline/logout, save retry, revision/race, conflict, IME, paste/undo, responsive editor and action-menu behavior.
- After the final CSS selector correction and screenshot-fixture additions: targeted compact capture, responsive/editor preservation, touch/selection/Escape and `node --check public/app.js` passed. The targeted action-menu test passes on NAS after the final synchronous focus correction. The first exact PR #38 CI browser run failed: after ArrowDown, `#backup` remained inactive; the source/unit job passed. Root cause was relying on the deferred native `details` `toggle` event to reveal and focus the portal. The candidate reveals, positions and focuses the first item synchronously for ArrowDown. Exact GitHub logs then showed that ArrowDown passed and the later Enter→Tab assertion lost focus. The candidate now prevents Tab on keydown and repeats focus on the first item at document keyup; the original assertions remain unchanged. The NAS targeted run passes through ArrowDown, Escape, Enter, Tab and Escape. A new exact-head browser CI run is required before merge. CI and local automation cover Chromium headless only; other engines and physical keyboards remain unverified.
- No physical S25 Ultra, iPad, external keyboard, or real Vietnamese IME device test has been performed.

## Gemini collaboration record

Wrapper: `/home/admin/bin/gemini-task`; its help and implementation were checked before parallel use. It accepts pinned `--key key1..key5` and text prompt files; concurrent invocations are safe because state writes are individually locked and the lock is not held across model requests. The wrapper does not accept image payloads, so Gemini could review measurements/source descriptions but could not inspect screenshot pixels. Only synthetic source context and measurements were sent; no Notes, sessions, tokens, secrets, or private logs were sent. Gemini did not edit the repository.

| Key / model / role | Calls | Scheduling and measured wait | Findings and disposition |
| --- | ---: | --- | --- |
| key1 / gemini-3.5-flash-lite / phone analysis | 1 | Parallel phase 1; 6.045 s wrapper duration; phase wall wait 7.268 s | Header/toolbar crowding, touch targets, one-column narrow-phone layout. Applied after viewport checks. |
| key2 / gemini-3.5-flash-lite / tablet-PC analysis | 1 | Parallel phase 1; 5.174 s; same phase | Warned list column could become too narrow and labels should not be replaced by icons. Applied as proportional columns/flat labels, verified at 1133 and 1280 widths. |
| key3 / gemini-3.5-flash-lite / simplification and tests | 1 | Parallel phase 1; 7.266 s; max concurrency 3 | Found search called full `render()` on every keystroke. Confirmed in source and changed it to filter existing card nodes. Also suggested touch/focus/IME regression coverage. |
| key4 / gemini-3.5-flash-lite / final code, a11y and data-safety review | 2 | First final-review phase parallel with key5 (max 2; aggregate wait 6.57 s, each duration not captured); focused recheck parallel with key5, 3.787 s | Found malformed `. #bulk-toolbar` selector, which Codex verified and fixed. Recheck confirmed menu/focus and touch-size fixes. |
| key5 / gemini-3.5-flash-lite / requirements and evidence review | 3 | First final-review phase parallel with key4 (same aggregate wait); focused recheck 4.739 s; screenshot-coverage recheck sequential 2.392 s | First pass was provisional pending CI and could not see image pixels. Codex corrected its overreach about unseen screenshot contents by checking artifacts directly. Rechecks confirmed test/evidence coverage and reiterated CI gate. |

Total: 10 successful Gemini calls from 12 wrapper invocations. Two final-review invocations initially used an unsupported `--file` option; wrapper help showed the prompt file is positional, and the same pinned keys were then invoked correctly. No API request was made by those two usage errors. Successful parallel phases were analysis 3-wide and final reviews 2-wide; one screenshot-coverage call was sequential. Approximate measured wrapper wait was 25.4 s across phases, including both final-review phases (the first key4/key5 phase only has aggregate wall time). No model-call error, timeout, or quota retry occurred. Codex active preparation/review time was not separately clocked; end-to-end task elapsed time is not a measure of saved labor. Gemini found one actionable CSS defect and a real repeated-render cost; without a comparable no-Gemini baseline, time saved cannot be claimed. The final key5 response misidentified which action-menu assertion failed; Codex checked the raw filtered GitHub job log and corrected that statement. The latest key4 review considers the keyup focus fallback safe for the observed runner issue, while noting duplicate focus as a small potential source of churn; Codex keeps it because the exact CI lost focus after keydown. Latest key5 correctly requires green exact-head CI but suggested a Chromium/Firefox/WebKit matrix; Codex rejects that as a release requirement because this repository currently tests Chromium only and the task did not require adding engines. For future work, use 2–3 parallel keys for independent bounded analysis and 2 parallel reviewers after the diff/evidence are ready; recheck only changed areas, keep image review with a vision-capable reviewer, and avoid repeated full review when neither code nor evidence changed.

## Release record

To be completed only after CI, merge, and Production verification. Candidate branch: `ui/compact-notes-20261030`. Production must remain on the verified previous deployment until those gates pass. Rollback target recorded from current Operations verification: `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`; verify deployment and all aliases again immediately before release.
