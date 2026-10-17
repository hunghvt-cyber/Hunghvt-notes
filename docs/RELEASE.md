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

`npm test`, `npm run test:browser` và CI phải đạt. Browser test dùng Chromium thật
với HTTP handler thật và WebDAV mô phỏng; tách khỏi live Koofr evidence trước đó.
Sau khi đủ secret, tạo deployment target production, kiểm health/login/CRUD/share/
backup trên Note smoke riêng và đối chiếu readback rồi mới tuyên bố bản dùng thật
hoạt động. Ghi source SHA/deployment ID, không ghi nội dung thật vào report public.
