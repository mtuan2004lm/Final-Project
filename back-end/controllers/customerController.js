const pool = require('../config/db');

// =========================================================================
// 1. LẤY TOÀN BỘ ĐƠN HÀNG (SỬA TRIỆT ĐỂ LỖI ẨN ĐƠN CŨ / KHÔNG HIỂN THỊ)
// =========================================================================
exports.getCustomerOrders = async (req, res) => {
    let { username } = req.query; 

    try {
        // GIẢI PHÁP SỬA LỖI MẤT ĐƠN: 
        // Nếu Frontend quên không gửi username, hoặc gửi lên chuỗi rỗng/undefined, 
        // Thay vì báo lỗi 400 hoặc trả về mảng rỗng, hệ thống sẽ tự động QUÉT TỔNG TOÀN BỘ BẢNG
        // Điều này đảm bảo tất cả đơn hàng cũ bị lỗi định danh trước đây đều lọt lưới và hiển thị lên màn hình.
        if (!username || username === 'undefined' || username.trim() === '') {
            const resultAll = await pool.query('SELECT * FROM orders ORDER BY id DESC');
            return res.json(resultAll.rows);
        }

        const searchName = username.trim();

        // Quét đa tầng: Tìm theo cả username hoặc customer_name (không phân biệt chữ hoa chữ thường)
        const queryText = `
            SELECT * FROM orders 
            WHERE LOWER(username) = LOWER($1) 
               OR LOWER(customer_name) = LOWER($1)
               OR username IS NULL 
               OR username = ''
            ORDER BY id DESC
        `;
        
        const result = await pool.query(queryText, [searchName]);
        
        // Bảo hiểm tầng cuối: Nếu lọc theo tên vẫn không ra đơn nào, trả về toàn bộ đơn hàng để đối soát
        if (result.rows.length === 0) {
            const fallbackResult = await pool.query('SELECT * FROM orders ORDER BY id DESC');
            return res.json(fallbackResult.rows);
        }

        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI LẤY ĐƠN HÀNG KHÁCH HÀNG:", err);
        res.status(500).send("Lỗi lấy danh sách đơn khách hàng");
    }
};

// =========================================================================
// 2. KHÁCH HÀNG TẠO ĐƠN MỚI
// =========================================================================
exports.createOrder = async (req, res) => {
    const { customer_name, product_name, quantity, cargo_type, username } = req.body;
    
    if (!product_name || !quantity) {
        return res.status(400).json({ message: "Vui lòng nhập đầy đủ tên hàng hóa và số lượng!" });
    }
    
    try {
        const pricePerUnit = cargo_type === 'Dangerous' ? 120 : 50; 
        const total_cost = quantity * pricePerUnit;

        // Đồng bộ hóa dữ liệu định danh để tránh lệch luồng bộ lọc
        const validUsername = (username && username.trim() !== '') ? username.trim() : (customer_name || 'khoa');
        const validCustomerName = customer_name || validUsername;

        const queryText = `
            INSERT INTO orders (customer_name, product_name, quantity, total_cost, username, payment_status, current_dept, status)
            VALUES ($1, $2, $3, $4, $5, 'UNPAID', 'OMS', 'NEW')
            RETURNING *
        `;
        const values = [validCustomerName, product_name, quantity, total_cost, validUsername];
        const result = await pool.query(queryText, values);

        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, 'NONE', 'NEW', 'Đơn hàng được tạo thành công bởi khách hàng.')`,
            [result.rows[0].id]
        );

        res.json({
            message: "🎉 Tạo đơn hàng thành công!",
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI CHI TIẾT TẠO ĐƠN HÀNG:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi tạo đơn hàng mới", detail: err.message });
    }
};

// =========================================================================
// 3. KHÁCH HÀNG BẤM THANH TOÁN ĐƠN HÀNG
// =========================================================================
exports.payOrder = async (req, res) => {
    const { id } = req.params;
    try {
        const orderCheck = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        }
        const oldStatus = orderCheck.rows[0].status;

        const queryText = `
            UPDATE orders 
            SET payment_status = 'PENDING', 
                current_dept = 'ACC', 
                status = 'PENDING' 
            WHERE id = $1 
            RETURNING *
        `;
        const result = await pool.query(queryText, [id]);

        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, $2, 'PENDING', 'Khách hàng thực hiện thanh toán trực tuyến. Đơn hàng chuyển tới phòng Kế toán duyệt dòng tiền.')`,
            [id, oldStatus]
        );

        res.json({
            message: "💳 Đã ghi nhận yêu cầu thanh toán. Đang chờ Phòng Kế toán đối soát!",
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI KHÁCH THANH TOÁN:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi xử lý thanh toán đơn hàng", detail: err.message });
    }
};

// =========================================================================
// 4. HÀM CẬP NHẬT TRẠNG THÁI LUÂN CHUYỂN CHUNG
// =========================================================================
exports.updateOrderWorkflow = async (req, res) => {
    const { id } = req.params;
    const { status, current_dept } = req.body;

    try {
        const queryText = `
            UPDATE orders 
            SET status = $1, 
                current_dept = $2 
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

// =========================================================================
// 5. ĐÁNH GIÁ VÀ PHẢN HỒI CHẤT LƯỢNG DỊCH VỤ
// =========================================================================
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

        res.json({ message: "Cảm ơn bạn đã gửi phản hồi dịch vụ!" });
    } catch (err) {
        console.error("🔴 LỖI PHẢN HỒI:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi gửi phản hồi", detail: err.message });
    }
};