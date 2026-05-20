const pool = require('../config/db');

exports.getTmsOrders = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM orders WHERE UPPER(current_dept) = 'TMS' AND UPPER(status) = 'PACKED' ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng TMS", detail: err.message });
    }
};