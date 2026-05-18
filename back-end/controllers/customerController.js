const pool = require('../config/db');

// Lấy toàn bộ đơn hàng của Khách hàng để kiểm tra luồng
exports.getCustomerOrders = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi lấy danh sách đơn khách hàng");
    }
};

// Khách hàng tạo đơn mới -> Mặc định gán trạng thái NEW và đưa về OMS
exports.createOrder = async (req, res) => {
    const { customer_name, product_name, quantity } = req.body;
    try {
        const result = await pool.query(
            "INSERT INTO orders (customer_name, product_name, quantity, status, current_dept) VALUES ($1, $2, $3, 'NEW', 'OMS') RETURNING *",
            [customer_name, product_name, quantity]
        );
        res.status(201).json({ message: "Đã gửi yêu cầu tạo đơn thành công!", order: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi hệ thống khi tạo đơn hàng");
    }
};