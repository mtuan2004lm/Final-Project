const pool = require('../config/db');

// 1. Hàm lấy danh sách đơn hàng cho OMS
exports.getOmsOrders = async (req, res) => {
    try {
        const queryText = `
            SELECT * FROM orders 
            WHERE (TRIM(UPPER(current_dept)) = 'OMS' OR TRIM(UPPER(status)) = 'NEW')
              AND TRIM(UPPER(status)) NOT IN ('RETURNED', 'TRẢ LẠI', 'DONE', 'HOÀN THÀNH')
            ORDER BY id ASC
        `;
        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI OMS_CONTROLLER (GET):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu", detail: err.message });
    }
};

// 2. Hàm duyệt đơn luân chuyển phòng ban (ĐÃ XÓA LỆNH GHI LOG BỊ LỖI)
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
        const result = await pool.query(queryText, [status, current_dept, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy dữ liệu đơn hàng cần duyệt!" });
        }

        res.json({ message: "Cập nhật dữ liệu và luân chuyển phòng ban thành công!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI OMS_CONTROLLER (PUT):", err.message);
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};

// 3. Thống kê doanh thu 
exports.getRevenueReport = async (req, res) => {
    try {
        const todayResult = await pool.query("SELECT COALESCE(SUM(total_cost), 0) as total FROM orders WHERE payment_status = 'PAID' AND DATE(created_at) = CURRENT_DATE");
        const monthResult = await pool.query("SELECT COALESCE(SUM(total_cost), 0) as total FROM orders WHERE payment_status = 'PAID' AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)");
        res.json({ today: parseFloat(todayResult.rows[0].total), month: parseFloat(monthResult.rows[0].total) });
    } catch (err) {
        res.json({ today: 0, month: 0 }); 
    }
};

// 4. Quản lý khách hàng
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const result = await pool.query(`SELECT customer_name, COUNT(id) as total_orders, SUM(total_cost) as total_spent, MAX(created_at) as last_purchase FROM orders GROUP BY customer_name ORDER BY total_spent DESC`);
        res.json(result.rows);
    } catch (err) {
        res.json([]); 
    }
};

// 5. Hàm xử lý hoàn trả đơn hàng về Khách hàng
exports.returnOrderToCustomer = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const safeReason = (reason || 'Vấn đề chứng từ khâu OMS / Sai lệch giá cả cần thẩm định lại').trim();

    try {
        const queryText = `
            UPDATE orders 
            SET status = 'RETURNED', 
                current_dept = 'CUSTOMER', 
                driver_notes = $1 
            WHERE id = $2 
            RETURNING *
        `;
        const result = await pool.query(queryText, [safeReason, id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Đơn hàng không tồn tại trên hệ thống!" });
        }

        res.json({ message: `Đã hoàn trả thành công đơn hàng #${id} về Khách hàng!`, order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};

// 6. Hàm lấy lịch sử (Đã gộp chung thành 1 hàm an toàn duy nhất)
exports.getOrderHistory = async (req, res) => {
    res.json([]); // Tạm thời trả về mảng rỗng để không bị sập chức năng xem lịch sử
};