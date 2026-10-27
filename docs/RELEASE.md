# Hồ sơ phát hành Notes

## Alias production đã đối chiếu 22/10/2026

| Mục | Giá trị |
| --- | --- |
| URL | https://hunghvt-notes.vercel.app/ |
| Nhánh | `release/minimal-notes`; main không phải source release |
| Source | `09bf7dd4a955d715680b2a7cf758705b04be9875` (merge PR #13) |
| Deployment | `dpl_7Fv3KcsC2HYJCMBsS1Joct2rpGXL`, READY, production, alias khớp |
| Project / region | `hunghvt-notes` / `fra1` |
| Phạm vi kiểm | Đọc metadata Vercel và source; không đọc/ghi/xóa Notes thật |

Các cập nhật sau mốc `9f504aa`: [dấu chia sẻ/thao tác thư mục](FOLDER-SHARE-CONTROLS-20261020.md),
[copy lại link](SHARE-LINK-COPY-20261020.md), UX copy/thu hồi ở PR #12,
ẩn link Homepage trong shared view ở [PR #13](https://github.com/hunghvt-cyber/web-notes/pull/13).
Xem từng hồ sơ để biết CI fixture và smoke có giới hạn; không áp số test cũ cho source mới.
Koofr vẫn là nguồn thật, IndexedDB giữ nháp; không fallback Blob/NAS hoặc tự phục hồi
bằng cache. Đọc [AGENTS](../AGENTS.md) trước bảo trì.

## Các mốc trước — bằng chứng lịch sử, không phải source hiện tại

Phần dưới giữ nguyên hồ sơ trước đó. Khi xác định alias hiện tại, dùng bảng trên.
Không chạy lại provision, migration hoặc rollback Blob theo các bước cũ.

# Trạng thái phát hành hiện tại — 20/10/2026

## Production đã đối chiếu

| Mục | Giá trị |
| --- | --- |
| URL | https://hunghvt-notes.vercel.app/ |
| Repository / nhánh | hunghvt-cyber/web-notes / `release/minimal-notes` |
| Source production | `9f504aa7266b2930f8fa233da7ad619bf7e8e13e` |
| Deployment | `dpl_Ekqfjjmry38BQvYkGWw2BH5MnS6U` — READY |
| Project | `hunghvt-notes` — `prj_c4sEp6nB4msWTsPiGoALSuVutVTK` |
| Team | `team_gCsQcRiaCja0GafKj8JZLINI` |
| Region / dữ liệu | `fra1` / Koofr WebDAV |

Mốc trên được kiểm tra lại qua metadata Vercel lúc cập nhật tài liệu. Không tự suy
đoán source từ `main`, CI xanh hoặc commit tài liệu mới. Repo không tự động gắn với
production; thay đổi tài liệu lần này không yêu cầu deploy hoặc thay đổi dữ liệu.
Homepage Notes cũ đã nghỉ; không dùng Blob hay URL cũ để rollback.

## Các mốc mới

| Source | Nội dung |
| --- | --- |
| `06b1709` (merge PR #9) | Giảm vòng khóa dư, đọc nội dung ngoài hai snapshot ngắn, loading và retry lệch nhịp |
| `9f380b9` | Chỉ đọc danh sách link khi mở Chia sẻ Note |
| `9f4c914` | Ưu tiên lưu/mở trước tải nền, gộp GET, kiểm tra quyền chia sẻ gọn; bảng khôi phục thu gọn |
| `c4fc2d3` | Xóa vĩnh viễn đã chọn trong Thùng rác, xác nhận và tiếp tục khi gián đoạn |
| `9f504aa` | Hai nút Chọn tất cả / Bỏ chọn tất cả, bỏ chữ “đang hiển thị” |

Chi tiết giao thức, ranh giới xóa và hạn chế: [RELEASE-20261020.md](RELEASE-20261020.md).

## Phân biệt bằng chứng

- CI tại `1f1f763` (run `39294852089`) đã đạt 127 kiểm thử Node, 17 mô phỏng tải,
  11 kịch bản Chromium. Đây là fixture, không phải 60 người thật hay Safari/iPad thật.
- Người dùng sau đó cho phép deploy ngay và yêu cầu dừng kiểm thử thêm. Các follow-up
  mới được kiểm tra cú pháp/diff; CI push tự động vẫn cấu hình, nhưng không dùng kết
  quả cũ để chứng nhận các tính năng mới.
- Đã xác minh source/alias/READY của production. Chưa đo lại tốc độ Koofr thực tế,
  chưa chứng nhận 10 người sửa + 50 người đọc, chưa chạy xóa thật để kiểm chứng purge.
- Không đọc/ghi/xóa Notes thật khi cập nhật tài liệu. Bảo trì giao diện không cho phép
  tự bấm xóa vĩnh viễn hay thay đổi các hệ thống bên ngoài repo này.

## Quyết định hiện hành

Giữ Koofr + Vercel, không thêm NAS/database/Blob làm backend Notes. Ưu tiên đọc và
lưu thành công, giữ nội dung chưa đồng bộ, không báo Đã lưu sớm và không tự ghi đè
xung đột. Nhịp nền phải nhường việc chính nhưng không bỏ kiểm tra quyền chia sẻ.
Đừng chạy thêm load benchmark nếu người dùng chưa yêu cầu lại.

Hướng còn lại: giảm yêu cầu thừa dựa trên thời gian thao tác thực tế trong log đã
lược dữ liệu riêng tư; giữ khóa/fencing/CAS/ACL. Không khẳng định animation hay retry
đã loại bỏ nút thắt khóa toàn kho. Không mở rộng phạm vi sang NAS/Homepage/GAS/
Supabase/chi tiêu/Gemini khi bảo trì Notes.

## Hồ sơ lịch sử ngày 18/10 — không phải hướng dẫn rollback hiện hành

# Bản tối thiểu dùng thật

Người dùng đã cho phép triển khai ngày 18/10/2026, giữ Vercel Blob để rollback.
Project Vercel riêng: `hunghvt-notes`, ID `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`.
Nhánh phát hành: `release/minimal-notes`. Không dùng project Homepage hay lab
để chứa credential/data production của Notes mới.

## Phạm vi

Giao diện tiếng Việt: grid theo màn hình, editor chỉ mở khi chọn/tạo Note,
checklist, thư mục, ghim, copy/xóa nội dung/hoàn tác, lịch sử 5 bản, chia sẻ và
thu hồi, tải backup. Share token nằm trong fragment URL, gửi bằng Bearer header;
không đặt vào query API hoặc local draft.

IndexedDB giữ riêng bản nháp từng phiên soạn. Mỗi lần lưu giữ payload, base revision
và operation ID bất biến trước khi gửi. Timeout/reload retry đúng operation đó.
Chữ nhập trong khi chờ ack vẫn giữ; bản nháp xung đột không tự ghi đè server.
Khôi phục bản nháp tạo bản sao trong phiên mới, bản nháp gốc được giữ cho đến
khi người dùng chủ động bỏ. Có thể tải bản nháp ra file khi IDB gần đầy.

IndexedDB có thể bị hệ điều hành/trình duyệt xóa. Chữ chưa đồng bộ chưa phải
backup; UI không báo đã xác nhận lưu khi mới ghi cục bộ. Chưa có chứng nhận
Safari/iPad thật cho tới khi người dùng kiểm tra thiết bị thực tế.

## Điểm cấu hình phải hoàn tất

Các cấu hình không nhạy cảm và session secret đã được agent đặt server-side.
Người dùng nhập trực tiếp 3 secret trong Vercel Production:

- `KOOFR_NOTES_USER`: tài khoản Koofr dùng với app password WebDAV riêng.
- `KOOFR_NOTES_APP_PASSWORD`: app password đã dùng cho Notes, không mật khẩu chính.
- `NOTES_PASSWORD`: mật khẩu mở ứng dụng Notes, 12–256 ký tự.

Không yêu cầu gửi secret qua chat. GitHub Actions secrets không thể đọc ngược
để tự chuyển vào Vercel; không dùng export credentials hoặc cấu hình rclone.
Preview không được cấu hình namespace production; appConfig từ chối truy cập
root thật khi target Preview. Khi thiếu secret, API đóng và UI báo chờ kết nối.

Cập nhật 18/10/2026: cả 3 secret đã có target Production, type sensitive.
Agent chỉ kiểm metadata, không đọc giá trị; đã redeploy và đăng nhập bằng
biểu mẫu browserAuth bảo mật, không nhận mật khẩu trong chat.

## Dữ liệu cũ và rollback

Kho Koofr mới được tạo ở đúng namespace đã cấu hình bằng marker/LOCK; retry
không reset catalog đã có. Chưa tự nhập Notes từ Blob và chưa đổi lối tắt
Homepage. Giao diện nói rõ kho cũ vẫn ở Homepage; không trình bày kho trống
như một migration thành công.

Trước khi chuyển dữ liệu cũ: lấy bản xuất riêng tư, kiểm số lượng, IDs, nội dung,
checklist, thư mục và chia sẻ; lưu hash đối chiếu. Nếu Blob đang bị chặn hoặc
không xuất được dữ liệu thì dừng migration, không lấy cache preview thay bản gốc.

Rollback ứng dụng: quay lại URL Notes cũ và deployment Homepage đã giữ nguyên.
Blob là bản dữ liệu cũ, **không tự có các chỉnh sửa mới trên Koofr**. Trước khi
quay lại dùng Blob để ghi, tải snapshot Koofr và nháp, đối chiếu/nhập những thay
đổi mới; không tuyên bố chỉ đổi URL là rollback dữ liệu đầy đủ.

## Backup và khôi phục

Nút Tải backup đọc snapshot nhất quán (catalog chụp dưới LOCK + immutable heads),
kiểm hash và trả file cho chủ sở hữu. Giới hạn hiện tại 2 MB tổng snapshot;
nếu quá giới hạn, UI báo lỗi, không cắt dữ liệu. Lưu file tải xuống nơi riêng.

Backend restore đã được kiểm thử vào root mới. Bản tối thiểu chưa cung cấp nút
restore đè kho đang chạy, chưa có lịch backup/retention độc lập tự động. Khi cần
khôi phục, dùng snapshot đã decode/verify, ghi snapshot vào source riêng, gọi
initRestore/restoreBatch sang một root mới và đối chiếu toàn bộ trước khi đổi
NOTES_DATA_NAMESPACE. Không thay file catalog production bằng thao tác PUT tay.

## Gate phát hành

Bằng chứng đã có ngày 18/10/2026: 90/90 unit/integration tests pass; 6/6 Chromium
scenarios pass tại [run 39057457895](https://github.com/hunghvt-cyber/web-notes/actions/runs/39057457895).
Kho mới được khởi tạo thật tại [run 39057321414](https://github.com/hunghvt-cyber/web-notes/actions/runs/39057321414),
count 0, không migration dữ liệu cũ. JSON kết quả đã chọn lọc tại docs/results.

Deployment đầu project riêng được Vercel gán target production:
`dpl_7rdKgAjtDKryMVMApjyQHj2ZMY9B`, source
`e4bf6d2f478f29acbb8954c07031fa11ba3c85a3`, URL
`https://hunghvt-notes.vercel.app/`. Health 200/configured false; owner route 503
NOTES_AUTH_MISSING; benchmark route 404. Đây là shell đang đóng, chưa phải
deployment đã được xác minh đọc/ghi production. Sau khi thêm secret phải redeploy
và kiểm tra lại; không chỉ refresh trình duyệt.

Browser suite dùng API handler thật nhưng chặn request trong Playwright để mô
phỏng WebDAV. Tình huống offline kiểm dữ liệu IndexedDB sau reload, public shell
do harness cung cấp; chưa chứng minh mở lại trang khi mất hoàn toàn internet.

`npm test`, `npm run test:browser` và CI phải đạt. Browser test dùng Chromium thật
với HTTP handler thật và WebDAV mô phỏng; tách khỏi live Koofr evidence trước đó.
Sau khi đủ secret, tạo deployment target production, kiểm health/login/CRUD/share/
backup trên Note smoke riêng và đối chiếu readback rồi mới tuyên bố bản dùng thật
hoạt động. Ghi source SHA/deployment ID, không ghi nội dung thật vào report public.

## Triển khai Production đã xác minh ngày 18/10/2026

- URL: https://hunghvt-notes.vercel.app/
- Deployment READY/production: `dpl_BNPiGYePB3ecjsZF6Uo8BcGiNZjy`.
- Source: `34be6a30a1ea6865081937cd8ac71b6d867ce299`; đối chiếu Git blob hash
  toàn bộ 21 file triển khai trước khi gửi Vercel.
- Health 200/configured true; owner Notes và backup chưa đăng nhập trả 401;
  benchmark route trả 404. Preview health vẫn đóng/configured false.
- Browser thực gọi Vercel → Koofr thực: đăng nhập, tạo/lưu Unicode + checklist,
  reload và đọc lại, tạo thư mục, cập nhật Note vào thư mục và đánh dấu checklist.
- Tạo link sửa, mở phiên chia sẻ, sửa và nhận xác nhận lưu; owner reload đọc lại
  nội dung sửa. Thu hồi link, phiên chia sẻ bị từ chối với mã hỗ trợ.
- Tải snapshot thật 3.929 byte, decodeSnapshot xác minh hash tổng và hash các
  head; đối chiếu title, Unicode, checklist checked/text và folder trong catalog.
  1 Note active, lịch sử 2 bản tại thời điểm snapshot. Không đưa snapshot,
  capability token, credential hay runtime log thô vào repository public.
- Ba lần owner save trong log API: 3.025, 6.447 và 7.400 giây; save qua link
  chia sẻ 4.042 giây (server duration). Không có lỗi lưu trong smoke này.
  Đây là smoke nhỏ, không phải p50/p95, benchmark iPad hay cam kết độ trễ.
- CI source phát hành đã success tại run `39057766989`; bằng chứng browser mô
  phỏng và live qualification cũ vẫn phân biệt như phần trên.

Bản tối thiểu đã đọc/ghi thật trên project riêng. Không migration Blob, không
đổi Homepage, NAS, GAS hoặc workflow backup khác. Rollback dữ liệu vẫn cần đối
chiếu các thay đổi mới trên Koofr; không có tự đồng bộ ngược về Blob.

Note giả lập đã xóa mềm sau kiểm thử; không purge file/history/tombstone.
Link thử đã thu hồi. Snapshot trước khi xóa đã tải trong phiên kiểm thử,
không phải backup tự động của các Notes người dùng sẽ tạo về sau.
Lần dọn thư mục đầu nhận 423 BUSY; không có ghi đè. Thử lại sau đó thành công,
UI không còn thư mục thử. Phản hồi khóa bận không được tính là lần thành công.
