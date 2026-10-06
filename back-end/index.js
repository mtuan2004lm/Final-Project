const express = require('express');
const cors = require('cors');
const app = express();

// Cấu hình Middleware
app.use(cors());
app.use(express.json()); // Đọc dữ liệu body JSON gửi từ Frontend

// ĐỢT 4: ghi nhật ký mọi thao tác thay đổi dữ liệu (audit log)
app.use(require('./audit').middleware);

// =================================================================
// CẤU HÌNH PHỤC VỤ FILE ẢNH TĨNH (ĐÃ THÊM ĐỂ FIX LỖI ẨN HÌNH ẢNH)
// =================================================================
app.use('/uploads', express.static('uploads'));

// =================================================================
// 1. IMPORT CÁC ĐƯỜNG DẪN ĐỊNH TUYẾN (ROUTES)
// =================================================================
const authRoutes = require('./routes/authRoutes'); // Route xử lý đăng nhập/đăng ký
const orderRoutes = require('./routes/orderRoutes'); // Route xử lý phân hệ đơn hàng
const phase1Routes = require('./routes/phase1Routes'); // ĐỢT 1: địa chỉ, hủy/trả/hoàn tiền, POD, lịch lấy hàng
const phase2Routes = require('./routes/phase2Routes'); // ĐỢT 2: thông báo, chat hỗ trợ, dashboard khách, vận đơn/hóa đơn
const phase3Routes = require('./routes/phase3Routes');
const phase4Routes = require('./routes/phase4Routes'); // ĐỢT 4: bảo hiểm/bồi thường, OTP quên mật khẩu, audit log // ĐỢT 3: CSV hàng loạt, quét QR hàng loạt, gom tuyến + gán xe, tối ưu lộ trình, đội xe

// =================================================================
// 2. KÍCH HOẠT MIDDLEWARE ĐƯỜNG DẪN API (ĐỒNG BỘ FRONTEND)
// =================================================================

// Kích hoạt cổng Đăng nhập / Đăng ký (Sửa dứt điểm lỗi 404 Login)
app.use('/api/auth', authRoutes);

// Kích hoạt cổng Đơn hàng cho các phòng ban (OMS, WMS, TMS, DOCS...)
app.use('/api/orders', orderRoutes);

// ĐỢT 1: các API mở rộng (địa chỉ giao hàng, hủy đơn, trả hàng, hoàn tiền, POD)
app.use('/api/ext', phase1Routes);

// ĐỢT 2: thông báo, chat hỗ trợ, dashboard khách, chứng từ (cùng tiền tố /api/ext)
app.use('/api/ext', phase2Routes);

// ĐỢT 3: đơn hàng loạt, quét QR hàng loạt, điều phối tự động, đội xe
app.use('/api/ext', phase3Routes);

// ĐỢT 4: bảo hiểm, bồi thường, quên mật khẩu, audit log
app.use('/api/ext', phase4Routes);

// =================================================================

// Khởi động hệ thống Server tại cổng 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server Back-end đang hoạt động mượt mà tại: http://localhost:${PORT}`);
});