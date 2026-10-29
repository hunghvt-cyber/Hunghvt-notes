# Responsive Notes UI integration — 2026-10-29

## Scope and source

This integrates the approved responsive design into the existing Notes application on `codex/ui-responsive-integration-20261029`, based on `origin/main` at `d7b17ef9271b9f94e66454fd89638e5e80964390`. Approved prototype reference: `codex/ui-responsive-prototype-20261029` at `356baa04da3324b95ed1c2ee3e56e59e759c182c`.

The work changes only the production UI structure/styles and browser smoke coverage. The existing application editor nodes and real API, Firestore repository, auth/session, IndexedDB draft/cache, save/error/conflict behavior, history, share/revoke, Code Inbox, and trash/restore flows remain in use. No synthetic sync indicator or mock persistence was added to the app. The red trash action is now a labeled action inside the editor menu. Long titles use a growing textarea; on width changes it recalculates without replacing the editor node. The folder area retains complementary sidebar semantics on desktop and receives dialog/modal semantics only while the drawer is open. Folder share management closes the drawer synchronously before showing the share panel.

## Responsive layout and measurements

Breakpoints use available CSS width rather than device names:

- At 390 px, one surface is shown at a time, with a folder drawer and bottom navigation.
- At 744 px portrait, the list is the default surface; opening a note replaces the list with the editor. Folders stay in a drawer.
- At 1133 px landscape, the folder rail is 64 px and list + editor are visible.
- Above 1200 px, folders, list, and editor use three columns.

The following geometry was measured in Chromium headless using the app source and synthetic fixtures. “Writing area” is the actual `#text` textarea width.

| Viewport | Folder panel | List | Editor | Writing area |
| --- | ---: | ---: | ---: | ---: |
| 390 × 844 | 0 px (drawer closed) | 0 px (editor active) | 370 px | 317 px |
| 744 × 1133 | 0 px (drawer closed) | 0 px (editor active) | 724 px | 640 px |
| 1133 × 744 | 64 px rail | 320 px | 701 px | 639 px |
| 1440 × 900 | 232 px | 340 px | 820 px | 659 px |

At tablet width, the folder rail and note list consume part of the horizontal space so the editor stays usable beside the list. The landscape writing width was adjusted from 616 px to 639 px after independent review. Long titles are fully visible and editable at each measured width; the title textarea recalculates its height after orientation/viewport changes. The browser scenario also checks focus, caret, draft text, and body scroll across the four viewports.

Screenshots and raw geometry: [390 × 844](RESPONSIVE-UI-PRODUCTION-20261029/responsive-390x844.png), [744 × 1133](RESPONSIVE-UI-PRODUCTION-20261029/responsive-744x1133.png), [1133 × 744](RESPONSIVE-UI-PRODUCTION-20261029/responsive-1133x744.png), [1440 × 900](RESPONSIVE-UI-PRODUCTION-20261029/responsive-1440x900.png), and [layout measurements JSON](RESPONSIVE-UI-PRODUCTION-20261029/layout-measurements.json).

## Checks

- `npm run check:source`: passed; 48 source modules, syntax/import checks passed.
- `npm test`: passed; 191/191 offline tests.
- `npm run test:browser`: passed; 15/15 Chromium headless scenarios using the actual app source and simulated WebDAV/API fixture only. It covers drawer/share/menu, full title, long text and code lines, horizontal overflow, 44 px controls, search/navigation, saving/retry/error, offline draft recovery, two-tab conflict, trash/restore, and view-only sharing.
- `node --check public/app.js`, `node --check scripts/browser-smoke.mjs`, and `git diff --check`: passed.

The NAS runner has Node 22.23.4 while `package.json` requires Node 24; the local checks above passed under Node 22. Vercel project metadata reports Node 24.x for builds.

## Gemini independent review

Two rounds used only a filtered summary and aggregate viewport measurements; no repository diff, Notes content, credentials, or session was sent.

1. Round one flagged the 616 px landscape writing area as narrower than portrait’s 640 px. The tablet rail padding was reduced and the full browser suite remeasured it at 639 px. It also called out native Safari/iPad keyboard validation as an untested risk; this remains a manual verification item. Its low-severity concern about a possible drawer transition delay was not reproduced: drawer closure is synchronous and has no animation.
2. Round two raised the identical 245 px title height at 1133 and 1440, and the similar landscape/portrait writing widths. The equal height is plausible from the responsive type scale (34 px at 1133, capped at 36 px at 1440) and different line wrapping; the textarea has no fixed maximum height and recalculates from `scrollHeight`. The similar ~640 px writing widths are intentional: landscape keeps the folder rail and list visible while meeting the measured writing-width target. No further actionable UI issue was established.

## Production and remaining verification

Before deployment, the canonical project was `hunghvt-notes` (`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`). Its READY Production deployment was `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`, source `480b54605c8ed8d599af486bab7817456fd6afae`, on both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app`. Vercel project/repository inventory showed no linked Git project; `AGENTS.md` and `docs/OPERATIONS.md` also state main pushes do not auto-deploy.

### Release evidence — 2026-10-29

- PR [#25](https://github.com/hunghvt-cyber/web-notes/pull/25) was squash-merged to `main`. The merge/release source is `f7b0544194d0f71f66307d35e5eb35d5bf2c853b`; a fetch confirmed remote `main` matched this SHA before deployment. Branch CI run [#439](https://github.com/hunghvt-cyber/web-notes/actions/runs/40821191715) passed its source/test and browser jobs. Earlier run #438 exposed a Search-from-Trash state issue; the follow-up `b79e1c34b1c2aba79b3a739d2ff11b6582e167bb` fixed it, and the 15-scenario browser suite passed locally and in CI.
- No Vercel Git connection was present, so the `main` push did not trigger an unplanned build. Production was explicitly built from `main` at `f7b0544194d0f71f66307d35e5eb35d5bf2c853b` as deployment `dpl_7Y9AiUP9uutwVXedkypQ6se9auec` (`hunghvt-notes-1p7084jke-hunghvt.vercel.app`); Vercel reports `READY`, target `production`, and no alias error. The primary `hunghvt-notes.vercel.app` and existing secondary `hunghvt-notes-hunghvt.vercel.app` aliases both now resolve to this deployment. The recorded rollback target remains `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM` (source `480b54605c8ed8d599af486bab7817456fd6afae`).
- At 2026-10-29 05:06 UTC, read-only requests through `https://hunghvt-notes.vercel.app` returned HTTP 200 for `/`, `/app.css`, `/app.js`, and `/api/app?route=health`. Health reported `configured=true`, `production=true`, backend `firestore-native-v1`, vault `notes-production`, `firestoreRead=PASS`, and `vaultInitialized=true`. No authentication, note creation, edit, or delete request was made.
- The protected deployment fetch created a temporary Vercel share bypass for verification; its exact secret was revoked immediately after checks, and readback showed no remaining protection bypass on the primary alias.
- The two filtered Gemini rounds are recorded above. After those capped review rounds, CI surfaced the Search-from-Trash bug, which was corrected and covered by the successful final browser run; no Notes content, credentials, session, or repository diff was sent to Gemini. The production report commit is docs-only and does not change deployed application code.

The Chromium screenshots are not Safari, physical iPad/iPhone, native keyboard, or live Firestore verification. A person should still open the deployed URL on an iPhone/iPad, type in a long title and note, rotate while the caret is in each field, show/hide the keyboard, and try safe-area scrolling, drawer/menu taps, search, trash and restore. No real Notes were used by the browser fixture.

## Notes list, actions, and backup menu polish — 2026-10-29

Work started from fetched remote `main` `0e3ee81759fb340b5e675aa5034d1e115b6eb326` in a clean dedicated worktree. The previous Production checkpoint before this change was deployment `dpl_7Y9AiUP9uutwVXedkypQ6se9auec`, READY from app SHA `f7b0544194d0f71f66307d35e5eb35d5bf2c853b`; both Production aliases pointed to it. This is the recorded rollback target.

The global button surface is lighter. Fine-pointer desktop buttons are 36 px compact controls; coarse-pointer phone/tablet controls retain 44 px minimum targets. Primary creation/save actions keep their emphasis. The note list now has a light gray field with individual white, thin-bordered, compact rectangular cards; title, preview, and metadata have distinct hierarchy. Hover/focus, active-note, and multi-select states use separate colors/borders. Rendering preserves list scroll offset, focused card, and selection set. The current app only defines a light theme; browser fixture checks both light and dark OS preferences and confirms card/list backgrounds remain distinct.

### Backup menu root cause and fix

At 1440×900, before the fix, Chromium measured the menu at x=−11.34, y=198, size 310×112 px, outside the viewport. Its `position:absolute; right:0` was aligned to the workspace action `<details>` at x=254.66, so a panel wider than the control extended left past the viewport. It was also inside `#workspace` with `overflow:hidden`. See [baseline measurements](RESPONSIVE-UI-PRODUCTION-20261029/action-menu-baseline.json), [before list](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-before-1440x900.png), and [before menu](RESPONSIVE-UI-PRODUCTION-20261029/action-menu-before-1440x900.png).

All action panels now portal to `body`. The anchor’s current bounding box and visual viewport determine left/right and above/below placement. Width and height are capped to available viewport space; long panels scroll internally. Position refreshes on window/visual viewport resize and captured container scroll. Outside pointer closes the panel, Escape closes and returns focus, and keyboard activation/Tab can enter the panel. The backup API, filename/data serialization and snapshot scope were not changed. The synthetic backup action still downloads the expected JSON filename and does not mutate fixture Notes.

After-fix evidence: [menu screenshot](RESPONSIVE-UI-PRODUCTION-20261029/responsive-actions-after-1440x900.png) and [menu bounds at viewport edges, scroll, and zoom](RESPONSIVE-UI-PRODUCTION-20261029/action-menu-measurements.json). Browser assertions confirmed every panel edge stayed inside both the 1152×720 and 960×600 CSS layout viewports (the effective viewport widths at 125% and 150% zoom from 1440×900), and the 1440×900 viewport at CSS zoom 100%, 125%, and 150%, including an anchor at the bottom-right. Menu size grew in rendered pixels under CSS zoom and stayed inside the viewport. The panel also followed the anchor after a scroll event. The runner emulates these zoom conditions; it does not change native Chromium browser zoom.

### Responsive evidence and checks

List screenshots before/after: [before, 1440×900](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-before-1440x900.png); after at [390×844](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-after-390x844.png), [744×1133](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-after-744x1133.png), [1133×744](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-after-1133x744.png), [1280×720](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-after-1280x720.png), [1440×900](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-after-1440x900.png), and [1920×1080](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-after-1920x1080.png). Touch-emulated phone/tablet captures are also saved for [390×844](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-touch-390x844.png), [744×1133](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-touch-744x1133.png), and [1133×744](RESPONSIVE-UI-PRODUCTION-20261029/notes-list-touch-1133x744.png). Editor/textarea widths for all six viewports are in [layout measurements](RESPONSIVE-UI-PRODUCTION-20261029/layout-measurements.json).

- `npm run check:source`: PASS, 48 JS modules.
- `npm test`: PASS, 191/191 offline tests.
- `npm run test:browser`: PASS, 18/18 Chromium headless scenarios against the real app source with synthetic API/WebDAV fixtures. Coverage includes menu bounding boxes, outside/Escape/focus, container scroll, 125%/150% zoom, backup download, light/dark preference contrast, 44 px touch targets, list scroll/selection retention, opening and creating notes, and the existing save/error/draft/share/trash flows.
- Coarse-pointer target bounds are recorded in [touch target measurements](RESPONSIVE-UI-PRODUCTION-20261029/touch-target-measurements.json): minimum visible target is 44×44 px at 390×844, 744×1133, and 1133×744.
- `node --check public/app.js`, `node --check scripts/browser-smoke.mjs`, and `git diff --check`: PASS.

The runner used Node 22.23.4 although the package requests Node 24.x; the configured Vercel builder is Node 24.x. Gemini review was unavailable because this session has no Gemini review tool/connector. No source diff, Notes, credential, or session was sent to another service. Chromium’s CSS zoom and touch emulation are not native browser-zoom/device validation. Safari, physical device, and real keyboard interactions remain untested; the existing manual iPhone/iPad checklist above still applies. No real Notes or production backup was used in browser testing.

## Production release and post-deploy verification — 2026-10-29

PR [#26](https://github.com/hunghvt-cyber/web-notes/pull/26) was squash-merged after CI run [#443](https://github.com/hunghvt-cyber/web-notes/actions/runs/40830938919) passed both `test` and `browser`. The merged `main` source is commit `53cd7ddc05d64139983caa050b098ea001caeeb3`. The first browser CI attempt exposed a timing race in the title-height assertion; the assertion now polls until responsive layout settles, and the rerun passed. Final local checks: source check 48 modules, offline 191/191, Chromium browser suite 18/18.

Production before change was READY deployment `dpl_7Y9AiUP9uutwVXedkypQ6se9auec`, source `f7b0544194d0f71f66307d35e5eb35d5bf2c853b`; it remains the rollback target. Explicit Vercel production deployment `dpl_Gu1BG8sCAYJe2Y633TjAhkSHhqMZ` from merged SHA `53cd7ddc05d64139983caa050b098ea001caeeb3` reached READY. Both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app` alias it. Read-only requests to app HTML, `/app.css`, `/app.js`, and `/api/app?route=health` returned HTTP 200; health reports `firestore-native-v1` and `firestoreRead: PASS`. No production Notes were edited or deleted.

Before/after card screenshots and after-fix responsive captures are linked in the evidence section above. Browser verification used Chromium headless, synthetic API/WebDAV fixtures and touch emulation. Safari, native browser zoom, actual iPhone/iPad devices, and hardware keyboard/visual viewport behavior were not tested. Gemini review was unavailable in this session because there is no Gemini tool/connector; no Notes, credentials, session, or diff was sent to Gemini. Manual follow-up: open an existing long-title note on a physical iPhone/iPad, rotate while editing, type with the on-screen/hardware keyboard, scroll a long/code note, open/close the folder drawer and action menu, and verify caret/focus/scroll remain stable.
