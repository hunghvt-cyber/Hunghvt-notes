# Production paste hang triage and fix — 2026-10-29

## Finding

The reported “Aw, Snap” crash was **not reproduced**. A synthetic 1 MB paste
did reproduce a severe Chromium UI stall, followed by the app's expected
`NOTE_TOO_LARGE` response. The evidence does not establish that the reported
browser crash has the same cause.

The 500 KB plain-text paste stalled for 10.7–12.1 seconds through the native
textarea paste path. The same behavior was measured with the responsive
production assets, the pre-responsive worktree, and the application input
listener suppressed (about 10.4 seconds). This rules out the responsive layout
change as the regression and does not implicate Firestore. The app uses a
plain-text/Markdown `textarea`; there is no Markdown preview or code highlighter
that reprocesses its contents on each input. Most of the paste delay was in
Chromium's native textarea/clipboard handling and text layout, rather than app
JavaScript. In the final 500 KB run, CDP reported 56 ms of script time over
5.59 seconds of task time, with 11 layouts and 31 style recalculations.

There was also avoidable application work around editing: each input cloned
primitive text through JSON serialization; each draft snapshot cloned the
whole note several times; and queued IndexedDB writes could retain snapshots
for successive keystrokes. The fix removes redundant primitive/full-note
copies and coalesces an in-flight draft write to the latest version. The
native paste event is intercepted when `text/plain` is available and that
plain text is inserted once with `setRangeText`, then one normal `input` event
feeds the existing draft and autosave path. Clipboard data without
`text/plain` remains on the browser's normal path. The editor's supported data
is plain Markdown text; Word/Excel HTML is not a supported rich-text model.

At 500 KB the application paste handler now returns in 859 ms, with exact
content saved and reopened. The next typed character still takes about 4.2
seconds in Chromium. That residual delay also appeared on the original
textarea path; it is a browser layout limitation still visible with very
large contents, and is not claimed fixed here. The current result is a major
reduction in paste blocking, not a claim that arbitrarily large notes remain
instantaneous.

The intercepted `setRangeText` edit is not recorded by Chromium's own undo
stack. The app now retains a bounded inverse for the latest five paste edits
and handles keyboard Ctrl/Cmd+Z plus `beforeinput` `historyUndo` gestures. It
restores a paste after undoing later typing first. Regression checks cover
large paste, subsequent typing, multiple undo steps, and a synthetic
`beforeinput` undo event. This browser-level test does not certify every
mobile operating system's software undo UI.

## Synthetic measurements

Full per-case browser-local metrics are in
[paste-performance.json](RESPONSIVE-UI-PRODUCTION-20261029/paste-performance.json).
Tests used actual Chromium clipboard APIs and synthetic API/storage fixtures;
no production Notes or user clipboard was read or changed.

| Clipboard content | Bytes (plain / HTML) | Paste response | Result |
| --- | ---: | ---: | --- |
| Plain multiline | 10 KB / — | 39 ms | saved, edited, reopened, exact hash |
| Plain multiline | 100 KB / — | 213 ms | saved, edited, reopened, exact hash |
| Code, single long line | 100 KB / — | 105 ms | saved, edited, reopened, exact hash |
| Markdown | 100 KB / — | 701 ms | saved, edited, reopened, exact hash |
| Word/Excel-style clipboard | 10 KB / 67 KB | 64 ms | plain text/TSV fallback preserved |
| Word/Excel-style clipboard | 100 KB / 672 KB | 438 ms | plain text/TSV fallback preserved |
| Plain multiline | 500 KB / — | 859 ms | save/reopen exact; next character 4.16 s |
| Plain multiline | 1 MB / — | not separately timed | actual synthetic store returned 413; draft reopened with exact length/hash |

The pre-change 500 KB native path took 10.686 seconds in the production
assets and 12.083 seconds in the pre-responsive worktree. The 1 MB native
baseline took 41.3 seconds before returning; it also received 413 at the
existing 1,000,000 encoded-byte storage limit. The fixed-path 1 MB case
completed paste, save failure, reload, and draft restoration in 9.129 seconds
end-to-end. Those are headless Chromium/NAS measurements; machine load affects
the timings. No renderer crash occurred during the tests.

## Change and review

- `public/app.js`: one-shot plain clipboard insertion, bounded paste undo,
  and clearer 413 text that confirms the local draft is retained.
- `public/sync.js`: avoid JSON cloning primitive text, avoid repeated whole
  note snapshots, and coalesce concurrent IndexedDB draft writes without
  dropping the latest version.
- `test/sync.test.mjs`: 500 KB rapid-edit coalescing and exact latest-draft
  regression test.
- `scripts/browser-smoke.mjs`: real clipboard matrix, save/reopen hashes,
  post-paste editing/undo, and actual 1 MB synthetic-store 413 recovery.

Gemini was called through the executable NAS wrapper for two filtered
reviews; it received code diff and aggregate synthetic timings only, no
production Notes, raw clipboard, session, or credentials. Review 1 suggested
that synchronous clone cost explained the full 500 KB stall. Codex rejected
that as the primary explanation because the native stall remained with the
app input listener suppressed and script duration was small; clone/draft work
was retained as a secondary improvement. Review 2 flagged undo behavior and
asked whether rich HTML was intentionally discarded. Codex verified that the
textarea stores Markdown/plain text and has no rich HTML editing model, so
plain clipboard insertion preserves the supported content. The undo point was
accepted: the `beforeinput` route was added and the targeted browser regression
passed. Gemini's mobile suggestion is covered at the event-contract level,
but a real iOS/Android software keyboard was not available for testing.

Verification on Chromium headless with synthetic API/storage:

- `npm run check:source`: PASS, 48 source modules.
- `npm test`: PASS, 192/192 offline tests.
- `node scripts/browser-smoke.mjs`: PASS, 21/21 browser scenarios.
- `git diff --check`: PASS.
- 500 KB paste, post-paste editing, hash-verified save/reopen: PASS.
- 1 MB paste, actual synthetic-store 413, reload and draft restore: PASS.
- 390x844, 744x1133, 1133x744, 1280x720, 1440x900 and 1920x1080 app
  browser scenarios: PASS (included in 21/21 suite).

These are Chromium desktop/headless checks only. Safari, actual phone/tablet
hardware, iPad keyboard/undo controls, and low-memory browser behavior remain
unverified. Suggested manual checks: paste a 100–500 KB plain/Word/Excel
sample on a phone and iPad; type and undo several characters then undo the
paste; rotate the device while editing; reload after a simulated/offline save
failure and restore the device draft. Avoid using a real note for this check.

## Production record

Before this change, Vercel project `hunghvt-notes`
(`prj_c4sEp6nB4msWTsPiGoALSuVutVTK`, team
`team_gCsQcRiaCja0GafKj8JZLINI`) reported READY deployment
`dpl_EqVyaCg6bsmuHuqFKvXRgYavceGf` from `3398d29deff5b32fad2f14b4349bc8a622bf2695`.
`https://hunghvt-notes.vercel.app` pointed to it; read-only HTML, CSS, JS and
health requests returned 200, and health reported Firestore read PASS. Vercel
readback also showed `hunghvt-notes-hunghvt.vercel.app` still pointing to
`dpl_7Y9AiUP9uutwVXedkypQ6se9auec` (responsive release); that secondary alias
was out of sync with the current primary before this work.

## Production release

The fix was merged to canonical `main` in PR [#28](https://github.com/hunghvt-cyber/web-notes/pull/28),
source commit `96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a` (tree
`61ced1cff6f7d0f302162eab649f2f43f1b19e98`). CI run
[#449](https://github.com/hunghvt-cyber/web-notes/actions/runs/40841393285)
passed both offline/source tests and browser tests. Gemini's two filtered
reviews and Codex's accepted/rejected findings are summarized above. No
production Notes, clipboard, session, or credentials were provided to Gemini.

Before the release, primary alias `hunghvt-notes.vercel.app` pointed to
READY deployment `dpl_EqVyaCg6bsmuHuqFKvXRgYavceGf` (source
`3398d29deff5b32fad2f14b4349bc8a622bf2695`). The secondary alias
`hunghvt-notes-hunghvt.vercel.app` pointed to older deployment
`dpl_7Y9AiUP9uutwVXedkypQ6se9auec` (source
`f7b0544194d0f71f66307d35e5eb35d5bf2c853b`).

Vercel deployment `dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst`
(`hunghvt-notes-3a4t8znpu-hunghvt.vercel.app`) was explicitly created from
the merged `main` SHA above and reached `READY` at 2026-10-29 08:24 UTC.
Both `hunghvt-notes.vercel.app` and `hunghvt-notes-hunghvt.vercel.app` now
resolve to that deployment. The secondary alias returns a Vercel protection
page to anonymous HTTP clients; authenticated Vercel fetch returned the new
app asset from the alias. This is a protection response, not an application
health failure.

Read-only checks through the primary alias returned HTTP 200 for `/`,
`/app.css`, `/app.js`, `/sync.js`, and `/api/app?route=health`. The served
`app.js` contains the one-shot `insertFromPaste` handler; `sync.js` contains
the in-flight/coalesced IndexedDB draft writer. Health reported
`firestore-native-v1`, `production=true`, and `firestoreRead=PASS`. No note
was read, created, or changed by these checks.

Rollback: reassign the primary alias to
`dpl_EqVyaCg6bsmuHuqFKvXRgYavceGf`; if restoring the exact pre-release alias
state, also reassign the secondary alias to
`dpl_7Y9AiUP9uutwVXedkypQ6se9auec`. Do not delete either deployment.

The user-visible “Aw, Snap” crash itself was not reproduced, and continued
editing immediately after a 500 KB paste remains slow (~4.2 s) in headless
Chromium. The change materially reduces the reproduced paste stall but does
not prove the crash's unique cause or eliminate all large-textarea reflow
cost. Safari, low-memory conditions, physical iOS/Android devices, and real
virtual keyboards remain untested.
