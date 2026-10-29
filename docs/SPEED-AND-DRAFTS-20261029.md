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

CI lần đầu trên PR #30 phát hiện hai sai sót test-only: retry-load còn dựa vào DraftVault, và assertion browser race khóa title theo thứ tự note cố định. Đã sửa retry-load để kiểm tra operation trong RAM, dùng title từ fixture đang được kiểm tra; full local suite chạy lại đạt. CI cần chạy lại trên commit cập nhật.

Kết quả phát hành sẽ được cập nhật sau CI retry, Gemini lượt 2 và Vercel candidate/Production kiểm chứng. Không đưa vào bằng chứng này dữ liệu Notes, response body, cookies, token hoặc session. Nếu Production deployment thành công, ghi đúng SHA/deployment/aliases/asset/Firestore health và rollback deployment ở đây và `OPERATIONS.md`; nếu cloud OIDC không đạt thì giữ candidate, không tuyên bố Production tăng tốc.

## Gemini lượt 2 — review diff và kết quả

Gemini wrapper lượt hai đã nhận diff frontend/test/docs đã lọc cùng kết quả source check, 190/190 offline test, 23/23 browser smoke và số đo synthetic. Nó nêu blocker rằng `hold({navigation:true})` thử save trước `confirm()`, và đề nghị test navigation offline. Tôi bác bỏ blocker sau đối chiếu với yêu cầu: đây là autosave đồng bộ khi người dùng chủ động điều hướng; chỉ khi ACK không đến mới hỏi có tiếp tục với dữ liệu chỉ còn trong RAM hay không. Khi offline, `save()` không gửi request; browser test bổ sung xác nhận đóng editor hiển thị cảnh báo, dismiss giữ nguyên nội dung/editor và không phát sinh POST. Reload cũng kích hoạt `beforeunload`.

Các nhận xét Gemini về xóa hoàn toàn `DraftVault`, giữ IndexedDB legacy nguyên trạng, giữ retry payload/clientOpId khi timeout, xác nhận CAS và cảnh báo `beforeunload` được chấp nhận. Nó đánh giá cache revision và request stale handling phù hợp, đồng thời kết luận số đo không đủ chứng minh tăng tốc Production; kết luận này được chấp nhận. Mô tả của Gemini về “abort signals” không khớp diff hiện hành (candidate chỉ loại task GET stale khi còn trong RequestLane; request đã chạy vẫn hoàn tất và bị chặn ghi đè bởi sequence/session guard), nên không dùng mô tả đó làm bằng chứng. Không có blocker còn mở theo review sau test bổ sung.
