const pool = require('../config/db');

exports.getTmsOrders = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE current_dept = 'TMS' ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi lấy danh sách đơn hàng TMS");
    }
};