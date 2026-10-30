# Giao diện workspace/editor — candidate review

> Cập nhật sau phản hồi screenshot: PR #39 giờ chỉ giữ UI; backend/API rename và test liên quan đã tách sang [draft PR #40](https://github.com/hunghvt-cyber/web-notes/pull/40), chưa cloud-qualified và không được xem là hoàn tất. PR #39 không còn chứa rename.

Ngày 30/10/2026. Đây là candidate để người dùng duyệt giao diện; **chưa merge, chưa deploy**, Production giữ nguyên `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J`. Candidate dựa trên main `91f7118a56b3a20bda0474b2e17b46c16f91440c` (tree `147bcb084f34ab644ab2e642f831a4258894499f`), tức bản compact PR #38 đã phát hành. PR #34, API/backend, Firestore, auth/config, prefetch và lazy history không được đưa vào.

Source candidate vòng trước: `0540d0a1faa61885243d83a178b094623bb8e6c2` (tree `52e6f5506ae34fc92df5c8ee4d9610510b2fa90e`), dựa trên app source commit `b04649a773cef67833b02d90bbf569656af1f237`. Screenshot và `measurements.json` được dựng từ app source này với dữ liệu tổng hợp/in-memory fixture. Không dùng Notes thật. `vercel.json` chỉ thêm branch review này vào `git.deploymentEnabled=false`, để PR không tạo Vercel Preview deployment; không đổi cấu hình Production hay branch khác.

## Cập nhật vòng sửa PR #39 — composer, quản lý folder và rename

Candidate vẫn ở draft; **không merge/deploy** và Production giữ `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J`. Vòng này sửa đúng phản hồi screenshot: bỏ nút `+` trùng; toolbar chọn thay toolbar thường và ẩn tạo note; quick composer có Đóng/trạng thái/mở rộng/Lưu/menu; history/share chỉ nằm trong menu và ẩn khi note chưa ACK; nội dung co giãn theo chiều cao. Desktop giữ hai pane mặc định, icon mở rộng chuyển editor thành vùng chính. Bảng folder có thao tác theo từng hàng và scroll trong menu. Danh sách folder không bị dựng lại khi chỉ note thay đổi, tránh làm mất focus trường rename.

**Rename thật:** endpoint `POST /api/app?route=folders` nhận `action=rename`, folder cũ/mới và `clientOpId`; chỉ owner. Firestore transaction đổi folder references ở note active/trash, tăng revision để cache cũ bị tái xác minh, chuyển share rows sang tên mới mà vẫn giữ share ID/token/permission/revocation; `tokenBoxTarget` nội bộ giữ AAD gốc để tạo lại cùng link. Alias tên cũ được ghi vào snapshot và nén về target đang hoạt động khi rename lặp lại. Tên cũ không thể tái tạo thành folder mới. Rename chặn nếu có note đang purge, nếu guard share không khớp hoặc nếu transaction vượt 450 writes; khi vượt giới hạn trả `FOLDER_RENAME_TOO_LARGE` nếu vượt giới hạn; không có chunked rename và không commit một phần. Đây là transaction atomic; fixture kiểm tra đọc shared folder, idempotent replay, backup alias và revoke. **Cloud Firestore/Vercel runtime chưa được qualify**, nên tính năng backend này chưa đủ điều kiện phát hành Production dù test mô phỏng đạt.

| Checklist vòng này | Kết quả | Bằng chứng tổng hợp |
|---|---|---|
| Phone list, 390 px; tiêu đề dài, nhiều đoạn, code, checklist, nhiều folder/tên dài | Đạt trong Chromium | [Danh sách phone 390](candidate/list-phone-390.png) |
| iPad dọc/ngang, PC list | Đạt trong Chromium | [iPad dọc](candidate/list-ipad-portrait.png), [iPad ngang](candidate/list-ipad-landscape.png), [PC 1280](candidate/list-pc-1280.png) |
| Chọn nhiều ngang trên phone/iPad | Đạt | [Phone](candidate/selection-phone.png), [iPad](candidate/selection-ipad.png) |
| Menu chuyển folder, mục Di chuyển trong viewport | Đạt | [Phone](candidate/move-menu-phone.png), [iPad](candidate/move-menu-ipad.png) |
| Quick composer ở 390×844 và viewport thấp 390×420 mô phỏng bàn phím | Đạt trong Chromium | [Composer phone](candidate/quick-compose-phone-390.png), [390×420](candidate/quick-compose-phone-390-low-viewport.png) |
| Editor PC split mặc định và mở rộng thành vùng chính | Đạt | [Editor mở rộng 1280](candidate/editor-pc-1280-expanded.png) |
| Folder table/scroll và thao tác hàng cuối | Đạt | [Đầu bảng](candidate/folder-management-pc-1280.png), [cuối bảng](candidate/folder-management-pc-1280-bottom.png) |
| Rename giữ link/quyền/revoke/retry và alias backup | Đạt trong Firestore fake + API fixture; chưa cloud-qualified | `test/firestore-native-repository.test.mjs`, `test/preview-api.test.mjs` |
| Thiết bị thật/IME/keyboard OS | Chưa thử | Chỉ Chromium; thấp viewport là mô phỏng, không phải bàn phím thật |

Assets raw/gzip, so với `origin/main` trước vòng này: `index.html` 8,563/2,683 → 9,537/2,887 B; `app.css` 25,583/5,859 → 25,448/5,489 B; `app.js` 58,344/15,698 → 62,713/16,579 B. UI CSS gzip giảm 370 B; HTML+JS gzip tăng do folder rename/state handling.

Local verification vòng này: `npm test` 193/193; `npm run check:source` pass (49 files); full `npm run test:browser` 34/34 pass, gồm menu manager bottom, selection/move phone+iPad, viewport thấp, editor PC expanded, cache/autosave/conflict/paste/undo; `git diff --check` pass. Lần chạy đầu tìm được test cũ bấm `#new` đã bỏ; sửa test dùng `#quick-create`, assertion save đang chạy và retry sau đó đều pass. Không bỏ assertion. Dùng synthetic fixture/in-memory Firestore; không dùng Notes thật. Browser PNG đã được Codex mở và xem thật.

Gemini các vòng kiểm tra: wrapper đã kiểm tra, key4/key5 chạy song song an toàn (concurrency tối đa 2); đến thời điểm này mỗi key có tổng cộng 3 lượt (review, follow-up và incremental review), không lỗi/retry/timeout. Lượt follow-up key4 mất 2.980 s, key5 3.977 s; wall time batch 3.977 s. Thời gian lượt đầu không được đo. Key4 xác nhận các sửa về alias, query phạm vi, focus bảng folder và access guard; không còn finding cụ thể. Vòng incremental sau khi sửa menu: key4 và key5 mỗi key thêm 1 lượt, chạy song song (concurrency 2), wrapper thành công không lỗi/retry/timeout; wall time batch đo được khoảng 4.9 s, thời gian từng key không được đo riêng. Key4 nhắc kiểm tra alias có kế thừa ACL hiện hành; Codex xác minh alias chỉ được canonicalize trong mutation owner đã auth và lưu trong collection của vault hiện tại; public share đọc theo target/token hiện hành, không nhận alias làm quyền. Nhận xét này được giải đáp bằng source và test scope/revoke, nhưng không thay thế Cloud Firestore qualification. Key5 xác nhận đường dẫn/fixture/checklist khớp theo mô tả; wrapper chỉ text, không pixel-review; Codex đã mở ảnh candidate thật bằng image viewer. Key5 đối chiếu checklist/test/asset, nhắc cloud runtime và thiết bị thật chưa kiểm tra; wrapper text-only nên không được coi là pixel review. Không có baseline để khẳng định Gemini tiết kiệm thời gian. Key4 tìm thấy loop cập nhật alias bị lặp (đã xóa), full collection scans (đã đổi thành query theo folderId/trashFolder/scope/state để giảm reads), và render bảng folder làm mất focus (đã chỉ rebuild khi folder list đổi). Lo ngại phantom-read được bác bỏ dựa trên [Firestore serializable transactions](https://firebase.google.com/docs/firestore/transaction-data-contention), nhưng vẫn giảm phạm vi query để tiết kiệm reads; unit fake chưa chứng minh cloud. Cảnh báo activeCount được xử lý chặt hơn: transaction yêu cầu guard bằng số share active quan sát được, nếu lệch sẽ fail đóng với `FOLDER_ACCESS_STATE`. Key4 nhận định API contract mismatch bị bác bỏ vì route và UI cùng dùng `folder`/`newFolder`/`clientOpId`, có endpoint test. Key5 xác nhận evidence map; không xem pixel (wrapper nhận text), nên không được xem là visual review.

Key/model: key4, key5 / gemini-3.5-flash-lite; 3 lượt mỗi key tính cả incremental review cuối. Codex tự mở screenshot PNG để kiểm tra pixel. Chuẩn bị context, kiểm chứng và tổng hợp không bấm giờ; không có baseline tương đương để kết luận tiết kiệm thời gian.

Code candidate SHA `a377753723c16db735e098dee03174e2af2006f5`, tree `f8953e122c9a7b2dd7e9e1cbf3dacfaed100cb3a`. Hosted GitHub Actions run [#502](https://github.com/hunghvt-cyber/web-notes/actions/runs/41036744748) chạy trên exact code SHA, cả `test` và `browser` đều pass. Sau đó có một commit chỉ sửa browser helper để chờ native `details.open` và cuộn panel trước khi click; exact tree không đổi. Vercel lookup theo code SHA trả 0 deployment; không tạo deployment. PR #39 vẫn draft. `vercel.json` vẫn chặn Preview deployment cho branch này; không có Production deployment mới. Rollback dự kiến nếu có lần phát hành sau: gán lại cả ba alias về `dpl_EJ7Dp2NjCzn6aA5WhNcbZgnnHz1J` và xác minh health.

---

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
| Đổi tên folder lưu ở server | **Trạng thái ở vòng candidate trước — đã được thay thế ở phần cập nhật phía trên** | Vòng này bổ sung owner API/Firestore transaction, fixture cover share và retry; cloud runtime vẫn chưa qualify |
| Bỏ nút Tải backup/Khóa Notes khỏi app; giữ workflow backup tự động và Homepage lock | Đạt phần UI/tích hợp đã kiểm tra | Không còn control `#backup`/`#logout`; API không đổi. Repo Homepage canonical là `hunghvt-cyber/web-home`, SHA `02806ac4c1c4903b3489c59904250f970b389c05`; kiểm tra unauthenticated owner API trả `authenticated:false`. Không dùng session thật |
| Cache-first/revision, autosave/ACK/CAS/clientOpId/retry/conflict, history/trash/sharing và draft RAM | Không đổi | Diff không có API, cache/sync, Firestore hay auth file; browser suite kiểm revision đến muộn, conflict, retry một operation, draft RAM, logout/expired-scope purge, history/share/trash hiện có |

Phương án backend tối thiểu đã thực hiện ở vòng cập nhật: owner API + Firestore transaction đổi note refs/revision, đổi share row target nhưng giữ share ID/token/permission/revoke và AAD gốc tokenBox qua `tokenBoxTarget`; folder alias được snapshot/restore. Cache list revision thay đổi khiến content cũ không còn reusable. Đây là contract mới và chưa được verify trên Vercel/Cloud Firestore thật; không promote khi chưa đủ qualification.

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

Hosted CI final handoff: current PR head `0bd98e5e5528e635be1e50833bc5f29438a5ea0e` (tree `dc294b4986daf3589473ea2ae1063bbcc2ffbee6`) passed GitHub Actions [run #503](https://github.com/hunghvt-cyber/web-notes/actions/runs/41037196725), both `test` and `browser`. This commit only updates the handoff docs; application code remains the code candidate SHA above.


## Screenshot correction — composer and folder manager

- Composer 390×420: `editor-scroll` và `editor-content` giờ là flex column có chiều cao xác định; textarea nhận phần dư (`flex: 1 1 0`, `min-height: 0`). Khi checklist có phần tử thật, nó giữ vùng riêng giới hạn chiều cao và tự cuộn; checklist rỗng không chiếm chỗ. Browser assertion đo textarea cao hơn 180 px và khoảng dư cuối dưới 24 px; screenshot [composer 390×420](candidate/quick-compose-phone-390-low-viewport.png).
- Folder manager là panel nổi gọn; danh sách có vùng cuộn riêng, panel ngoài vẫn cuộn để tới các thao tác cuối. Test fixture tạo nhiều folder synthetic, cuộn đến hàng cuối và click `Chọn` ở phone 390×844, iPad dọc và PC 1280×720; đồng thời cuộn panel và click `Quản lý chia sẻ`. Ảnh: [phone đầu](candidate/folder-management-phone-390-top.png), [phone cuối](candidate/folder-management-phone-390-bottom.png), [iPad đầu](candidate/folder-management-ipad-portrait-top.png), [iPad cuối](candidate/folder-management-ipad-portrait-bottom.png), [PC đầu](candidate/folder-management-pc-1280-top.png), [PC cuối](candidate/folder-management-pc-1280-bottom.png).
- Chỉ chạy browser case `workspace-redesign-synthetic-layout-menus-editor-and-compose`: PASS; không chạy lại benchmark hoặc toàn bộ suite. Thay đổi không đụng API/auth/Firestore; PR #39 bỏ phần rename khỏi frontend/backend và test của nó. Rename giữ riêng ở draft PR #40, fixture 32/32 PASS; cloud runtime/Firestore qualification còn thiếu. Project/quota blocker cũ không được thử lại, billing/IAM/Production không đổi.
- Screenshot Chromium headless với dữ liệu tổng hợp; không xác minh S25 Ultra/iPad thật, bàn phím OS hay IME.

## Review incremental sau hai sửa

- Key4/key5, model `gemini-3.5-flash-lite`, mỗi key một lượt, chạy song song (concurrency 2); wrapper help xác nhận `--key key4/key5`, cả hai exit 0, không timeout/retry. Thời gian batch đo từ hai exec/wait khoảng 2.7 s; duration tách từng key không có số đo wrapper đáng tin cậy.
- Key4 cảnh báo textarea có thể co quá mức khi viewport/keyboard cực thấp, popup vượt viewport, và cần kiểm chứng click thực. Đã thêm min-height fallback 40 px; menu định vị tính theo visual viewport, giới hạn chiều cao theo vùng trống. Browser kiểm rectangle của hàng đầu/hàng cuối và thao tác cuối rồi click thật ở 390×844, 744×1133, 1280×720; các nút được assert visible ngay trước click. Bàn phím OS/device thật vẫn chưa thử.
- Key5 nhắc không gọi text-only review là xem ảnh; Codex tự mở bảy PNG tổng hợp cập nhật bằng image viewer. Bổ sung assert checklist rỗng `display:none`, checklist có mục có vùng cuộn; kiểm bounds hàng đầu/cuối ở cả ba viewport. Key4/5 không xem pixel.
- Kết quả test liên quan: `BROWSER_ONLY=workspace-redesign-synthetic-layout-menus-editor-and-compose npm run test:browser` PASS (khoảng 12.5 s); `npm run check:source` PASS, 49 file; `node --check scripts/browser-smoke.mjs` và `git diff --check` PASS. Không chạy benchmark hoặc toàn suite.
- Rename không còn trong diff UI PR #39. Backend/API/repository và fixture tests được giữ ở [draft PR #40](https://github.com/hunghvt-cyber/web-notes/pull/40), chưa qualification Vercel OIDC/Cloud Firestore. Không thử lại GCP project/quota và không thay billing/IAM/Production.
