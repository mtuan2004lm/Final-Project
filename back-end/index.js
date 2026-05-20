const express = require('express');
const cors = require('cors');
const app = express();

// Cấu hình Middleware
app.use(cors());
app.use(express.json()); // Đọc dữ liệu body JSON gửi từ Frontend

// =================================================================
// 1. IMPORT CÁC ĐƯỜNG DẪN ĐỊNH TUYẾN (ROUTES)
// =================================================================
const authRoutes = require('./routes/authRoutes'); // Route xử lý đăng nhập/đăng ký
const orderRoutes = require('./routes/orderRoutes'); // Route xử lý phân hệ đơn hàng

// =================================================================
// 2. KÍCH HOẠT MIDDLEWARE ĐƯỜNG DẪN API (ĐỒNG BỘ FRONTEND)
// =================================================================

// Kích hoạt cổng Đăng nhập / Đăng ký (Sửa dứt điểm lỗi 404 Login)
app.use('/api/auth', authRoutes); 

// Kích hoạt cổng Đơn hàng cho các phòng ban (OMS, WMS, TMS, DOCS...)
app.use('/api/orders', orderRoutes);

// =================================================================

// Khởi động hệ thống Server tại cổng 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server Back-end đang hoạt động mượt mà tại: http://localhost:${PORT}`);
});