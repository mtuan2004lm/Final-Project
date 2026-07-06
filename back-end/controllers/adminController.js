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