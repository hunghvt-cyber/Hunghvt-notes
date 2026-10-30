# Giao diện workspace/editor — candidate review

Ngày 30/10/2026. Đây là candidate để người dùng duyệt giao diện; **chưa merge, chưa deploy**, Production giữ nguyên `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J`. Candidate dựa trên main `91f7118a56b3a20bda0474b2e17b46c16f91440c` (tree `147bcb084f34ab644ab2e642f831a4258894499f`), tức bản compact PR #38 đã phát hành. PR #34, API/backend, Firestore, auth/config, prefetch và lazy history không được đưa vào.

Source candidate: `0540d0a1faa61885243d83a178b094623bb8e6c2` (tree `52e6f5506ae34fc92df5c8ee4d9610510b2fa90e`), dựa trên app source commit `b04649a773cef67833b02d90bbf569656af1f237`. Screenshot và `measurements.json` được dựng từ app source này với dữ liệu tổng hợp/in-memory fixture. Không dùng Notes thật. `vercel.json` chỉ thêm branch review này vào `git.deploymentEnabled=false`, để PR không tạo Vercel Preview deployment; không đổi cấu hình Production hay branch khác.

## Thay đổi và checklist

| Yêu cầu | Trạng thái | Bằng chứng |
|---|---|---|
| Header gọn; trạng thái thường inline, lỗi/conflict vẫn rõ | Đạt | Screenshot sáu viewport; source giữ error banner |
| Thanh chọn ngang thay toolbar thường; folder picker chỉ mở khi bấm di chuyển; bulk actions nằm trong menu | Đạt | `candidate/selection-pc-1280.png`, `candidate/move-menu-pc-1280.png`; browser assertion chiều cao thanh <52 px và cùng hàng với toolbar |
| Menu folder nằm trong visual viewport, cuộn trong menu; mục cuối click được | Đạt | `candidate/folder-menu-phone-390.png`; browser test cuộn tới `Quản lý chia sẻ`, xác minh bounding box trong viewport và click thật |
| Bỏ custom sort, nút Lên/Xuống và hướng dẫn cũ; giữ các chế độ còn lại và dữ liệu thứ tự server | Đạt | Không có option `custom`, nút hoặc hướng dẫn Lên/Xuống; unit test xác minh server custom order/snapshot vẫn được bảo toàn, cache preference cũ rơi về updated-desc |
| Danh sách là workspace chính; drawer trên tablet/điện thoại, sidebar thu gọn trên PC | Đạt | Screenshot list sáu viewport; iPad ngang có drawer phủ trên list rộng 1109 px |
| Editor đủ rộng/cao; nội dung lấp phần còn lại, mở desktop thành hai pane và tablet/phone thành lớp editor | Đạt trong Chromium viewport | Screenshot sáu editor; writing-area đo 317–900 px ngang và 333–874 px cao theo viewport |
| Tạo note dùng cùng editor/autosave dạng bottom sheet có thể mở rộng và có navigation guard | Đạt trong browser fixture | `candidate/quick-compose-phone-390.png`; rect ở 390×844 cao dưới 340 px; test đóng khi chưa ACK |
| Folder list/create/delete/share/revoke còn hoạt động | Đạt với fixture tổng hợp | Browser tests tái sử dụng link, link folder không cần mật khẩu chủ, badge, revoke và quyền sau revoke |
| Đổi tên folder lưu ở server | **Chưa đạt — API hiện hành không có rename** | `lib/preview-api.mjs` chỉ có list/create/delete; repository không có phương thức rename. Không giả lập client-side |
| Bỏ nút Tải backup/Khóa Notes khỏi app; giữ workflow backup tự động và Homepage lock | Đạt phần UI/tích hợp đã kiểm tra | Không còn control `#backup`/`#logout`; API không đổi. Repo Homepage canonical là `hunghvt-cyber/web-home`, SHA `02806ac4c1c4903b3489c59904250f970b389c05`; kiểm tra unauthenticated owner API trả `authenticated:false`. Không dùng session thật |
| Cache-first/revision, autosave/ACK/CAS/clientOpId/retry/conflict, history/trash/sharing và draft RAM | Không đổi | Diff không có API, cache/sync, Firestore hay auth file; browser suite kiểm revision đến muộn, conflict, retry một operation, draft RAM, logout/expired-scope purge, history/share/trash hiện có |

Phương án backend tối thiểu cho rename: thêm owner-authenticated API action và repository transaction cập nhật tên folder cùng mọi note reference; kiểm tra trùng tên; giữ nguyên ACL/quyền và thao tác rename atomically để không có trạng thái nửa đổi; cập nhật revision/snapshot/restore. Ảnh hưởng share: hiện route và capability scope nhắm folder bằng tên folder. Cần chuyển share target sang định danh folder ổn định hoặc transactionally chuyển binding, bảo toàn token/link hiện có và revoke đúng cùng folder; không được làm link cũ trỏ sang folder khác hoặc mở rộng quyền. Ảnh hưởng cache: invalidate list/folder cache cho tên cũ/mới và cập nhật revision đã ACK; response cũ không được hồi sinh tên cũ. Chưa có endpoint nên toàn bộ rename remains out of scope cho UI review.

## Các thao tác đã bỏ khỏi giao diện Notes

- Bỏ sort `Tùy chỉnh`, nút Lên/Xuống và hướng dẫn liên quan; giữ nguyên dữ liệu thứ tự đã lưu trên server, các chế độ sort khác và fallback preference cũ.
- Bỏ nút `Tải backup` và `Khóa Notes` trong app Notes. Không thay đổi workflow backup/restore tự động; khóa/mở kho chủ vẫn thuộc Homepage. API/session owner không bị sửa; source Homepage canonical giữ nguyên và kiểm tra unauthenticated owner API vẫn trả `authenticated:false` (không dùng session chủ).
- Không thêm Archive. Không đổi API/backend/auth/config vận hành; ngoại lệ duy nhất là chặn Preview deployment cho branch review này trong `vercel.json` để đáp ứng yêu cầu chưa deploy.

## Ảnh candidate

Mỗi ảnh là CSS viewport, Chromium headless, fixture tổng hợp:

| Màn | Danh sách | Editor |
|---|---|---|
| Điện thoại 360×800 | [list](candidate/list-phone-360.png) | [editor](candidate/editor-phone-360.png) |
| Điện thoại 390×844 | [list](candidate/list-phone-390.png) | [editor](candidate/editor-phone-390.png) |
| iPad dọc 744×1133 | [list](candidate/list-ipad-portrait.png) | [editor](candidate/editor-ipad-portrait.png) |
| iPad ngang 1133×744 | [list](candidate/list-ipad-landscape.png) | [editor](candidate/editor-ipad-landscape.png) |
| PC 1280×720 | [list](candidate/list-pc-1280.png) | [editor](candidate/editor-pc-1280.png) |
| PC 1920×1080 | [list](candidate/list-pc-1920.png) | [editor](candidate/editor-pc-1920.png) |

Trạng thái tương tác: [thanh chọn PC](candidate/selection-pc-1280.png), [menu di chuyển sát mép](candidate/move-menu-pc-1280.png), [drawer iPad ngang](candidate/folder-drawer-ipad-landscape-1133.png), [menu folder phone](candidate/folder-menu-phone-390.png), [bảng quản lý folder PC](candidate/folder-management-pc-1280.png), [tạo nhanh phone](candidate/quick-compose-phone-390.png). Mô tả ảnh tham khảo công khai đã xem: Keep dùng sidebar folder phẳng, thanh tìm kiếm và tạo nhanh nhỏ, danh sách thẻ nhiều cột; trên phone navigation/list đơn giản và editor mở lớn. Ảnh tham khảo chỉ lưu local ngoài repo.

## Kích thước asset

Raw và gzip deterministic (`mtime=0`), so với main ban đầu; chỉ HTML/CSS/JS app, không gồm ảnh screenshot:

| Asset | Raw trước → sau | Gzip trước → sau |
|---|---:|---:|
| `public/index.html` | 8,563 → 9,263 B (+700) | 2,683 → 2,833 B (+150) |
| `public/app.css` | 25,583 → 21,169 B (−4,414) | 5,859 → 4,843 B (−1,016) |
| `public/app.js` | 58,344 → 60,626 B (+2,282) | 15,698 → 16,080 B (+382) |
| **Tổng** | **92,490 → 91,058 B (−1,432)** | **24,240 → 23,756 B (−484)** |

## Kiểm thử

- `npm test`: 191/191.
- `npm run check:source`: đạt, 49 file; syntax/import/truncation checks đạt.
- `node --test test/organize.test.mjs`: 4/4.
- `node --check scripts/browser-smoke.mjs`, `git diff --check`: đạt.
- `node scripts/retry-load.mjs --patient`: pass simulated retry load; virtual clock/fake WebDAV, không phải live latency/capacity.
- Browser fixture trọng điểm: 22/22, gồm 6 viewport, selection/menu/quick-compose, folder share/revoke, response sai thứ tự, cache/revision, draft chưa ACK, retry/idempotency, conflict hai tab, paste/undo, view-only và touch target. Full `npm run test:browser`: 34/34 pass; `browser-result.local.json` báo `passed=true`. Runner tổng kết được sửa để không hard-code số test.
- Hosted GitHub Actions draft PR #39: `test` và `browser` đều success, run `41026303191`, head `d10707fa2c4a64721a362edfe56e39706c41ee73`, tree `cc5638977b116b32d4e3d6f5f3767729f9321943`. Browser screenshot/update fixture cũng đạt local sau khi thêm bảng quản lý folder. Vercel list theo SHA và branch trả 0 deployment; `vercel.json` loại branch review khỏi Preview. Không thay alias/Production.
- Home integration chỉ kiểm tra source/repo canonical và unauthenticated owner API; không dùng login/session thật. Share/revoke cloud OIDC chưa chạy; test chỉ dùng fixture tổng hợp. Không thay bằng chứng này bằng benchmark NAS.

Lệnh browser fixture tạo `docs/PERFORMANCE-BASELINE-20261029.json` ngoài phạm vi candidate; file này không dùng để tuyên bố UX nhanh hơn. IME, bàn phím hệ điều hành, xoay máy thật và thiết bị S25 Ultra/iPad chưa được thử trực tiếp. Composition event/paste/selection chỉ được mô phỏng trong Chromium.

## Gemini và điều phối

Wrapper `/home/admin/bin/gemini-task --help` được đọc trước khi gọi; `--key`, `--model`, `--timeout`, prompt file được xác nhận. Không sửa wrapper. Hai giai đoạn đều chạy song song an toàn qua các key riêng; tối đa đồng thời 3 luồng (giai đoạn 1), rồi 2 (review/follow-up). Không gửi ảnh riêng, Notes, session, token hoặc secret.

| Key/model/vai trò | Gọi | Thời gian thực tế | Kết quả |
|---|---|---:|---|
| key1 / gemini-3.5-flash-lite — phone toolbar/menu | 1 | 6.291 s | Thanh ngang và bỏ custom sort hữu ích; 36 px target, popup absolute và fixed bottom bar bị bác bỏ (44 px/portal tiết kiệm chiều cao) |
| key2 / gemini-3.5-flash-lite — iPad/PC/editor | 1 | 6.548 s | List-first, editor layer/mobile fullscreen, reuse editor/autosave được dùng; 3 cột và `!important` overrides bị bỏ |
| key3 / gemini-3.5-flash-lite — folders/share/Home | 1 | 6.139 s | Rename API thiếu được xác nhận độc lập; không giả lập, giữ Homepage auth và folder share |
| key4 / gemini-3.5-flash-lite — code/focus/data review | 2 | 5.566 s + 4.163 s | Lượt đầu cảnh báo aria-modal/Escape sai theo code; Codex bác bỏ bằng listener và browser test. Follow-up đánh giá đạt, không còn finding mới |
| key5 / gemini-3.5-flash-lite — evidence/layout review | 2 | 7.062 s + 4.163 s | Mapping yêu cầu/ảnh/test hữu ích; nhưng báo nhầm một assertion ở `test/organize` (nằm trong browser smoke), Codex sửa/cross-check. Follow-up PASS; Gemini chỉ nhận mô tả ảnh, không xem pixel |

Giai đoạn 1 wall wait 6.549 s, tối đa 3; review đầu wall wait 7.062 s, tối đa 2; follow-up wall wait 4.167 s, tối đa 2. Tổng thời gian chờ batch thực tế 17.778 s, không cộng duration song song thành wall time. 7 lời gọi, exit 0, không lỗi/timeout/retry/quota. Công chuẩn bị/kiểm chứng/tổng hợp không bấm giờ; ước tính khoảng 45 phút, không có baseline tương đương để kết luận tiết kiệm thời gian. Kết quả áp dụng rõ nhất là đổi layout iPad ngang sau khi browser profile tìm ra list chỉ còn 220 px, và cô lập/sửa bottom-sheet CSS cascade. Lần sau nên dùng key1–3 song song cho góc nhìn độc lập; key4–5 song song cho review diff, follow-up chỉ vùng đổi. Với contract rename và quyền dữ liệu, Gemini gợi ý phạm vi nhưng Codex phải kiểm tra API/repository.

Bài học điều phối chung đã ghi vào repo canonical `hunghvt-cyber/ai-team`, nhánh `docs/gemini-coordination-lessons-20261030`, cập nhật `RUNBOOK.md` và `CURRENT-STATE.md`; nhánh được ghi qua GitHub API tới commit `6c3568334ee6840fe69942671927e93455716dd5`. Push Git thông thường không có credential, nên local AI-team clone có commit tương đương nhưng không được xem là đã push; nhánh GitHub API là bản canonical đã ghi. Chi tiết riêng Notes giữ ở repo này.

## Gate và rollback dự kiến

Candidate được chuẩn bị để duyệt giao diện trong [draft PR #39](https://github.com/hunghvt-cyber/web-notes/pull/39); không merge/deploy. Checks `test`/`browser` hosted đều success cho tree code candidate. Folder rename còn blocker backend rõ ràng. Nếu sau khi duyệt candidate được phát hành, rollback dự kiến là gán lại từng alias Production về `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J`, rồi đọc lại đủ ba alias và health. Lượt này chưa deploy, nên không có rollback/deployment mới.
