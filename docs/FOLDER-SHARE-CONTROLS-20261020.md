# Dấu chia sẻ thư mục và thu hồi — 20/10/2026

## Sử dụng

- Thư mục có ít nhất một link chưa thu hồi hiện dấu 🔗 bên cạnh tên trên thanh thư mục.
- Bấm 🔗 để mở danh sách link và Thu hồi từng link. Có thể mở lại từ Quản lý thư mục → chọn thư mục → Quản lý chia sẻ, kể cả sau tải lại trang.
- Thu hồi hết link thì dấu biến mất. Bảng quản lý vẫn liệt kê các link đã thu hồi. Mở quản lý không tạo link mới. Bản bổ sung sao chép link lưu bản mã hóa cho link mới, cho phép chủ Notes xem/copy lại sau reload. Link cũ chỉ có hash thì không khôi phục được; có nút Tạo link mới cùng quyền, giữ link cũ hoạt động. Xem SHARE-LINK-COPY-20261020.md.
- Trạng thái lấy từ sharedFolders trong cùng snapshot owner bootstrap, không thêm request cho từng thư mục; không lưu trạng thái quyền vào cache ngoại tuyến. Không trả ID/token/hash chia sẻ trong bootstrap. API shared không trả danh sách sharedFolders.
- Giữ nguyên ACL dưới khóa và bảo vệ bản nháp. Rời bảng quản lý không sửa hoặc xóa dữ liệu ghi chú. Thu hồi chỉ ảnh hưởng link được bấm, không tự thu hồi các link khác.

## Bằng chứng

- PR #10: https://github.com/hunghvt-cyber/web-notes/pull/10
- Source production: 9a2f6889ed4163832ebed821851db0f2295c63f2.
- Deployment: dpl_8jSxXadFsikkNAuhQuG5aqeVQ4we, READY, alias https://hunghvt-notes.vercel.app/, project prj_c4sEp6nB4msWTsPiGoALSuVutVTK, team team_gCsQcRiaCja0GafKj8JZLINI.
- CI trên source feature 68367cd5072c035e89fbced4d38bd0f03b44577f: https://github.com/hunghvt-cyber/web-notes/actions/runs/39394494092, jobs test và browser thành công. 129 Node tests và 12 Chromium scenarios; gồm reload, thu hồi nhiều link, giữ dấu khi còn link khác, mất dấu sau link cuối, mở lại quản lý và giữ nội dung đang soạn. Backend của các kiểm thử này là WebDAV giả, không phải dữ liệu Koofr production hoặc Safari/iPad thật.
- Source đã đối chiếu bằng git diff với các file được kiểm thử. Trang production trả HTTP 200, có các control mới; không chạy tạo/thu hồi link trên dữ liệu thực để kiểm thử.
- Commit tài liệu này không phải source deployment. Các checkpoint cũ trong docs/RELEASE.md và AGENTS.md là lịch sử; dùng mốc source/deployment ở trên cho tính năng này.
