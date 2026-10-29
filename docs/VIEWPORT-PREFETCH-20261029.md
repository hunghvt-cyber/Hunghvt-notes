# Viewport prefetch/cache-first follow-up — 2026-10-29

## Candidate and release status

PR #34 remains a draft. Candidate code is not deployed. Production aliases remain on the existing deployment. Do not promote this candidate: Vercel OIDC note/history qualification is unavailable, and the full benchmark does not meet the list and typing p95 targets consistently.

## User-visible changes

- Cards show up to 200 characters from the authorized note metadata/list response. No separate request is made per note for a preview.
- Once the authenticated list renders, an `IntersectionObserver` queues content near the visible area and sorts by scroll direction. It allows one request at a time, delays the first request up to 80 ms so immediate scrolling can change priority, caps starts at 40 and prefetch response data at 768 KiB per session, skips bodies over 64 KiB, and never fetches history. The acknowledged-content cache remains capped at 12 notes/1 MiB total/256 KiB per note.
- Clicking a note with a suitable prefetch in progress adopts that request. Note open and save are not queued behind prefetch; off-screen work is canceled. Dirty editing pauses and cancels prefetch. A late response must still match the open sequence, active session and note ID before changing the editor.
- Cache contains only server-confirmed content and remains scoped to the authenticated account. Unsaved edits remain only in RAM. The legacy draft database is neither opened, migrated nor deleted.

## Firestore preview cost

The 200-character preview comes from the existing authorized metadata/list query. This adds bytes to metadata and list responses and to future note metadata writes, but it does not add a Firestore document read or a separate per-note content request. Existing stored summaries are not bulk migrated; they can remain 100 characters until that note is saved again. A repository test checks the metadata query and absence of per-note body reads. No real Notes were inspected or changed.

## Before/after measurements

Chromium headless on NAS, 20 samples per case, 20 synthetic small notes with five revisions each and one synthetic 128 KiB note, served by a local Firestore-compatible in-memory fixture. Main used the pre-viewport frontend and prefetch disabled; candidate used the final local source. Browser request/response bytes and in-handler time are separated from action wall time. For the 20-sample empirical p95, the reported statistic is the maximum sample and is sensitive to outliers. None of these figures represents Vercel/Production or a physical device.

| Case | Main p50/p95 ms | Candidate p50/p95 ms | Notes |
| --- | ---: | ---: | --- |
| Navigate to list, cold cache | 341.6 / 413.9 | 305.0 / 345.8 | Candidate used 35 prefetch requests and 9,680 prefetch response bytes across the 20 list-only samples. |
| Navigate to list, warm cache | 283.1 / 332.8 | 275.5 / 332.8 | Candidate used 26 prefetch requests and 4,325 prefetch bytes. Warm p95 target 300 ms was not met. |
| Scroll to last card/preview | 109.0 / 131.6 | 113.3 / 136.1 | Candidate used 28 prefetch responses/3,801 bytes and canceled 3 requests. Another standalone candidate run measured 121.5/157.5 ms. Scroll p95 is close to main, not faster in the matched run. |
| Open an uncached small note | 217.7 / 265.4 | 195.8 / 240.9 with candidate prefetch disabled | The full candidate run with prefetch enabled was 189.4/216.0 ms, but 13 prefetch requests also completed across those samples. |
| Open small note after reload/cache | 150.7 / 186.5 | 120.8 / 295.1 | Candidate p95 is noisy and misses the 100 ms broad action target. |
| Type while content revalidation is delayed 120 ms | 73.2 / 85.2 | 74.6 / 403.0 | Full candidate p95 misses the 100 ms target; tail variance is material. |
| Rapidly switch among three cached notes with 120 ms delayed reads | 340.0 / 778.5 | 268.6 / 391.1 | Main included a large outlier; earlier controlled candidate prefetch-on/off runs were similar. Do not attribute the candidate result to prefetch or claim a stable percentage improvement. |

A separate 20-sample candidate scenario opened a note after its prefetch had completed. Click-to-editor text was 10.2/14.1 ms p50/p95 and click-to-two-frame-paint was 22.6/29.0 ms. Broad action wall time was 108.4/127.9 ms. For a click during the same note's held in-flight prefetch, click-to-editor text was 43.6/52.5 ms and click-to-paint was 60.3/74.5 ms; broad action wall time was 131.8/154.4 ms. The in-flight test adopted the content request; unrelated prefetch work was canceled. Main has no equivalent prefetched state.

“Prefetch not used” is counted within a measured interaction window: the list-only and scroll cases had no note click during that window. Their speculative body traffic is reported above; a user could still open those notes later in the session, so these figures do not claim lifetime-unused bytes. Across all measured runs there were zero HTTP/request failures; expected cancellations are counted separately from failures. The JSON report includes browser and server request counts/bytes, handler timing and cancellations.

The large-note comparison is not an equivalent open state: main fetched the 128 KiB note after reload (2,625,940 response bytes over 20 opens); candidate already had acknowledged content cached and performed revision validation only (1,440 bytes). Treat this as a cache-hit byte observation, not a like-for-like cold-open speedup or Firestore read-cost reduction.

## Tests and Gemini reviews

Source check passed. Offline suite passed 193/193. The full Chromium synthetic browser suite passed 33/33 after the final 80 ms scheduler change. It covers bounded viewport prefetch, click adoption, large-note skip, lazy history, cache-first/revision updates, dirty editor preservation, stale response selection, logout/transport separation, offline stale cache, quota/corrupt cache, no legacy draft access, retry/idempotency, two-tab CAS conflict, paste/undo and Vietnamese IME. The simulated retry/load harness passed; it is not live service-capacity evidence. Offline-to-online prefetch queue resume has no dedicated integration test.

The implementation commit is `f4408dcc285484401773af100302d5050519b9ec`, tree `8cd0526e79265507f3785fd0948df1dc5055c34b`. The final handoff commit adds only CI/deployment documentation: PR head `c850f4ce070631569c71b003c4c2d12af877e0be`, tree `a20806fcc1dde1e92b2f155d38773dd609846a43`. GitHub Actions [run 40906908055](https://github.com/hunghvt-cyber/web-notes/actions/runs/40906908055) passed both `test` and `browser` on that exact PR head. PR #34 remains draft. CI does not qualify the Vercel OIDC/Firestore path.

Gemini key1–3 (`gemini-3.5-flash-lite`) independently reviewed the open/list/save path and cache design. Key1 recommended viewport observation and adopting an in-flight read; both were verified and implemented. Key2 recommended scroll priority and stale/scope guards; accepted. Its description of prefetch using the shared one-at-a-time RequestLane was imprecise: the old prefetch loop was already sequential but occupied the API lane. Measurements showed foreground contention, so background reads now bypass that lane and can be canceled/adopted. Key3 highlighted scope and ACK integrity; accepted after source checks. Its sub-180 ms cached-open figure was not a comparable navigation-to-editor measure and was excluded.

Gemini key4 (`gemini-3.5-flash-lite`) found no code-level release blocker and confirmed the preview, cache, prefetch, dirty editor, IME and CAS paths. Its earlier stale-revalidation concern was not reproduced: request sequence, active session identity, note ID and dirty state are checked before updating; an explicit active-note ID check was added. The review described 40/session as concurrency, while source enforces one active prefetch and 40 total starts. Its warning that longer metadata summaries increase payload/write bytes was accepted; list read count is unchanged. Gemini key5 confirmed the non-equivalent large-note state is labeled and agreed the broad list/open and typing p95 targets are not met. Its cancellation accounting concern was accepted; AbortError cancellations are now separate from HTTP/request failures. It also flagged a missing catch when `openNote` awaited a canceled prefetch; that caller is now caught and a stale-selection browser test passes. Its claim that quota failure lacked coverage was rejected because the suite already has `corrupt-or-quota-blocked-cache-does-not-break-open-or-save`. Exact review decisions are in the [filtered JSON evidence](VIEWPORT-PREFETCH-20261029.json).

## Cloud and device gate

Historical direct Preview OIDC qualification succeeded on 2026-10-27, but this is not current qualification. Read-only IAM inspection on 2026-10-30 found the `vercel-notes-preview` WIF pool disabled, the Preview service account without IAM bindings, and no Preview Firestore data role. The accessible Firestore permission boundary is database-wide rather than a synthetic-vault boundary. No synthetic note/history read was made through current Vercel OIDC. Exact checks and blockers are in [typing/cloud follow-up](TYPING-PROFILE-20261030.md). No Production deployment, alias, protection bypass, billing or access policy was changed.

S25 Ultra and iPad were not tested. After a future qualified cloud release, the user checklist is: reopen the app, reopen a viewed note, switch notes quickly, type Vietnamese with IME, and edit the same note on two devices. Do not claim an 8/10 Google Keep experience before user evaluation.
