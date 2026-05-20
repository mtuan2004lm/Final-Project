const pool = require('../config/db');

exports.getDocsOrders = async (req, res) => {
    try {
        // Lấy toàn bộ đơn hàng đã chuyển đến tiến trình lưu trữ của phòng DOCS
        const result = await pool.query(
            "SELECT * FROM orders WHERE UPPER(current_dept) = 'DOCS' ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI READ_ONLY_DEPT_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng DOCS", detail: err.message });
    }
};