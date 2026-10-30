# Ghi nhận tốc độ Notes — 31/10/2026

## Phạm vi

Đây là instrumentation chẩn đoán, không phải tối ưu. Nó được tắt mặc định và
chỉ bật trên thiết bị hiện tại khi mở trang với `?diag=1`. Không gọi endpoint
phụ, không gửi telemetry và không ghi dữ liệu vào storage. Bộ đệm ở RAM, giữ tối
đa 120 mẫu và tối đa 8 trace đang chạy; tải lại trang sẽ xóa mẫu. Bản xuất do
người dùng chủ động sao chép, duration được làm tròn tới 1 ms.

Bản tổng hợp chỉ có loại thao tác, trạng thái editor `clean`/`dirty`, cache
`hit`/`miss`, số request, duration và mã HTTP lỗi trong allowlist. Không xuất
nội dung, title, ID, folder, token, URL, timestamp hoặc session. Instrumentation
không render lại theo từng phím; khi tắt, listener nhập liệu không được gắn và
đồng hồ không được đọc trong API client hay `SyncDraft`.

## Mốc đo

- `list`: đọc cache IndexedDB và dựng danh sách cache; sau đó request danh sách
  server và dựng danh sách đã đồng bộ. `cache_read_ms` gồm đọc và kiểm tra cache.
- `open_note`: `guard_wait_ms`, cache hit/miss của nội dung, request count,
  queue wait, fetch-to-response-header, JSON body, gán nội dung và frame kế tiếp.
- `new_note`: chờ guard hiện hành và gán nội dung vào editor.
- `save`: debounce từ input cuối tới lúc bắt đầu lưu, phần tạo request/guard,
  queue wait, thời gian fetch/body, retry wait và input-cuối-tới-ACK hợp lệ.

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
nhận response headers; `response_body_ms` đo parse JSON. Không dùng chúng để
suy ra riêng thời gian server, Homepage auth hoặc Firestore. Chưa có số đo thiết
bị thật từ thay đổi này. PR chỉ thêm instrumentation; không thay đổi giao diện
mặc định, auth, CAS, ACK, retry, backend hoặc Production.

## Gemini review

Gemini chỉ nhận lược đồ đo và tổng số kiểm thử tổng hợp, không nhận response,
log request hay Notes. Review nêu ba điểm: không được diễn giải frame thành
keyboard/editor readiness (đã nằm ngoài phạm vi và được ghi rõ), duration có
thể là side-channel nếu xuất theo từng sự kiện (bản xuất chỉ là thống kê theo
nhóm, làm tròn 1 ms), và các trace đang chạy cần giới hạn riêng bộ đệm đã xong.
Đã giới hạn tối đa 8 trace đang chạy; nút xóa cũng hủy mẫu đang chờ.
