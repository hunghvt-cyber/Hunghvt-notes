# Kiểm thử và bằng chứng

Các mục dưới lưu bằng chứng theo từng thời điểm. Xem [RELEASE.md](RELEASE.md)
để biết checkpoint CI gần nhất và giới hạn kiểm chứng của mã đang chạy;
không áp dụng kết quả cũ cho các commit mới hơn.

## Sau khi tách

`npm test` dùng WebDAV giả lập: backend/HTTP adapter, lock hết hạn, lỗi kết nối,
retry/idempotency, ghi đồng thời, checklist, Unicode, folder, share/revoke,
snapshot-bound restore và thất lạc response trong từng bước init.
Các test mới kiểm secret độc lập, giới hạn URL, khởi tạo driver, lọc bằng chứng
public và OIDC. OIDC từ chối repo backup cũ, owner ID sai, subject cũ và workflow/
ref không được phép. Đây **không phải benchmark Koofr thật**.

Kết quả local sau tách ngày 17/10/2026: **79/79 pass, 0 fail, 0 skip**,
Node.js 24. Bộ này gồm 74 test lab và 5 test mới, không gồm 11 test legacy
conformance/parser rclone ngoài lab.

CI simulation của repo public đã chạy thành công. Lỗi billing ở repo backup
không còn chặn các run CI đã xác minh tại repo này.

## Qualification thật sau khi tách

[Run 39045843870](https://github.com/hunghvt-cyber/Hunghvt-notes/actions/runs/39045843870),
job qualification `117434276889`: **51/51 stages pass**, xác minh 100 Notes,
khôi phục 104 records đúng byte (100 active + 4 tombstones). Các lỗi mất response
khi init restore, target không có marker, replay sau restore, UUID/Unicode lớn,
owner/share API và thu hồi đều đạt. Chi tiết đã lọc trong
[kết quả qualification](results/2026-10-17-qualification.json).

Deployed source `f7ce12b21994283473454cadd3a076f9ed4c0b1d`, driver
`9b5599a6ced863c00c4a286f8538897d16cc9734`. Hai preview cùng source SHA,
đều target Preview trong dedicated Koofr lab. Credentials chỉ truyền trong
request có OIDC, không lưu vào Vercel env hoặc artifacts.

Save committed 20 mẫu: p50 1781 ms, p95 2985 ms, max 3724 ms. List 10 mẫu:
p50 199 ms, p95 1013 ms; get 33 mẫu: p50 367 ms, p95 1567 ms.
Đây là timer operation bên trong Vercel trên dữ liệu giả lập, không phải thời
gian người dùng iPad nhìn thấy xác nhận lưu. Error codes conflict/quyền bị từ
chối trong suite là các negative test có chủ đích, không phải timeout ngẫu nhiên.

Standalone HTTPS smoke: health 200/configured false, owner notes 503 như thiết kế.
API fixture gọi cùng handler HTTP với Koofr thật; chưa thử login/cookie trên
trình duyệt với standalone API đã bật.

## Mất mạng và nhiều preview thật sau khi tách

Cùng run `39045843870`, job `117434276991`: **success**.
Hai preview cùng source SHA: `dpl_GXGYK3i95UXHktV2afuv3sERxCFy` và
`dpl_46iAEKgRtCG3e34CjgNCKL7Fn3Y2`, đều target Preview.

- 13/13 tình huống lỗi transport đạt, gồm mất response LOCK/PUT/readback/UNLOCK
  và thay socket. Retry giữ cùng operation ID và không double commit.
- 50 cặp ghi cùng Note: đúng một bên thắng, bên còn lại conflict sau retry BUSY.
- 50 cặp ghi khác Note: giữ được cả hai thay đổi. Replay từ preview đối diện đạt.
- Thu hồi quyền trước writer tạm dừng: không công bố revision mồ côi;
  writer hết lock bị chặn, retry đã mất quyền bị từ chối.
- 698 HTTP invocations, request IDs không trùng, 3 module runtime contexts
  được ghi nhận. Đây không phải bằng chứng có đúng 3 VM vật lý.
- 104 BUSY responses trong các race/revoke có chủ đích đã được xử lý;
  kiểm tra cuối: 100 stored/100 active, không mất Note.

161 save metrics có commit trong toàn suite: p50 2431 ms, p95 4705 ms,
max 7407 ms. Tập này gồm cả tình huống lỗi chủ động và tranh lock, không coi
là benchmark save bình thường hay tỉ lệ lỗi mạng ngoài thực tế. Không đủ dữ
liệu để kết luận đã nhanh hơn Blob hoặc trải nghiệm mượt như Keep.

[Kết quả reliability đã lọc](results/2026-10-17-reliability.json).
Các artifact summary public giữ 14 ngày; bằng chứng đã chọn được lưu trong Git.
Run đầu `39045582381` và run chẩn đoán `39045682991` bị 401 tại OIDC,
trước thao tác Koofr; nguyên nhân subject mới chứa owner/repository IDs.
Đã sửa bằng so khớp chính xác immutable subject, không bỏ kiểm tra danh tính.

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

Qualification và reliability nêu trên đã đạt trên đúng source/driver được ghi.
Có thể chuyển sang tích hợp giao diện trên Preview. Vẫn cần test login/cookie
thật trên trình duyệt, bản nháp và xung đột đa thiết bị, backup độc lập/retention,
deep validation catalog và giới hạn dung lượng trước khi dùng dữ liệu thật.
Production vẫn cần kế hoạch cutover/rollback và duyệt riêng.
