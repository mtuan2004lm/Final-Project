const pool = require('../config/db');

// 1. Lấy toàn bộ đơn hàng của Khách hàng
exports.getCustomerOrders = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI LẤY ĐƠN HÀNG KHÁCH HÀNG:", err);
        res.status(500).send("Lỗi lấy danh sách đơn khách hàng");
    }
};

// 2. Khách hàng tạo đơn mới
exports.createOrder = async (req, res) => {
    const { customer_name, product_name, quantity, cargo_type } = req.body;
    
    if (!product_name || !quantity) {
        return res.status(400).json({ message: "Vui lòng nhập đầy đủ tên hàng hóa và số lượng!" });
    }
    
    try {
        const pricePerUnit = cargo_type === 'Dangerous' ? 120 : 50; 
        const total_cost = quantity * pricePerUnit;

        const final_customer_name = customer_name && customer_name.trim() !== "" ? customer_name : "Khách hàng (cus_user)";

        const result = await pool.query(
            `INSERT INTO orders 
            (customer_name, product_name, quantity, status, current_dept, total_cost, payment_status) 
            VALUES ($1, $2, $3, 'NEW', 'OMS', $4, 'UNPAID') 
            RETURNING *`,
            [final_customer_name, product_name, quantity, total_cost]
        );
        
        res.status(201).json({ 
            message: "Đã gửi yêu cầu tạo đơn hàng vận chuyển thành công sang bộ phận OMS!", 
            order: result.rows[0] 
        });
    } catch (err) {
        console.error("🔴 LỖI TẠO ĐƠN HÀNG TẠI BACKEND:", err);
        res.status(500).json({ 
            message: "Lỗi hệ thống khi tạo đơn hàng!", 
            error: err.message 
        });
    }
};

// 3. Khách hàng hủy đơn hàng (Chỉ cho phép khi ở trạng thái NEW)
exports.cancelOrder = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
        const orderCheck = await pool.query('SELECT status FROM orders WHERE id = $1', [id]);
        
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng này trong hệ thống!" });
        }

        if (orderCheck.rows[0].status !== 'NEW') {
            return res.status(400).json({ 
                message: "Đơn hàng đã được bộ phận OMS duyệt và chuyển đi xử lý, bạn không thể hủy đơn vào lúc này!" 
            });
        }

        const result = await pool.query(
            "UPDATE orders SET status = 'CANCELLED', current_dept = 'None', cancel_reason = $1 WHERE id = $2 RETURNING *",
            [reason, id]
        );

        res.json({ message: "Đã hủy đơn hàng thành công!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI HỦY ĐƠN HÀNG:", err);
        res.status(500).send("Lỗi hệ thống khi thực hiện hủy đơn");
    }
};

// 4. Thanh toán đơn hàng -> ĐẨY SANG PHÒNG KẾ TOÁN (ACC) - ĐỒNG BỘ DỮ LIỆU FRONTEND
exports.payOrder = async (req, res) => {
    const { id } = req.params;
    const { method } = req.body;

    try {
        const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [id]);
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ message: "Đơn hàng không tồn tại!" });
        }

        // Đổi trạng thái thanh toán thành 'PENDING' và chuyển giao quyền xử lý sang bộ phận Kế toán 'ACC'
        const result = await pool.query(
            `UPDATE orders 
             SET payment_method = $1, payment_status = 'PENDING', current_dept = 'ACC' 
             WHERE id = $2 
             RETURNING *`, 
            [method || 'Momo/Banking', id]
        );
        
        res.json({ 
            message: `Đã gửi yêu cầu đối soát thanh toán thành công! Đơn hàng đang được phòng Kế toán (ACC) xử lý dòng tiền.`,
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI CỔNG THANH TOÁN KẾ TOÁN:", err);
        res.status(500).send("Lỗi hệ thống khi xử lý cổng thanh toán");
    }
};

// 5. ĐƯỜNG DẪN CẬP NHẬT TRẠNG THÁI DÙNG CHUNG CHO CÁC PHÒNG BAN ĐƯỢC ĐỒNG BỘ TẠI ĐÂY
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, current_dept } = req.body;

    try {
        const queryText = `
            UPDATE orders 
            SET status = $1, current_dept = $2 
            WHERE id = $3 
            RETURNING *
        `;
        const values = [status, current_dept, id];
        const result = await pool.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy dữ liệu đơn hàng cần xử lý!" });
        }

        res.json({
            message: "Cập nhật dữ liệu trạng thái luân chuyển thành công!",
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI CẬP NHẬT TRẠNG THÁI LUỒNG:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi cập nhật trạng thái đơn hàng", detail: err.message });
    }
};

// 6. Đánh giá và phản hồi chất lượng dịch vụ
exports.submitFeedback = async (req, res) => {
    const { id } = req.params;
    const { rating, feedback } = req.body;

    try {
        const orderCheck = await pool.query('SELECT status FROM orders WHERE id = $1', [id]);
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng!" });
        }

        await pool.query(
            "UPDATE orders SET rating = $1, feedback = $2 WHERE id = $3", 
            [rating, feedback, id]
        );

        res.json({ message: "Cảm ơn bạn đã gửi đánh giá và phản hồi dịch vụ cho Logistics Pro!" });
    } catch (err) {
        console.error("🔴 LỖI SUBMIT FEEDBACK:", err);
        res.status(500).send("Lỗi hệ thống khi gửi dữ liệu đánh giá");
    }
};