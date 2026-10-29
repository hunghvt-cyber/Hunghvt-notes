# Tốc độ tải Notes và draft chỉ trong RAM — 2026-10-29

## Phạm vi và quyết định

Đo baseline trên assets `d5d815932a0b`, sau đó trên candidate trước CI. Fixture trình duyệt chỉ có 20 note nhỏ tổng hợp và một note 128 KiB tổng hợp. Chromium headless chạy trên NAS; app/API handler dùng WebDAV in-memory test fixture. Không đọc hay sửa Notes thật, share thật, lịch sử thật, trash, session hoặc dữ liệu Firestore Production.

Đo action wall time, trình duyệt fetch duration và handler server duration riêng; phép trừ còn lại bao gồm client code, render/layout và harness. Cold list là một mẫu nên không đại diện p95. Các phép mở note và chuyển nhanh có 7 mẫu mỗi trạng thái, không đủ để kết luận phần trăm cải thiện ổn định. Số liệu đầy đủ đã lọc, chỉ gồm route/method/shape/status/timing tổng hợp, được lưu trong `PERFORMANCE-BASELINE-20261029.json`.

| Hành động | Baseline p50/p95 ms (n) | Candidate p50/p95 ms (n) |
|---|---:|---:|
| Danh sách cold | 889/889 (1) | 782–1,340/782–1,340 (1 mỗi lượt) |
| Danh sách warm | 312/363 (6) | 273–298/312–374 (6 mỗi lượt) |
| Mở note nhỏ cold | 213/282 (7) | 180–225/238–243 (7 mỗi lượt) |
| Mở note 128 KiB cold | 214/255 (7) | 203–222/254–263 (7 mỗi lượt) |
| Mở note nhỏ warm | 191/245 (7) | 188–199/230–245 (7 mỗi lượt) |
| Chuyển nhanh giữa note | 413/483 (7) | 408–444/459–477 (7 mỗi lượt) |

Ba lượt candidate cho thấy dao động đáng kể (đặc biệt cold list 782–1,340 ms với chỉ một mẫu mỗi lượt); baseline chỉ có một lượt. Mở note không cải thiện rõ ràng và không thể phân biệt thay đổi nhỏ với nhiễu máy. Không tuyên bố Production đã nhanh hơn theo phần trăm. Đo chỉ ra một tối ưu xác định được: trong chuỗi mở note nhanh có response trễ, bỏ GET cũ còn xếp hàng trước khi gửi giảm content GET từ 3 xuống 2; response đến muộn bị chặn theo lựa chọn hiện tại. Không rút ngắn kiểm tra revision, không trả cache như dữ liệu mới nhất, không sửa backend/Firestore. Cache danh sách chỉ ghi bất đồng bộ sau render server và bỏ write cũ đã lỗi thời.

Backend hiện vẫn trả metadata/history theo hợp đồng hiện hành. Không tách tải history trong candidate vì chưa có số đo cloud chứng minh đó là nút thắt và thay đổi backend cần qualify Production OIDC trên candidate chính xác. Do đó mức cải thiện mở note còn chưa được chứng minh; nếu yêu cầu là giảm độ trễ đáng kể ở Production, đây là giới hạn còn lại cần đo tiếp bằng cloud OIDC, không dùng NAS ADC/fixture thay thế.

## Bỏ persistent draft

- `SyncDraft` giữ note, operation đang chờ, `clientOpId` và retry payload trong RAM của tab. Autosave Firestore, ACK validation, CAS revision và xử lý conflict giữ nguyên.
- Nhãn “Đã lưu” chỉ sau ACK có `clientOpId` trùng, acknowledged revision và revision HEAD đồng nhất. Timeout retry dùng nguyên operation/payload để server receipt chống ghi hai lần.
- Khi lỗi, UI nói rõ chưa lưu. Chuyển note/list, logout, đóng editor hoặc điều hướng thử autosave rồi hỏi xác nhận nếu vẫn dirty; `beforeunload` bảo vệ các dirty session. Reload/đóng trang vẫn có thể làm mất thay đổi chưa ACK.
- Không còn đọc/ghi/xóa `hunghvt-notes-drafts-v1`; test đặt record legacy tổng hợp, xác nhận app không truy cập database và record còn nguyên. Không chuyển nội dung sang localStorage, service worker hay durable queue.
- Giữ cache danh sách/content IndexedDB riêng cho preview/sort; revision nền vẫn được kiểm tra trước khi dùng nội dung đã cache.

## Gemini lượt 1 — phân tích

Gemini wrapper `/home/admin/bin/gemini-task` đã được kiểm tra bằng `--help` và truy vấn status an toàn; wrapper hoạt động. Được gửi source frontend có liên quan và timings tổng hợp đã lọc, không có Notes/session/secret. Nhận xét về việc song song hóa auth/cache hydration và giảm kiểm tra revision không được áp dụng: có nguy cơ freshness/auth regression và số đo chưa chứng minh đó là bottleneck. Nhận xét về duplicate auth GET không khớp luồng nguồn sau kiểm chứng. Giữ `beforeunload`, CAS và `clientOpId`; bổ sung cảnh báo điều hướng theo yêu cầu bỏ recovery bền. Kết luận đo là cải thiện open-note chưa chứng minh, nên thay đổi chỉ thu hẹp request stale queue và không giảm bảo vệ revision.

## Kiểm chứng và phát hành

PR [#30](https://github.com/hunghvt-cyber/web-notes/pull/30) merged to `main` at `3aa153bed9e768092e24c50a3037dc385635ff11`, tree `107dc688af1a6953d407ae9eb3ab7566a762ce8b`. Its candidate commit `7991b8045f36835dc8e69f829c5399a4ac31d4ec` is an ancestor of the merge and the exact source tree deployed below. CI run [40876954309](https://github.com/hunghvt-cyber/web-notes/actions/runs/40876954309) passed source check, 190 offline tests, simulated retry-load, and 23 browser scenarios. The first CI run [40876200426](https://github.com/hunghvt-cyber/web-notes/actions/runs/40876200426) caught two test-only issues: retry-load still assumed DraftVault, and a browser race assertion hard-coded list order. Both were corrected; the retry-load now verifies in-memory operation retention, and the race check compares against the selected fixture.

Production deployment `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu` (`hunghvt-notes-mq1ryfg1f-hunghvt.vercel.app`) reached READY with Vercel metadata SHA `7991b8045f36835dc8e69f829c5399a4ac31d4ec`; its source tree matches the merged `main` tree above. A read-only health request on that exact immutable deployment returned HTTP 200, `production=true`, `backend=firestore-native-v1`, `firestoreRead=PASS`, project `notes-lab-56f0f`, vault `notes-production`. No Notes content was read by this probe. `/`, `/app.js`, `/app.css`, `/cache.js`, and `/sync.js` matched the checked source byte-for-byte on the immutable deployment; the primary/secondary aliases then returned HTTP 200 for health and matching HTML/JS/CSS/sync assets.

The protected-URL fetch helper created a temporary Vercel share-link bypass while checking alias health/assets. That bypass was revoked after verification; alias readback shows no protection-bypass entries.

The Vercel API creation call for a Production-target deployment initially attached the default secondary alias despite the intended staging state. We restored that alias to the old deployment immediately, confirmed all three app aliases were on the old deployment and the candidate alias list was empty, and ran health/assets checks against the immutable candidate URL. Only after the health and asset checks passed were the three existing aliases assigned to the candidate. Final alias readback lists `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, and `hunghvt-notes-git-main-hunghvt.vercel.app` on `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`; the prior deployment has no remaining aliases.

Rollback target is READY deployment `dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst`, source SHA `96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a`. To roll back, assign each of the three aliases above to that exact deployment and verify alias readback and `/api/app?route=health`; no data restore is needed because this release changed no backend or Firestore data. No Notes, history, trash, shares, or sessions were modified. The legacy draft IndexedDB database was left untouched.

The browser timing remains synthetic and noisy; it does not establish a Production speedup. Production verification proves the Firestore OIDC health path and exact app assets for this release, not a Vercel latency improvement on real user devices. Do not infer performance from the health request.

## Gemini lượt 2 — review diff và kết quả

Gemini wrapper lượt hai đã nhận diff frontend/test/docs đã lọc cùng kết quả source check, 190/190 offline test, 23/23 browser smoke và số đo synthetic. Nó nêu blocker rằng `hold({navigation:true})` thử save trước `confirm()`, và đề nghị test navigation offline. Tôi bác bỏ blocker sau đối chiếu với yêu cầu: đây là autosave đồng bộ khi người dùng chủ động điều hướng; chỉ khi ACK không đến mới hỏi có tiếp tục với dữ liệu chỉ còn trong RAM hay không. Khi offline, `save()` không gửi request; browser test bổ sung xác nhận đóng editor hiển thị cảnh báo, dismiss giữ nguyên nội dung/editor và không phát sinh POST. Reload cũng kích hoạt `beforeunload`.

Các nhận xét Gemini về xóa hoàn toàn `DraftVault`, giữ IndexedDB legacy nguyên trạng, giữ retry payload/clientOpId khi timeout, xác nhận CAS và cảnh báo `beforeunload` được chấp nhận. Nó đánh giá cache revision và request stale handling phù hợp, đồng thời kết luận số đo không đủ chứng minh tăng tốc Production; kết luận này được chấp nhận. Mô tả của Gemini về “abort signals” không khớp diff hiện hành (candidate chỉ loại task GET stale khi còn trong RequestLane; request đã chạy vẫn hoàn tất và bị chặn ghi đè bởi sequence/session guard), nên không dùng mô tả đó làm bằng chứng. Không có blocker còn mở theo review sau test bổ sung.

## Follow-up candidate cache-first — 2026-10-29

Phần phía trên là hồ sơ release trước (`d735659`/Production `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`). Nó không mô tả candidate tiếp theo. Candidate hiện hành bắt đầu tại `d735659d1457f5aa2144ed45fb1aaa9ca07ec495`, chưa merge/deploy. So sánh mới dùng cùng Chromium headless/NAS, 20 mẫu, 20 note nhỏ có 5 revision lịch sử và một note tổng hợp 128 KiB. App/API handler dùng fixture in-memory tương thích Firestore; timing từ navigation/action đến render tách khỏi fetch/handler, bytes và prefetch. Không chứa nội dung, ID, session hay secret. Chi tiết đã lọc ở [CACHE-PERFORMANCE-20261029.json](CACHE-PERFORMANCE-20261029.json).

| Kịch bản | Main p50/p95 ms | Candidate p50/p95 ms | Main → candidate response bytes | Kết quả ngưỡng đề xuất |
|---|---:|---:|---:|---|
| Mở app, cache danh sách trống | 330.3/381.5 | 302.7/398.1 | 103,660 → 108,660 | p95 >300 ms |
| Mở app, cache danh sách có sẵn | 293.4/371.6 | 271.5/293.4 | 103,660 → 105,090 (trong đó 3,050 prefetch) | p95 ≤300 ms trên fixture này |
| Mở note nhỏ chưa cache trong phiên | 206.7/247.2 | 198.7/250.6 | 17,940 → 5,080 | p95 >100 ms |
| Mở note 128 KiB đã cache sau reload | 234.2/269.9 | 204.0/231.2 | 2,625,940 → 1,440 | p95 >100 ms |
| Mở note nhỏ đã cache sau reload | 142.5/194.3 | 140.3/174.3 | 17,940 → 7,950 (3,799 foreground; 4,151 prefetch) | p95 >100 ms |
| Gõ khi kiểm revision trễ 120 ms | 73.8/101.1 | 70.6/87.1 | 22,312 → 25,880 | p95 ≤100 ms trên fixture này |
| Chuyển nhanh 3 note, read trễ 120 ms | 348.7/390.9 | 521.7/552.6 | 4,320 → 8,454 | chậm hơn baseline; ngưỡng >100 ms |

Mỗi phép đo có n=20. Candidate list warm loại một lượt health GET dư và có thể hiển thị snapshot cache sau xác thực; p95 đạt 293.4 ms trong môi trường này. Candidate bỏ history khỏi content GET thường, nhưng history vẫn được tải khi mở UI lịch sử. Cache tối đa 12 note/1 MiB, mỗi note 256 KiB; prefetch tối đa 2 note/phiên auth, tuần tự, 64 KiB/note. Prefetch tạo thêm request ở kịch bản mở app và bị hủy khi thao tác người dùng cần ưu tiên. Candidate ghi 1 `AbortError` khi open small sau reload do hủy prefetch; không có HTTP lỗi. Quick switch thua baseline rõ trong lần so sánh này; không che số liệu đó bằng trung bình chung.

Giới hạn: cold cache vẫn có p95 398.1 ms; mở note cache còn p50 140.3 ms; quick switch candidate p50 521.7 ms. Các số NAS/headless/fixture không phải độ trễ Vercel OIDC hoặc thiết bị thật, và không chứng minh tăng tốc Production/đạt 8/10 Google Keep. Mục tiêu cảm nhận ở S25 Ultra và iPad chưa được kiểm tra.

Candidate giữ bỏ persistent draft: chỉ nội dung ACK được cache; draft chưa ACK ở RAM, IndexedDB legacy được giữ nguyên nhưng không đọc/ghi/xóa; `SyncDraft`, CAS, `clientOpId`, retry, conflict và ACK vẫn hoạt động. Local full offline test 192/192, browser smoke 31/31, retry/load harness đạt và source check đạt trên Node 22.23.4. PR draft [#34](https://github.com/hunghvt-cyber/web-notes/pull/34) chạy CI [40891155789](https://github.com/hunghvt-cyber/web-notes/actions/runs/40891155789): hai job test/browser đạt trên Node 24 cho remote commit `80439c206bc8b8021e2f1cb08d3afed4e39a0bae`, tree `85ac693dab747d5f9a10d4adb6a66c7ac6e12d8f`. Nó trùng tree local commit `c4db1c89d08a799812a9c2ebb8001edd50e4432b`. Gemini lượt 1 phân tích source trước sửa; các nhận xét đã được kiểm chứng với source. Lượt 2 hoạt động qua wrapper và trả verdict không promote.

 Không deploy Production: candidate thay đổi đường đọc Firestore, nhưng chưa có vault thử cô lập để chạy chính route đọc note/history qua Vercel runtime + OIDC. Health endpoint hoặc fixture NAS không đủ chứng minh đường đó; không dùng Notes thật/session để test. Deployment hiện hành và các alias chưa đổi; rollback target hiện hành vẫn `dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst` nếu release trước cần hoàn nguyên.

### Gemini lượt 1 — phân tích trước sửa

Gemini wrapper được kiểm tra và hoạt động. Gemini đọc source liên quan cùng
timings synthetic đã lọc. Nó chỉ đúng rằng `openSequence` chặn response cũ,
`RequestLane` ưu tiên save và có thể bỏ GET stale còn đang chờ, và thay đổi chưa
ACK chỉ ở RAM. Source kiểm chứng thêm rằng map nội dung trong RAM chưa có giới
hạn; candidate thêm LRU/bounds và giới hạn prefetch.

Gemini mô tả IndexedDB hiện tại như nơi đã lưu body chưa ACK; nhận xét đó sai:
source ban đầu không gọi database draft bền, và app chỉ có cache list preview.
Gemini cũng bỏ sót rằng API/Firestore ordinary open đọc 5 history versions.
Codex xác minh qua `public/app.js`, `lib/preview-api.mjs` và
`lib/firestore-native-repository.mjs`; do đó đề xuất tách history và chỉ cache
ACKed content được áp dụng dựa trên source/tests, không dựa theo các giả định
sai này. Không gửi note data, session hoặc secrets.

### Gemini lượt 2 — review cuối

Wrapper `/home/admin/bin/gemini-task --help` hoạt động; Gemini nhận source diff và report chỉ có fixture tổng hợp/metrics đã lọc. Gemini verdict **không promote** vì route note/history chưa qualify trên Vercel OIDC và quick-switch candidate chậm hơn. Chấp nhận cả hai kết luận về quyết định phát hành: thiếu cloud evidence là blocker, và quick-switch 521.7/552.6 ms so với 348.7/390.9 ms cần được điều tra, không được che bằng warm-list/typing tốt hơn.

Gemini chấp nhận việc skip history cho open thường, giữ transaction revision/ACL, dirty editor/IME guard và cache scope/clear sau logout hoặc auth hết hạn; đối chiếu code cùng test tương ứng cho thấy các nhận xét này phù hợp. Bác bỏ giải thích nguyên nhân Gemini đưa ra rằng hủy prefetch làm “head-of-line blocking qua IDB lookup”: lần mở cache lấy từ Map trong RAM, `abortPrefetch()` không await request, và guard sequence chặn response cũ. Report chỉ đo chênh lệch, chưa tách thời gian DOM/input/click và chưa chứng minh nguyên nhân. Giữ regression đo được như blocker cho việc promote, nhưng cần profiler/device run tiếp theo trước khi quy lỗi cho cancellation hoặc thay đổi cơ chế.

Giới hạn bổ sung: CompositionEvent trong browser smoke là mô phỏng; không chứng minh bàn phím IME thật trên Android/iPadOS. Không có Node 24 local; CI trên candidate chưa chạy. Không kiểm tra Vercel OIDC note/history bằng dữ liệu tổng hợp vì chưa có vault test scope cô lập; không dùng Production session/dữ liệu để lấp khoảng trống này.
