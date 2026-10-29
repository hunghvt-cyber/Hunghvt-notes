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

Before deployment, the canonical project is `hunghvt-notes` (`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`). Its READY Production deployment was `dpl_4xyMEmQUbR1m8tfuNjudzYu23LBM`, source `480b54605c8ed8d599af486bab7817456fd6afae`, on both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app`. Vercel project/repository inventory showed no linked Git project; `AGENTS.md` and `docs/OPERATIONS.md` also state main pushes do not auto-deploy. Production deployment and alias state will be recorded here after the verified release.

The Chromium screenshots are not Safari, physical iPad/iPhone, native keyboard, or live Firestore verification. A person should still open the deployed URL on an iPhone/iPad, type in a long title and note, rotate while the caret is in each field, show/hide the keyboard, and try safe-area scrolling, drawer/menu taps, search, trash and restore. No real Notes were used by the browser fixture.
