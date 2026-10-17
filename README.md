# Hunghvt Notes

Project Notes độc lập, hiện ở giai đoạn **backend prototype / synthetic preview**.
Chưa có giao diện soạn thảo độc lập. Chưa dùng cho dữ liệu thật.

Homepage Notes production vẫn dùng Vercel Blob. Repo này không chứa báo cáo NAS,
backup Actions, cấu hình Google/rclone hay dữ liệu Notes thật; không kết nối tự động
với deployment production. Không chuyển repo backup thành public.

## Chạy kiểm thử

Node.js 24:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Các test trên dùng backend WebDAV giả lập, không gọi Koofr hay Google.
CI tự chạy trên push/PR, runner chuẩn ubuntu-24.04, không cần secret.

Live qualification ngày 17/10/2026 đã đạt: 100 Notes, 51 stages, restore 104
records đúng byte; reliability đạt 13 lỗi transport và 100 cặp ghi đồng thời
qua hai preview. [Bằng chứng và giới hạn phép đo](docs/TESTING.md).
Đạt các gate backend này để tiếp tục tích hợp UI Preview; chưa production-ready.

## Cấu trúc

- `lib/`: Note, checklist, folder, ACL, revision, chống ghi đè và restore.
- `api/preview.js`: owner/share API thử nghiệm, mặc định đóng.
- `api/bench.js`: fixture qua GitHub OIDC, chỉ namespace giả lập của run đó.
- `test/`: CRUD, concurrent writers, thu hồi, hết hạn lock, lỗi mạng và restore.
- `scripts/`: hai suite thật qua Vercel; không có endpoint mặc định.
- `public/`: trang thông báo lab, chưa phải ứng dụng Notes.
- [Kiến trúc và rủi ro](docs/ARCHITECTURE.md).
- [Triển khai thử, secrets, backup và rollback](docs/DEPLOYMENT.md).
- [Bằng chứng và giới hạn kiểm thử](docs/TESTING.md).
- [Ý tưởng sắp xếp bằng phím mũi tên](docs/NOTES-IDEAS.md).

## Phạm vi lần tách repo

Mã backend được chọn lọc từ prototype riêng trước đó, source commit
`8e4d4af37de24cd30bc6b6603593626299ca5c3c`. Đây là lịch sử Git mới,
không import lịch sử, secret hoặc artifacts của repo backup. Giữ 74 test của lab,
thêm 5 test ranh giới repo, driver và lọc bằng chứng; danh tính OIDC được kiểm
theo định dạng immutable có owner/repository ID dành cho repo mới.
Không mang 11 test conformance cũ phụ thuộc parser cấu hình backup sang đây.

Thay đổi đang ở PR riêng, đã có hai deployment Preview của dedicated Koofr lab.
Workflow nhánh chỉ chạy live khi commit mang marker được chỉ định; fixture có
hạn thử nghiệm tuyệt đối. Không có lịch chạy nền hoặc cắt chuyển production.
