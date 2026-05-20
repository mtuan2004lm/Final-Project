const pool = require('../config/db');

exports.getWmsOrders = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM orders WHERE UPPER(current_dept) = 'WMS' AND UPPER(status) = 'APPROVED' ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng WMS", detail: err.message });
    }
};