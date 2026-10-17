# Kiểm thử và bằng chứng

## Sau khi tách

`npm test` dùng WebDAV giả lập: backend/HTTP adapter, lock hết hạn, lỗi kết nối,
retry/idempotency, ghi đồng thời, checklist, Unicode, folder, share/revoke,
snapshot-bound restore và thất lạc response trong từng bước init.
Hai test mới kiểm secret độc lập và giới hạn URL; OIDC từ chối repo backup cũ,
push và ref không được phép. Đây **không phải benchmark Koofr thật**.

Kết quả local sau tách ngày 17/10/2026: **76/76 pass, 0 fail, 0 skip**,
Node.js 24; syntax check hai API và hai live drivers pass. Bộ này gồm 74 test
lab và 2 test mới, không gồm 11 test legacy conformance/parser rclone ngoài lab.

CI mới phải được xác minh từ Actions của repo này. Lỗi billing của repo backup
không phải bằng chứng lỗi test; repo public cũng chưa đảm bảo hết mọi account block.

## Bằng chứng live trước khi tách (không tái gán cho code mới)

- Source `44b48edb`, run `39002578699`: 100 Notes gốc, 41 stages,
  restore 104 records gồm 100 active và 4 tombstones. Save 15 mẫu:
  p50 2093 ms, p95/max 5296 ms.
- Source `1245e4c2`, run `39020640005`: 13 fault cases/14 TLS injections;
  50 cặp ghi cùng Note và 50 cặp khác Note; 150 replay operation IDs.
  Save 150 mẫu: p50 2176 ms, p95 4799 ms, max 7728 ms.
- Source restore/API mới `8e4d4af3`: 85 local simulation tests từng pass;
  live run `39022865357` bị chặn trước khi chạy vì billing/spending GitHub.

Các run gốc thuộc repo backup riêng tư. Không copy raw artifacts/logs vào repo
public; số liệu trên chỉ là tóm tắt lịch sử, không chứng minh bản tách mới đạt live.

## Gate trước tích hợp giao diện

Chạy qualification (100 Notes + restore + API) và reliability (faults + hai
deployment) trên đúng SHA đã deploy, lưu source SHA/run ID và kết quả tổng hợp.
Kiểm không lost update/double commit, revoke trước replay, retry sau timeout,
restore không reset dữ liệu. Không đạt bất kỳ gate an toàn nào thì dừng.
Sau đó mới xây frontend/bản nháp/hiển thị đồng bộ; production vẫn cần duyệt riêng.
