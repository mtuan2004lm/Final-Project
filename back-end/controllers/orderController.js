const pool = require('../config/db');

// Hàm xử lý chung cho nút "Chuyển tiếp" từ mọi phòng ban
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, current_dept } = req.body;

    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1, current_dept = $2 WHERE id = $3 RETURNING *',
            [status, current_dept, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "The order to be updated could not be found!" });
        }

        res.json({ message: "Transfer of order successful!", order: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error system when transferring order status");
    }
};