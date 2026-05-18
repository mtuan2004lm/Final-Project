const pool = require('../config/db');

exports.getOmsOrders = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE current_dept = 'OMS' ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi lấy danh sách đơn hàng OMS");
    }
};