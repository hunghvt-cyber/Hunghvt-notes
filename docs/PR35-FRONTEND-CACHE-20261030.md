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
| Rapid switch across 20 rotating notes, 120 ms delayed reads (non-equivalent cache residency) | 344.6 / 460.2 | 402.0 / 474.7 | 58 → 22 | 4,176 → 19,986 | 0 → 0 |

The cached-note p95 target of 100 ms is **not met** (161.1 ms). Warm-list p95 is also slightly above its 300 ms target (314.9 ms). The typing p95 is below 100 ms in this fixture. The initial rotating-note switch row is not comparable because of unequal cache residency; see the controlled follow-up below. Do not claim an overall Production acceleration from headless results. Device evaluation is still necessary.

### Controlled three-note switch profile — follow-up

The previous quick-switch row was not a fair cache-residency comparison: its 20-note rotation exceeded the candidate's 12-note/1 MiB cache bound, while main's in-memory content cache had no equivalent bound. That run also measured three sequential Playwright click calls, not the final click-to-editor response. It does not establish a candidate regression.

A single paired diagnostic warmed exactly the same three synthetic notes and switched only among those three for 20 samples. Auth was already valid; the interval starts at note clicks. Both sources used the same API handler fixture and 120 ms note-read delay. The final editor content assignment and two animation frames were timestamped independently from revision fetch completion:

| Metric | Main p50/p95 | Candidate p50/p95 |
|---|---:|---:|
| Last click → title assignment | 0 / 1 ms | 1 / 2 ms |
| Last click → editor paint (two animation frames) | 30 / 43 ms | 20 / 36 ms |
| First click → final paint across three selections | 275 / 331 ms | 200 / 254 ms |
| Three sequential Playwright clicks (harness timing) | 346 / 506 ms | 267 / 355 ms |
| Revision GETs across 20 bursts | 60 | 36 |
| Revision GET duration p50/p95 | 147 / 167 ms | 142 / 152 ms |
| Full content GETs / errors / observed long tasks | 0 / 0 / 2 | 0 / 0 / 0 |

This controlled fixture shows no material switch regression and a modest paint/request-count benefit; it is not a device or Production speed claim. It supports retaining PR #35 as a release candidate. The separate 100 ms cached-note and 300 ms warm-list goals remain unmet and are not claimed as achieved. Filtered profile evidence: [switch profile JSON](PR35-SWITCH-PROFILE-20261030.json).

## Gemini review

Wrapper `/home/admin/bin/gemini-task --help` succeeded. Keys 4 and 5 used `gemini-3.5-flash-lite`; prompts contained only source diff, synthetic fixture metrics, and requirements—no real Notes, session, credential, token, or secret.

- **Key 4 — code/cache/race review:** no evidence-backed blocker found. Accepted its positive checks on scope isolation, stale-selection/dirty-editor guards, logout fencing, and ACK-only content. Rejected its hypothetical synchronous serializer/quota exception concern: `cachedNoteSize` catches serialization errors, `cache.put` failures are caught, and the synthetic quota/cache-failure browser test passes. Its switch-away-then-back race was speculative and covered by current active-session, dirty/version, request-sequence guards and browser race tests.
- **Key 5 — requirement/metrics review:** accepted its HOLD recommendation until full browser and CI evidence is recorded. Accepted that cached note p95 161.1 ms misses the 100 ms target and that no device-performance claim is warranted. It found no new cloud gate for this split because API/backend/auth/config source is unchanged; the synthetic browser/API fixture is not called Vercel OIDC proof.
- **Key 5 follow-up — corrected switch profile:** accepted its finding that the earlier regression was confounded by unequal cache residency and macro timing, and its recommendation to retain this frontend candidate. The follow-up review agreed the click/paint and revision metrics are separated. Its stale-cache interaction caveat is addressed by existing revision guards plus CAS on save: editing a stale cached revision cannot overwrite a concurrent server revision; the server returns conflict and the in-session edit remains. No code changed, so Key 4 was not repeated.

## Release status and rollback

CI run `40975850784` completed successfully for exact PR head `05d21af625fd9159ac2a6c7ddc1d41fcbe10d185`: source/unit and browser jobs both passed. The PR remains separate from `main`; no merge or deployment has occurred. Production remains on `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`.

Production deployment is held on one cost-verification blocker: the available Vercel project/team read APIs expose neither plan nor remaining no-cost entitlement; the billing-charges API returned `costs_not_found`. No deployment was attempted because that cannot establish that this release is free. Do not link billing, enable billing, or start a paid trial. The free-only path is a read-only confirmation of the existing plan and available free entitlement by the account owner, with no account change; then recheck exact source SHA/tree, auto-alias behavior, and all three aliases before deciding promotion. If deployed, record the exact deployment and aliases; rollback to `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`, reassigning each alias explicitly if needed.

No S25 Ultra or iPad device test has been performed. User acceptance of the UX remains outstanding; do not claim “8/10 Google Keep”.
