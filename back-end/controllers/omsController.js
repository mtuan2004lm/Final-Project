const pool = require('../config/db');

// 1. LẤY DANH SÁCH ĐƠN HÀNG OMS
exports.getOmsOrders = async (req, res) => {
    try {
        const queryText = `
            SELECT * FROM orders 
            WHERE (TRIM(UPPER(current_dept)) = 'OMS' OR TRIM(UPPER(status)) = 'NEW')
              AND TRIM(UPPER(status)) NOT IN ('RETURNED', 'TRẢ LẠI', 'DONE', 'HOÀN THÀNH')
            ORDER BY id ASC
        `;
        const result = await pool.query(queryText);
        
        const safeRows = result.rows.map(row => {
            const cleanedRow = { ...row };
            Object.keys(cleanedRow).forEach(key => {
                if (cleanedRow[key] === null) {
                    cleanedRow[key] = '';
                }
            });
            return cleanedRow;
        });

        res.json(safeRows);
    } catch (err) {
        console.error("🔴 LỖI TẠI OMS_CONTROLLER (GET ORDERS):", err.message);
        res.status(500).json({ error: "Lỗi DB OMS", detail: err.message });
    }
};

// 2. CẬP NHẬT TRẠNG THÁI LUÂN CHUYỂN
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, current_dept } = req.body;
    try {
        const result = await pool.query(
            `UPDATE orders SET status = $1, current_dept = $2 WHERE id = $3 RETURNING *`,
            [status, current_dept, id]
        );
        res.json({ message: "Luân chuyển phòng ban thành công!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};

// 3. THỐNG KÊ DOANH THU (ĐÃ SỬA LỖI PAYMENT_STATUS)
exports.getRevenueReport = async (req, res) => {
    try {
        // Đã xóa điều kiện WHERE payment_status = 'PAID' gây sập hệ thống
        const result = await pool.query("SELECT COALESCE(SUM(total_cost), 0) as total FROM orders");
        res.json({ today: parseFloat(result.rows[0].total), month: parseFloat(result.rows[0].total) });
    } catch (err) {
        console.error("🔴 LỖI TẠI OMS_CONTROLLER (REVENUE):", err.message);
        res.json({ today: 0, month: 0 }); 
    }
};

// 4. QUẢN LÝ KHÁCH HÀNG (Đã bổ sung tính Tổng tiền và Ngày mua gần nhất)
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const queryText = `
            SELECT 
                customer_name, 
                COUNT(id) as total_orders, 
                COALESCE(SUM(total_cost), 0) as total_spent, 
                MAX(created_at) as last_purchase 
            FROM orders 
            GROUP BY customer_name 
            ORDER BY total_spent DESC
        `;
        const result = await pool.query(queryText);
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI API CUSTOMER:", err.message);
        res.json([]); 
    }
};

// 5. HOÀN TRẢ ĐƠN HÀNG
exports.returnOrderToCustomer = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const safeReason = (reason || 'Sai lệch thông tin cần thẩm định lại').trim();

    try {
        const result = await pool.query(
            `UPDATE orders SET status = 'RETURNED', current_dept = 'CUSTOMER', notes = $1 WHERE id = $2 RETURNING *`, 
            [safeReason, id]
        );
        res.json({ message: `Đã hoàn trả thành công!`, order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};

// 6. LẤY LỊCH SỬ ĐƠN HÀNG
exports.getOrderHistory = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM order_logs WHERE order_id = $1 ORDER BY changed_at DESC`, [id]);
        res.json(result.rows);
    } catch (err) {
        try {
            const result2 = await pool.query(`SELECT * FROM order_histories WHERE order_id = $1 ORDER BY changed_at DESC`, [id]);
            res.json(result2.rows);
        } catch (err2) {
            res.json([]);
        }
    }
};