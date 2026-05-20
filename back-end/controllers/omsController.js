// Thư mục chứa kết nối Database PostgreSQL
const pool = require('../config/db'); 

// 1. Hàm lấy danh sách đơn hàng cho phòng OMS
exports.getOmsOrders = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM orders WHERE UPPER(current_dept) = 'OMS' AND status = 'NEW' ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI CHI TIẾT TẠI OMS_CONTROLLER (GET):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu khi lấy đơn OMS", detail: err.message });
    }
};

// 2. HÀM CẬP NHẬT TRẠNG THÁI & CHUYỂN TIẾP PHÒNG BAN (GIẢI QUYẾT LỖI 500 VÀ LỖI CHUYỂN BAN)
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params; // Lấy ID từ URL (Ví dụ: /api/orders/1 -> id = 1)
    const { status, current_dept } = req.body; // Dữ liệu trạng thái mới gửi từ Frontend lên

    try {
        // Thực hiện câu lệnh SQL cập nhật thông tin đơn hàng
        const queryText = `
            UPDATE orders 
            SET status = $1, current_dept = $2 
            WHERE id = $3 
            RETURNING *
        `;
        const values = [status, current_dept, id];
        const result = await pool.query(queryText, values);

        // Trường hợp không tìm thấy ID đơn hàng tương ứng trong DB
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy dữ liệu đơn hàng cần duyệt!" });
        }

        // Trả kết quả thành công về cho Frontend cập nhật lại giao diện
        res.json({
            message: "Cập nhật dữ liệu và luân chuyển phòng ban thành công!",
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI CHI TIẾT TẠI OMS_CONTROLLER (PUT):", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi cập nhật luồng đơn hàng", detail: err.message });
    }
};