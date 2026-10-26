# Kết nối xuất code vào Notes

Ngày 26/10/2026: người dùng yêu cầu kết nối xác thực riêng để agent xuất code vào Notes mà không mở khóa trình duyệt. Không dùng GAS, NAS, Blob hoặc credential backup.

## Phạm vi

- Endpoint production `POST /api/inbox`, đóng mặc định.
- Chỉ nhận danh tính GitHub Actions của repo `hunghvt-cyber/Hunghvt-notes` (repository ID 1423348828, owner ID 252749231), push trên `release/minimal-notes`, workflow `.github/workflows/notes-inbox.yml`, audience `hunghvt-notes-code-inbox-v1`.
- GitHub ký token RS256 ngắn hạn, xác minh JWKS, issuer/audience/subject/ref/event/workflow/IDs/expiry trước khi đọc kho. Không có mật khẩu Notes hoặc Koofr trong Actions.
- Hai slot cho phép: `office-v2` và `office-v2-config`. Chỉ ghi vào hai ID xác định trước trong thư mục **Code từ GitHub**. Không list/export nội dung ghi chú khác, xóa, khôi phục hoặc chia sẻ.
- Ghi đè yêu cầu revision chính xác; replay dùng cùng clientOpId/payload. Không ghi đè vô điều kiện. Ghi chú đã chuyển thư mục/xóa hoặc đích đang chia sẻ bị chặn dưới cùng khóa lưu. Nội dung cũ vẫn có lịch sử như lưu Notes thông thường.

## Luồng dành cho agent

1. Đọc public key `.notes-inbox/public-key.pem` và script `scripts/encrypt-inbox.mjs` ở nhánh phát hành. Key này chỉ mã hóa, không cấp quyền gọi API.
2. Tạo payload local riêng tư: `{action:'save',slot:'office-v2',title:'OFFICE v2 — code mới nhất',text:CODE,revision:null,clientOpId:UUID,expiresAt:Date.now()+3600000}`. Config chỉ dùng bản ví dụ, không credential thật.
3. Mã hóa AES-256-GCM, bọc khóa bằng RSA-OAEP SHA256. Chỉ commit **envelope mã hóa** vào `.notes-inbox/request.json`, tuyệt đối không commit payload/code riêng tư dạng rõ. Input local ở ngoài repo checkout. Mỗi lần mã hóa tạo IV/key ngẫu nhiên; hạn tối đa 24 giờ.
4. Push file envelope trên nhánh phát hành kích hoạt workflow; job lấy OIDC token rồi gửi chính envelope đó sang Vercel. Code gốc repo private không bị chuyển thành plaintext trong repo Notes public.
5. Xem log `Notes authenticated code inbox`: chỉ có HTTP status, managed ID, revision, hash, verified. Không log text, title, envelope, OIDC token hoặc provider response.
6. Chỉ báo đã lưu khi `status:200`, `verified:true` và textHash khớp source. `action:'status'` với slot trả revision/hash, không nội dung; dùng để lấy revision trước lần cập nhật tiếp theo. Nếu 409, không tự đổi revision và ghi đè khi chưa đối chiếu yêu cầu/người dùng.

Agent dùng quyền GitHub đã kết nối để update file envelope; không cần connector Koofr. Workflow chạy trên repo Notes public, không tiêu quota Windows/private của repo Office. Phụ thuộc GitHub runner nên có thể mất vài chục giây hoặc lâu hơn; không cam kết nhanh hơn một lượt lưu Notes đang mở sẵn.

## Cấu hình server

- `NOTES_INBOX_ENABLED=github-oidc-v1` ở Production.
- `NOTES_INBOX_PRIVATE_KEY`: PKCS8 RSA private key, type sensitive, chỉ Production. Public key tương ứng lưu trong repo. Không tái sử dụng session secret hay password Koofr.
- appConfig vẫn ràng buộc project/origin/namespace production như trước. Preview không được vào kho thật. Không thay đổi auth của UI hoặc link chia sẻ.
- Thu hồi ngay: xóa/tắt `NOTES_INBOX_ENABLED`, redeploy Production. Xoay khóa khi cần bằng cặp mới, đổi private env + public PEM, redeploy. Thu hồi quyền push repo cũng chặn khả năng tạo token theo workflow được tin cậy.
- Chỉ người có quyền sửa nhánh/workflow mới gửi được; quyền ghi repo Notes nay là quyền ghi **hai ghi chú managed** này. Không nhận workflow từ PR/fork hoặc ref khác.

## Kiểm chứng

137/137 Node tests đạt trên fixture: OIDC sai key/issuer/audience/ref/repo/workflow/thời hạn; envelope sửa/hết hạn; không auth không chạm kho; Unicode/hash; CAS/replay; note ngoài scope giữ nguyên; chặn ghi vào folder chia sẻ. Đây không phải live Koofr evidence. Kết quả deployment/live publish được ghi bổ sung sau khi chạy thật.
