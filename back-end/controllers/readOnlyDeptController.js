const pool = require('../config/db');

exports.getReadOnlyOrders = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE current_dept = 'Docs' ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi lấy danh sách đơn hàng Docs");
    }
};