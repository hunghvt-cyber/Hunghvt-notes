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

The Vercel API creation call for a Production-target deployment initially attached the default secondary alias despite the intended staging state. We restored that alias to the old deployment immediately, confirmed all three app aliases were on the old deployment and the candidate alias list was empty, and ran health/assets checks against the immutable candidate URL. Only after the health and asset checks passed were the three existing aliases assigned to the candidate. Final alias readback lists `hunghvt-notes.vercel.app`, `hunghvt-notes-hunghvt.vercel.app`, and `hunghvt-notes-git-main-hunghvt.vercel.app` on `dpl_2bPR3FTkbDabFjmNu7BwcEofEfUu`; the prior deployment has no remaining aliases.

Rollback target is READY deployment `dpl_9Tg1qnrqSKNHaNoKG1knMcMVxCst`, source SHA `96da1a42baf0d1ddd2ba7bc13c0f5dfe789bf10a`. To roll back, assign each of the three aliases above to that exact deployment and verify alias readback and `/api/app?route=health`; no data restore is needed because this release changed no backend or Firestore data. No Notes, history, trash, shares, or sessions were modified. The legacy draft IndexedDB database was left untouched.

The browser timing remains synthetic and noisy; it does not establish a Production speedup. Production verification proves the Firestore OIDC health path and exact app assets for this release, not a Vercel latency improvement on real user devices. Do not infer performance from the health request.

## Gemini lượt 2 — review diff và kết quả

Gemini wrapper lượt hai đã nhận diff frontend/test/docs đã lọc cùng kết quả source check, 190/190 offline test, 23/23 browser smoke và số đo synthetic. Nó nêu blocker rằng `hold({navigation:true})` thử save trước `confirm()`, và đề nghị test navigation offline. Tôi bác bỏ blocker sau đối chiếu với yêu cầu: đây là autosave đồng bộ khi người dùng chủ động điều hướng; chỉ khi ACK không đến mới hỏi có tiếp tục với dữ liệu chỉ còn trong RAM hay không. Khi offline, `save()` không gửi request; browser test bổ sung xác nhận đóng editor hiển thị cảnh báo, dismiss giữ nguyên nội dung/editor và không phát sinh POST. Reload cũng kích hoạt `beforeunload`.

Các nhận xét Gemini về xóa hoàn toàn `DraftVault`, giữ IndexedDB legacy nguyên trạng, giữ retry payload/clientOpId khi timeout, xác nhận CAS và cảnh báo `beforeunload` được chấp nhận. Nó đánh giá cache revision và request stale handling phù hợp, đồng thời kết luận số đo không đủ chứng minh tăng tốc Production; kết luận này được chấp nhận. Mô tả của Gemini về “abort signals” không khớp diff hiện hành (candidate chỉ loại task GET stale khi còn trong RequestLane; request đã chạy vẫn hoàn tất và bị chặn ghi đè bởi sequence/session guard), nên không dùng mô tả đó làm bằng chứng. Không có blocker còn mở theo review sau test bổ sung.
