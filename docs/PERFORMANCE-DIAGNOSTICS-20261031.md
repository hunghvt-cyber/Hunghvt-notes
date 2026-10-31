# Ghi nhận tốc độ Notes — 31/10/2026

## Phạm vi

Đây là instrumentation chẩn đoán, không phải tối ưu. Nó được tắt mặc định và
chỉ bật trên thiết bị hiện tại khi mở trang với `?diag=1`. Không gọi endpoint
phụ, không gửi telemetry và không ghi dữ liệu vào storage. Bộ đệm ở RAM, giữ tối
đa 120 mẫu và tối đa 8 trace đang chạy; tải lại trang sẽ xóa mẫu. Bản xuất do
người dùng chủ động sao chép, duration được làm tròn tới 1 ms.

Bản tổng hợp chỉ có loại thao tác, trạng thái editor `clean`/`dirty`, cache
`hit`/`miss`, enum lý do cache miss, số request, duration và mã HTTP lỗi trong allowlist. Không xuất
nội dung, title, ID, folder, token, URL, timestamp hoặc session. Instrumentation
không render lại theo từng phím; khi tắt, listener nhập liệu không được gắn và
đồng hồ không được đọc trong API client hay `SyncDraft`; callback `onMeasure` mặc định là `null`.

## Mốc đo

- `list`: đọc cache IndexedDB và dựng danh sách cache; sau đó request danh sách
  server và dựng danh sách đã đồng bộ. `cache_read_ms` gồm IndexedDB read, lọc/kiểm tra và hydrate state, dừng trước `render_ms`; thời gian render danh sách được tách riêng.
- `open_note`: `guard_wait_ms`, cache hit/miss của nội dung, enum lý do miss (`entry_absent`, `revision_mismatch`, `missing_from_list`, `note_too_large`, `content_budget_eviction`, `shared_content_disabled`, `cache_unavailable`), request count,
  guard wait, click→lần gán nội dung đầu tiên và frame kế tiếp. Cache hit vẫn xác minh revision ở nền; phần gán revision nền được ghi riêng, không kéo dài mốc click→nội dung. Không dùng `flow_total_ms` để đại diện thời gian mở note.
- `new_note`: chờ guard hiện hành và gán nội dung vào editor.
- `save`: debounce từ input cuối tới lúc bắt đầu lưu, phần tạo request/guard,
  queue wait, thời gian fetch/body, retry wait và input→ACK hợp lệ đúng một lần cho session/version được ACK. Nếu có gõ thêm lúc request đang chạy, ACK bản đóng băng trước không được gán cho phiên bản input mới; phiên bản mới chỉ được đo ở ACK kế tiếp.

`frame_after_update_ms` chỉ là thời gian tới callback frame sau khi nội dung đã
được gán. Nó không biểu thị lúc bàn phím xuất hiện hay editor/IME sẵn sàng.
Server ACK được tính khi API trả body có ACK; trạng thái **Đã lưu** vẫn theo logic
ACK/CAS hiện tại.

## Thu thập thủ công trên điện thoại/iPad

Sau khi instrumentation có mặt trên deployment được phép đo:

1. Mở Notes như bình thường, thêm `?diag=1` vào URL, đăng nhập.
2. Đợi danh sách hiện; mở note được cập nhật gần nhất và chờ kiểm tra xong.
3. Tạo note mới, gõ nội dung. Dừng gõ sau ký tự cuối và đợi trạng thái **Đã lưu**.
4. Chạm **Sao chép tổng hợp** ở bảng đo. Nếu clipboard bị chặn, chọn ô tổng hợp
   hiện ra rồi sao chép. Gửi riêng JSON tổng hợp; không gửi screenshot, URL hay
   bản nháp. Có thể xóa mẫu bằng **Xóa mẫu**.

Đo cache lạnh trong browser profile chưa từng mở Notes; đo cache ấm bằng cách
reload cùng profile. Không xóa dữ liệu site hiện có vì có thể chứa bản nháp.
Đánh giá phone và iPad riêng, editor sạch và dirty riêng. Không gộp số đo giả
lập với thiết bị thật.

## Giới hạn hiện tại

Phép đo client bắt đầu sau bước xác thực/mở khóa; không gán toàn bộ thời gian
trước đó cho thao tác mở note. `network_ms` là fetch từ lúc gọi `fetch` tới khi
nhận response headers; `response_body_ms` gồm nhận body và parse JSON.
Khi instrumentation bật, cùng request đó thêm `Server-Timing` chỉ chứa duration
cho thời gian handler trước khi tạo response, auth, khởi tạo store và store
operation. Các span có thể chồng lên nhau; `store operation` gộp OIDC/Google
SDK/Firestore, không tách riêng thời gian Firestore. `server_pre_response_ms`
chưa gồm serialize JSON body hoặc thời gian platform trước khi hàm chạy. Không
gửi timing ra log/telemetry. Không dùng `network_ms` hoặc
`response_body_ms` để suy ra riêng thời gian server, Homepage auth hoặc Firestore.
Cache lạnh/ấm chỉ phân biệt presence của cache danh sách trên thiết bị; phép đo
này không xóa dữ liệu site và không đại diện cho cold network/cache Firestore.
Chưa có số đo thiết bị thật từ thay đổi này.

Cache nội dung chỉ chứa note đã được server xác nhận trong cùng IndexedDB cache
scope. Giới hạn là 12 note, tổng 1 MiB, tối đa 256 KiB mỗi note. Kích thước là
UTF-8 của `JSON.stringify(note)`, nên gồm title, text, checklist, history, folder
và metadata có trong object. Enum miss phân biệt entry thiếu, revision/list
invalidation, note quá lớn và eviction khi còn bằng chứng trong phiên RAM; không
lưu ID hoặc nội dung trong diagnostics. Nếu entry đã vắng sau reload và nguyên
nhân trước đó không còn trong RAM, phép đo không thể khôi phục nguyên nhân lịch sử.

## CI526 grid fixture

Browser suite hoàn tất, nhưng step `Note card grid row layout regression` dừng tại đợi form login, trước assertion grid. Script fixture chỉ phục vụ allowlist module cũ, thiếu `performance-diagnostics.js` được app import tĩnh; đã thêm module vào fixture và chạy lại: 360/390 px đều qua, metadata không che và không overlap. Đây là lỗi fixture, không phải regression giao diện.

## Gemini review

Gemini chỉ nhận lược đồ đo và tổng số kiểm thử tổng hợp, không nhận response,
log request hay Notes. Review nêu ba điểm: không được diễn giải frame thành
keyboard/editor readiness (đã nằm ngoài phạm vi và được ghi rõ), duration có
thể là side-channel nếu xuất theo từng sự kiện (bản xuất chỉ là thống kê theo
nhóm, làm tròn 1 ms), và các trace đang chạy cần giới hạn riêng bộ đệm đã xong.
Đã giới hạn tối đa 8 trace đang chạy; nút xóa cũng hủy mẫu đang chờ.

## Kiểm tra sau chỉnh sửa finding

- `npm test`: 199/199; `check:source`: 50 file.
- `test/performance-diagnostics.test.mjs` và `test/sync.test.mjs`: 15/15, dùng fake clock để xác nhận duration và input phiên bản ACK; SyncDraft off không đọc clock.
- `npm run test:browser`: 37/37 fixture Chromium; opt-in export xác nhận có `input_to_ack_ms`, `cache_read_ms`, `render_ms` và không có dữ liệu synthetic nhạy cảm.
- Grid smoke sau khi sửa allowlist fixture: 360 px và 390 px pass.
- `git diff --check`: pass. Không chạy deploy.
