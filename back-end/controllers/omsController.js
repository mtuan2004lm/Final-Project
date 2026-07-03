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

// 2. CẬP NHẬT TRẠNG THÁI LUÂN CHUYỂN (ĐÃ SỬA: Đã ghi nhận lịch sử order_logs)
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status, current_dept, notes } = req.body; // Lấy thêm trường notes từ Front-end truyền qua
    try {
        // Kiểm tra đơn hàng cũ để lấy trạng thái trước khi update
        const oldOrder = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
        if (oldOrder.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng cần cập nhật!" });
        }
        const oldStatus = oldOrder.rows[0].status;

        // Cập nhật đơn hàng
        const result = await pool.query(
            `UPDATE orders SET status = $1, current_dept = $2 WHERE id = $3 RETURNING *`,
            [status, current_dept, id]
        );

        // Tự động ghi nhận log lịch sử hành trình nếu có notes gửi kèm
        const logNotes = notes || `Luân chuyển đơn hàng sang bộ phận ${current_dept}`;
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, logNotes, oldStatus, status]
        );

        res.json({ message: "Luân chuyển phòng ban và ghi log thành công!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};

// 3. THỐNG KÊ DOANH THU (ĐÃ SỬA: Tách biệt doanh thu Ngày và Tháng theo thời gian thực)
exports.getRevenueReport = async (req, res) => {
    try {
        // Doanh thu ngày hôm nay (tính từ 00:00:00 hôm nay)
        const todayResult = await pool.query(
            "SELECT COALESCE(SUM(total_cost), 0) as total FROM orders WHERE created_at >= CURRENT_DATE"
        );
        
        // Doanh thu tháng này (tính từ ngày đầu tiên của tháng hiện tại)
        const monthResult = await pool.query(
            "SELECT COALESCE(SUM(total_cost), 0) as total FROM orders WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)"
        );

        res.json({ 
            today: parseFloat(todayResult.rows[0].total), 
            month: parseFloat(monthResult.rows[0].total) 
        });
    } catch (err) {
        console.error("🔴 LỖI TẠI OMS_CONTROLLER (REVENUE):", err.message);
        res.json({ today: 0, month: 0 }); 
    }
};

// 4. QUẢN LÝ KHÁCH HÀNG (ĐÃ SỬA: Ép kiểu dữ liệu số chính xác cho Front-end)
exports.getCustomerAnalytics = async (req, res) => {
    try {
        const queryText = `
            SELECT 
                customer_name, 
                COUNT(id)::int as total_orders, 
                COALESCE(SUM(total_cost), 0)::float as total_spent, 
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

// 5. HOÀN TRẢ ĐƠN HÀNG (ĐÃ SỬA: Đã đồng bộ ghi log vào order_logs khi hoàn trả)
exports.returnOrderToCustomer = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const safeReason = (reason || 'Sai lệch thông tin cần thẩm định lại').trim();

    try {
        const oldOrder = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
        if (oldOrder.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        }
        const oldStatus = oldOrder.rows[0].status;

        const result = await pool.query(
            `UPDATE orders SET status = 'RETURNED', current_dept = 'CUSTOMER', notes = $1 WHERE id = $2 RETURNING *`, 
            [safeReason, id]
        );

        // Ghi nhận vào nhật ký chung của hệ thống
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Hoàn trả đơn hàng về khách hàng. Lý do: ${safeReason}`, oldStatus, 'RETURNED']
        );

        res.json({ message: `Đã hoàn trả thành công!`, order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};

// 6. LẤY LỊCH SỬ ĐƠN HÀNG (ĐÃ TỐI ƯU: Thống nhất dùng bảng order_logs chuẩn hóa)
exports.getOrderHistory = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM order_logs WHERE order_id = $1 ORDER BY changed_at DESC`, 
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI LẤY LỊCH SỬ ĐƠN HÀNG:", err.message);
        res.json([]);
    }
};