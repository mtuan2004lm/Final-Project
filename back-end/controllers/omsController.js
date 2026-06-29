// Thư mục chứa kết nối Database PostgreSQL
const pool = require('../config/db');

// 1. Hàm lấy danh sách đơn hàng mới cho phòng OMS xử lý ban đầu
exports.getOmsOrders = async (req, res) => {
    try {
        // ĐÃ SỬA: Thay điều kiện thành OR để quét được toàn bộ các đơn hàng cũ chưa qua duyệt khâu OMS
        const result = await pool.query(
            "SELECT * FROM orders WHERE UPPER(current_dept) = 'OMS' OR UPPER(status) = 'NEW' ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI CHI TIẾT TẠI OMS_CONTROLLER (GET):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu khi lấy đơn OMS", detail: err.message });
    }
};

// 2. Hàm cập nhật trạng thái luân chuyển phòng ban thông thường (Duyệt đi tiếp)
// Đã được bổ sung thêm logic TỰ ĐỘNG LƯU VẾT LỊCH SỬ vào bảng order_histories
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, current_dept, from_dept } = req.body; // Nhận thêm phòng ban thực hiện gửi từ Frontend

    try {
        const queryText = `
            UPDATE orders 
            SET status = $1, current_dept = $2 \n            WHERE id = $3 \n            RETURNING *
        `;
        const values = [status, current_dept, id];
        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy dữ liệu đơn hàng cần duyệt!" });
        }

        // 📝 TỰ ĐỘNG GHI NHẬT KÝ HÀNH TRÌNH KHÂU DUYỆT ĐƠN
        await pool.query(
            `INSERT INTO order_histories (order_id, from_dept, to_dept, status, action_by, notes) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, from_dept || 'OMS', current_dept, status, 'OMS_STAFF', 'Đơn hàng được phê duyệt hợp lệ và chuyển tiếp liên phòng ban.']
        );

        res.json({
            message: "Cập nhật dữ liệu và luân chuyển phòng ban thành công!",
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI CHI TIẾT TẠI OMS_CONTROLLER (PUT):", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi cập nhật luồng đơn hàng", detail: err.message });
    }
};

// 3. Thống kê doanh thu phục vụ Tab Biểu đồ số liệu
exports.getRevenueReport = async (req, res) => {
    try {
        const todayResult = await pool.query(
            "SELECT COALESCE(SUM(total_cost), 0) as total FROM orders WHERE payment_status = 'PAID' AND DATE(created_at) = CURRENT_DATE"
        );
        const monthResult = await pool.query(
            `SELECT COALESCE(SUM(total_cost), 0) as total FROM orders 
             WHERE payment_status = 'PAID' 
             AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) 
             AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`
        );
        res.json({
            today: parseFloat(todayResult.rows[0].total),
            month: parseFloat(monthResult.rows[0].total)
        });
    } catch (err) {
        console.error("🔴 LỖI THỐNG KÊ DOANH THU OMS:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống thống kê số liệu" });
    }
};

// 4. Quản lý khách hàng: Thống kê lịch sử mua sắm tích lũy trọn đời
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                customer_name, 
                COUNT(id) as total_orders, 
                SUM(total_cost) as total_spent,
                MAX(created_at) as last_purchase
             FROM orders 
             GROUP BY customer_name 
             ORDER BY total_spent DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI PHÂN TÍCH KHÁCH HÀNG OMS:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phân tích tập khách hàng" });
    }
};

// 5. Hoàn trả đơn hàng: Chuyển quyền quản lý về Customer và lưu vết lý do lỗi
// Đã tích hợp TỰ ĐỘNG GHI LÝ DO HOÀN ĐƠN vào bảng lịch sử hành trình
exports.returnOrder = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const result = await pool.query(
            `UPDATE orders 
             SET current_dept = 'CUSTOMER', 
                 status = 'RETURNED', 
                 notes = $1 
             WHERE id = $2 RETURNING *`,
            [reason || 'Vấn đề chứng từ khâu OMS / Sai lệch giá cả cần thẩm định lại', id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Đơn hàng không tồn tại trên hệ thống!" });
        }

        // 📝 TỰ ĐỘNG GHI NHẬT KÝ HÀNH TRÌNH KHÂU HOÀN ĐƠN (GHI RÕ LÝ DO)
        await pool.query(
            `INSERT INTO order_histories (order_id, from_dept, to_dept, status, action_by, notes) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, 'OMS', 'CUSTOMER', 'RETURNED', 'OMS_MANAGER', reason]
        );

        res.json({ message: `Đã hoàn trả thành công đơn hàng #${id} về phân hệ Khách hàng để chỉnh sửa!`, order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI HOÀN ĐƠN HÀNG TẠI OMS_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi thao tác hoàn trả đơn" });
    }
};

// 6. API MỚI: Lấy danh sách lịch sử hành trình chi tiết của một đơn hàng
exports.getOrderHistory = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            "SELECT * FROM order_histories WHERE order_id = $1 ORDER BY created_at DESC",
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẢI LỊCH SỬ ĐƠN HÀNG TẠI OMS_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi tải lịch sử hành trình" });
    }
};