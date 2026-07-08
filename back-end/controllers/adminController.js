const pool = require('../config/db');

// =========================================================================
// 1. TỔNG QUAN TOÀN BỘ ĐƠN HÀNG TRONG HỆ THỐNG (KHÔNG LỌC THEO PHÒNG BAN)
//    Dùng cho Admin xem "tất cả các quy trình" đang chạy, đơn nào đang ở đâu.
// =========================================================================
exports.getAllOrdersOverview = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status, current_dept,
                    COALESCE(total_cost, 0) as total_cost,
                    COALESCE(payment_status, '') as payment_status,
                    COALESCE(warehouse_location, '') as warehouse_location,
                    COALESCE(delivery_route, '') as delivery_route,
                    COALESCE(assigned_truck, '') as assigned_truck,
                    COALESCE(bot_fee, 0) as bot_fee,
                    COALESCE(fuel_fee, 0) as fuel_fee,
                    created_at
             FROM orders
             ORDER BY id DESC`
        );
        const orders = result.rows;

        // Đếm nhanh số đơn theo từng phòng ban / trạng thái để hiện thẻ tổng quan
        // (mục đích tổng quan, KHÔNG đi vào chi tiết từng kiện như WMS/TMS đang làm)
        const deptCounts = {};
        const statusCounts = {};
        orders.forEach(o => {
            const dept = (o.current_dept || 'KHÁC').toUpperCase().trim() || 'KHÁC';
            const status = (o.status || 'KHÁC').toUpperCase().trim() || 'KHÁC';
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        res.json({
            orders,
            totalOrders: orders.length,
            deptCounts,
            statusCounts
        });
    } catch (err) {
        console.error("🔴 LỖI TẠI ADMIN_CONTROLLER (getAllOrdersOverview):", err.message);
        res.status(500).json({ error: "Lỗi lấy tổng quan đơn hàng toàn hệ thống", detail: err.message });
    }
};

// =========================================================================
// 2. MỚI: DANH SÁCH BÁO CÁO DOCS ĐÃ GỬI (chỉ metadata, không kèm dữ liệu chi tiết
//    để load nhanh danh sách - bấm vào từng báo cáo mới tải nội dung đầy đủ)
// =========================================================================
exports.getReports = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, report_type, created_by, created_at
             FROM reports
             ORDER BY id DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI ADMIN_CONTROLLER (getReports):", err.message);
        res.status(500).json({ error: "Lỗi lấy danh sách báo cáo", detail: err.message });
    }
};

// =========================================================================
// 3. MỚI: MỞ CHI TIẾT 1 BÁO CÁO (kèm toàn bộ dữ liệu snapshot) - Admin xem
//    trực tiếp trong app, không cần tải file về máy.
// =========================================================================
exports.getReportById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM reports WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy báo cáo này" });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("🔴 LỖI TẠI ADMIN_CONTROLLER (getReportById):", err.message);
        res.status(500).json({ error: "Lỗi lấy chi tiết báo cáo", detail: err.message });
    }
};