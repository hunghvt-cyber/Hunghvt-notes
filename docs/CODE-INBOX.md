# Kết nối xuất code vào Notes

Ngày 26/10/2026: người dùng yêu cầu kết nối xác thực riêng để agent xuất code vào Notes mà không mở khóa trình duyệt. Không dùng GAS, NAS, Blob hoặc credential backup.

## Phạm vi

- Endpoint production `POST /api/inbox`, đóng mặc định.
- Chỉ nhận danh tính GitHub Actions của repo canonical `hunghvt-cyber/web-notes` (repository ID 1423348828, owner ID 252749231), push trên `release/minimal-notes`, workflow `.github/workflows/notes-inbox.yml`, audience `hunghvt-notes-code-inbox-v1`. Token subject dùng repo name hiện tại; WIF binding phải được kiểm lại sau rename.
- GitHub ký token RS256 ngắn hạn, xác minh JWKS, issuer/audience/subject/ref/event/workflow/IDs/expiry trước khi đọc kho. Không có mật khẩu Notes hoặc Koofr trong Actions.
- Ba slot cho phép: `office-v2`, `office-v2-config`, `excel-to-txt`. Chỉ ghi vào ba ID xác định trước trong thư mục **Code từ GitHub**. Không list/export nội dung ghi chú khác, xóa, khôi phục hoặc chia sẻ.
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
- Chỉ người có quyền sửa nhánh/workflow mới gửi được; quyền ghi repo Notes nay là quyền ghi **ba ghi chú managed** này. Không nhận workflow từ PR/fork hoặc ref khác.

## Kiểm chứng

137/137 Node tests đạt trên fixture: OIDC sai key/issuer/audience/ref/repo/workflow/thời hạn; envelope sửa/hết hạn; không auth không chạm kho; Unicode/hash; CAS/replay; note ngoài scope giữ nguyên; chặn ghi vào folder chia sẻ. Đây không phải live Koofr evidence. Kết quả deployment/live publish được ghi bổ sung sau khi chạy thật.


## Phát hành và xuất code thật — 26/10/2026

- PR #14 đã merge; source runtime `a258ffc5ca309d16c71c7f0e1a6348efea8fb7e1`.
- Vercel Production READY: `dpl_2rdgnmV8TFDZp6HvzaaumLrFMHF7`, alias `hunghvt-notes.vercel.app`, project `prj_c4sEp6nB4msWTsPiGoALSuVutVTK`, fra1.
- CI feature source `87d1729`: run `40282238105` và `40282242605`, Node và Chromium fixture jobs SUCCESS. Local Node 137/137; local Chromium không tải được do mạng, dùng kết quả CI. Không có benchmark tải Koofr mới.
- Health production 200/configured true; GET inbox 405 đúng thiết kế chỉ POST.
- Live export run `40282545032` SUCCESS: OIDC thật → Vercel → Koofr thật. API trả status 200/verified true; hash readback khớp nguyên source GitHub (15.922 byte UTF-8). Không ghi code gốc, payload rõ hoặc credential vào repo Notes public.
- Ghi chú được tạo trong **Code từ GitHub**, tên **OFFICE v2 — code mới nhất (bản thử)**. Mã v2 vẫn chưa được chứng nhận chạy đúng trên Windows/SSO thật; kết quả xuất Notes không thay thế kiểm thử AHK.
- README và tài liệu có thể mới hơn source runtime, không đồng nghĩa redeploy. Không sửa hoặc xóa ghi chú sẵn có để kiểm thử.


## Gửi lại ghi chú đã xóa mềm — 26/10/2026

Theo yêu cầu gửi lại code sau khi lỡ xóa: status của hai slot managed trả deleted/revision/hash nếu còn trong Thùng rác. Save chỉ khôi phục khi payload ghi rõ restoreDeleted:true và revision khớp. Không hồi sinh note đã purge/đang purge, không khôi phục note ngoài scope hay tự khôi phục mọi lần save. Kiểm tra thư mục/chia sẻ vẫn chạy dưới khóa. Không cấp thao tác xóa mới. Đã bổ sung fixture cho trạng thái xóa, yêu cầu bật cờ rõ ràng, revision sai và khôi phục đúng.


## Tách đích Excel qua txt — 27/10/2026

Theo yêu cầu người dùng, code xuất Excel phải lưu vào note mới tên **Excel qua txt**, slot `excel-to-txt`. Không dùng lại `office-v2` hoặc `office-v2-config` cho nội dung khác mục đích. Người dùng yêu cầu không khôi phục note cũ; không chỉnh sửa các note cũ trong lần gửi này. Lần tạo mới dùng `revision:null` và phải dừng nếu xung đột, không tự lấy revision để ghi đè note có sẵn.

Focused inbox fixture tests đạt 4/4; dependency iron-session không có ở local nên loader chỉ thay import session bằng hàm ném lỗi nếu được gọi; các test inbox không gọi session. Không coi là full suite hoặc live evidence. Kiểm tra mới xác minh note Excel có ID khác và giữ nguyên nội dung note Office, từ chối tạo lại với revision null.
