# Checklist kiểm tra iOS – công cụ nhân viên

## Chuẩn bị
- [ ] Chạy `RunMigrations.command` (nếu chưa), rồi khởi động lại backend (`RunBackend.command`)
- [ ] Xcode: ⇧⌘K, ⌘R → app build được, hiện màn đăng nhập
- [ ] Có tài khoản test: ADMIN, OMS, ACC, DOCS, CUSTOMER

## 1. Đăng nhập theo vai trò
- [ ] ADMIN → màn Admin, góc trên trái có nút **Tools**
- [ ] OMS → menu có "Claims review"
- [ ] ACC → menu có 5 mục Accounting
- [ ] DOCS → menu có "Search records"
- [ ] CUSTOMER đăng nhập ở màn nhân viên → bị từ chối
- [ ] Logout quay về màn đăng nhập

## 2. Admin → Tools
- [ ] User Management: tạo tài khoản → hiện trong danh sách và trên web
- [ ] Khóa tài khoản → không đăng nhập được; mở lại → đăng nhập được
- [ ] Reset password → đăng nhập bằng mật khẩu mới
- [ ] Ô lọc tìm đúng theo tên/username/vai trò
- [ ] Pricing & Settings: sửa giá → Save → đơn mới của khách dùng giá mới
- [ ] Alerts: hiện đủ 4 mục, không lỗi
- [ ] Performance: đổi 7/30/90 ngày → số liệu đổi
- [ ] Audit Log: thấy các thao tác vừa làm

## 3. OMS
- [ ] Khách tạo yêu cầu bồi thường
- [ ] OMS thấy claim PENDING → Approve (số tiền ≤ yêu cầu) → APPROVED
- [ ] Số tiền vượt mức / Reject không lý do → báo lỗi
- [ ] Khách nhận thông báo kết quả

## 4. Kế toán (ACC)
- [ ] Receivables: thấy tổng công nợ/quá hạn; Send reminder → khách nhận thông báo
- [ ] Invoices: Issue đơn đã thanh toán/đã giao → có số INV-năm-000001
- [ ] Issue lại cùng đơn → báo đã có hóa đơn
- [ ] Open / print mở được hóa đơn; Cancel có lý do → CANCELLED
- [ ] Claims payout: claim APPROVED → Mark as paid → PAID, khách nhận thông báo
- [ ] Bank reconciliation, dán `2026-10-06, CK PKG5, 120.00`:
  - [ ] Đúng mã + số tiền → "Matches" → Confirm → đơn thành PAID
  - [ ] Sai số tiền → "Amount differs"
  - [ ] Không có mã PKG → "No PKG code"
- [ ] Export CSV: orders, refunds, claims, invoices, fleet-costs đều chia sẻ/lưu được

## 5. Docs
- [ ] Tìm theo tên khách/sản phẩm/số đơn ra danh sách
- [ ] Chi tiết đơn: thấy tệp đính kèm; Handover form, Damage report mở được
- [ ] Đơn đã niêm phong: thấy lịch sử; Admin có ô Reopen (≥5 ký tự), DOCS thì không

## 6. Kiểm tra lại lỗi build cũ
- [ ] Không còn lỗi "same symbol" ở Localizable
- [ ] Customer: Addresses, History, Orders, Claims mở bình thường
- [ ] Chuyển EN/VI ở màn đăng nhập, các màn cũ đổi đúng

Ghi chú: màn hình mới chưa có bản dịch tiếng Việt (hiển thị tiếng Anh).
