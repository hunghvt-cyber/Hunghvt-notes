# Frontend cache-first split from PR #34 — 30/10/2026

## Scope and decision

This candidate is a narrow frontend-only subset based on `main` `d735659d1457f5aa2144ed45fb1aaa9ca07ec495` (tree `2a6c03edd0f7e845a0e4f1a1dc07530777bbd67a`). Production source `7991b8045f36835dc8e69f829c5399a4ac31d4ec` has identical application/API/backend/auth/config code to that main commit; the diff between them is documentation only.

The change touches `public/app.js`, `public/cache.js`, and synthetic browser/unit tests. It uses the already deployed notes GET contract, including the existing `revision` parameter for background verification. It does not change API routes, Firestore repository, save/CAS/clientOpId, auth, environment configuration, or schema. `git diff --name-only origin/main` confirms no API/backend/auth/config path changed.

This split intentionally excludes viewport prefetch, the `prefetch=1`/`history=0|1` API extensions, lazy history, and the longer preview summary from PR #34. The current API returns note history on a regular content read, so viewport prefetch cannot safely claim history avoidance, server byte bounds, or lazy-history behavior without backend changes. Keep those pieces in draft PR #34 and keep its cloud qualification gate intact.

## User-visible behavior

- After the existing auth endpoint confirms a valid account/scope, a validated IndexedDB list may paint while the existing notes list request refreshes it.
- A note with server-confirmed cached content and a matching cached list revision paints into the editor immediately. The existing `revision` request verifies it in the background; a changed revision can replace content only if the same note is still selected and the editor is clean.
- A short 80 ms coalescing delay skips revision checks for notes quickly replaced during a tap sequence. Only the current selection starts its background check. A direct background GET bypasses the foreground request lane only for this revision check, leaving saves and foreground reads on the existing prioritized lane.
- Offline and failed verification leave the cached note visibly unverified. A transport or deferred-background error is not treated as a 401. Logout and confirmed session expiry clear this account-scoped cache and fence old responses.
- Cache errors, quota errors, and malformed rows do not block opening or saving. Drafts remain RAM-only until ACK; the old draft database is not read, moved, or deleted.

There is no prefetch in this split. New or uncached notes use the existing foreground GET. The existing full-history UI remains unchanged.

## Verification

- Production/main code comparison: only docs differ between deployed source commit `7991b8045f36835dc8e69f829c5399a4ac31d4ec` and `main`; candidate contains no backend/API/auth/config diff.
- `npm run check:source`: PASS, 49 files.
- `npm test`: PASS, 191/191.
- `npm run test:browser`: PASS, 30/30 on the final candidate worktree, synthetic API/Firestore-compatible fixture. Coverage includes cache fast paint, delayed revision and dirty editor/IME, rapid selection and late response, stale revision, logout/expiry, offline status, quota/corrupt cache, save retry/ACK, conflict, paste/undo, and six responsive viewports. This is not Vercel OIDC evidence.
- `git diff --check`: PASS.
- No real Notes, history, trash, share, or session were read or changed. No cloud resource, IAM/WIF, Vercel env, deployment, alias, or billing setting was changed by the candidate build/test.

## Main vs candidate synthetic benchmark

Same NAS Chromium, same fixture/API handler and generated dataset (20 small notes, one 128 KiB note, five synthetic revisions each), 20 samples per case. “Open” ends when the editor field has the expected usable content; revalidation is issued in the background and measured separately in the JSON. Network/request timings and fixture server timings are in [filtered measurements](PR35-FRONTEND-CACHE-20261030.json). These are not device or Vercel runtime measurements.

| Flow | Main p50/p95 ms | Candidate p50/p95 ms | Requests main→candidate | Response bytes main→candidate | Errors |
|---|---:|---:|---:|---:|---:|
| Navigation, cold cache | 325.3 / 358.5 | 316.3 / 380.8 | 60 → 40 | 103,660 → 102,040 | 0 → 0 |
| Navigation, warm cache | 271.3 / 335.2 | 266.9 / 314.9 | 60 → 40 | 103,660 → 102,040 | 0 → 0 |
| Open small note, cold session | 191.2 / 274.7 | 209.4 / 246.8 | 20 → 20 | 17,940 → 17,940 | 0 → 0 |
| Open 128 KiB note after cache warm | 233.4 / 305.3 | 195.7 / 224.0 | 20 → 20 | 2,625,940 → 1,440 | 0 → 0 |
| Open small note after reload (cached) | 151.0 / 208.0 | 139.5 / 161.1 | 20 → 20 | 17,940 → 17,940 | 0 → 0 |
| Type during 120 ms delayed revision reads | 70.3 / 142.1 | 72.1 / 93.7 | 60 → 60 | 22,312 → 38,740 | 0 → 0 |
| Rapid switch across 3 notes, 120 ms delayed reads | 344.6 / 460.2 | 402.0 / 474.7 | 58 → 22 | 4,176 → 19,986 | 0 → 0 |

The cached-note p95 target of 100 ms is **not met** (161.1 ms). Warm-list p95 is also slightly above its 300 ms target (314.9 ms). The typing p95 is below 100 ms in this fixture. Rapid switching has fewer content reads but remains slightly slower in p95 and slower in p50 in this run; do not claim an overall acceleration from these headless results. These deltas are small enough that device evaluation is still necessary.

## Gemini review

Wrapper `/home/admin/bin/gemini-task --help` succeeded. Keys 4 and 5 used `gemini-3.5-flash-lite`; prompts contained only source diff, synthetic fixture metrics, and requirements—no real Notes, session, credential, token, or secret.

- **Key 4 — code/cache/race review:** no evidence-backed blocker found. Accepted its positive checks on scope isolation, stale-selection/dirty-editor guards, logout fencing, and ACK-only content. Rejected its hypothetical synchronous serializer/quota exception concern: `cachedNoteSize` catches serialization errors, `cache.put` failures are caught, and the synthetic quota/cache-failure browser test passes. Its switch-away-then-back race was speculative and covered by current active-session, dirty/version, request-sequence guards and browser race tests.
- **Key 5 — requirement/metrics review:** accepted its HOLD recommendation until full browser and CI evidence is recorded. Accepted that cached note p95 161.1 ms misses the 100 ms target and that no device-performance claim is warranted. It found no new cloud gate for this split because API/backend/auth/config source is unchanged; the synthetic browser/API fixture is not called Vercel OIDC proof.

## Release status and rollback

At authoring time this is a separate PR candidate from `main`; no merge or deployment has occurred. Keep Production on `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu` until CI and the final release verification pass. Since the existing Vercel project is not Git-connected, merging `main` does not deploy by itself. Before any deployment, confirm project plan/free usage, exact source SHA/tree, auto-alias behavior, and current three-alias readback. Do not link billing, enable billing, or start a paid trial. If deployed, record the exact new deployment and all three aliases; rollback to `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`, reassigning each alias explicitly if needed.

No S25 Ultra or iPad device test has been performed. User acceptance of the UX remains outstanding; do not claim “8/10 Google Keep”.
