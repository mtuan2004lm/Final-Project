const pool = require('../config/db');

// Lấy danh sách hồ sơ chứng từ nâng cao kèm số liệu KPI tổng hợp
exports.getDocsOrders = async (req, res) => {
    try {
        // =========================================================================
        // 1. ĐÃ SỬA BỘ LỌC SQL: Cho phép phòng DOCS giám sát đơn hàng NGAY TỪ KHÂU OMS ĐÃ DUYỆT
        // (Bao gồm đơn đang ở kho WMS, xe chạy TMS, Kế toán ACC hay tại phòng DOCS)
        // =========================================================================
        const ordersQuery = `
            SELECT id, customer_name, product_name, quantity, status, current_dept, payment_status, total_cost,
                   COALESCE(warehouse_location, 'Chưa gán') as warehouse_location,
                   COALESCE(delivery_route, 'Chưa lập') as delivery_route,
                   COALESCE(assigned_truck, 'Chưa gán') as assigned_truck,
                   COALESCE(bot_fee, 0) as bot_fee,
                   COALESCE(fuel_fee, 0) as fuel_fee,
                   COALESCE(driver_notes, 'Không có') as driver_notes,
                   COALESCE(pod_image, '') as pod_image,
                   created_at
            FROM orders 
            WHERE UPPER(current_dept) IN ('DOCS', 'WMS', 'TMS', 'ACC', 'ARCHIVED') 
               OR UPPER(status) IN ('APPROVED', 'DONE')
            ORDER BY id DESC
        `;
        const ordersResult = await pool.query(ordersQuery);

        // 2. Thuật toán tính nhanh số liệu KPI lưu trữ tài liệu
        const kpiQuery = `
            SELECT 
                COUNT(*) as total_archives,
                COUNT(CASE WHEN status = 'DONE' THEN 1 END) as done_archives,
                COUNT(CASE WHEN current_dept = 'ARCHIVED' THEN 1 END) as closed_archives,
                COUNT(CASE WHEN pod_image IS NOT NULL AND pod_image != '' THEN 1 END) as has_pod_proof
            FROM orders
        `;
        const kpiResult = await pool.query(kpiQuery);
        const kpi = kpiResult.rows[0];

        res.json({
            archives: ordersResult.rows,
            kpi: {
                totalArchives: parseInt(kpi.total_archives) || 0,
                doneArchives: parseInt(kpi.done_archives) || 0,
                closedArchives: parseInt(kpi.closed_archives) || 0,
                hasPodProof: parseInt(kpi.has_pod_proof) || 0
            }
        });
    } catch (err) {
        console.error("🔴 LỖI TẠI READ_ONLY_DEPT_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng DOCS", detail: err.message });
    }
};

// Khóa cứng và niêm phong chứng từ vào kho lưu trữ vĩnh viễn
exports.lockArchiveFile = async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = `
            UPDATE orders 
            SET current_dept = 'ARCHIVED', status = 'DONE' 
            WHERE id = $1 
            RETURNING *
        `;
        const result = await pool.query(queryText, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy mã hồ sơ cần niêm phong!" });
        }

        // Ghi nhật ký hệ thống
        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) \n             VALUES ($1, 'DONE', 'DONE', 'Phòng chứng từ (DOCS) tiến hành kiểm toán dữ liệu và Niêm phong hồ sơ vào kho số vĩnh viễn.')`,
            [id]
        );

        res.json({ message: "🔒 Đã niêm phong hồ sơ vào kho điện tử thành công!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI KHI KHÓA CHỨNG TỪ:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi khóa hồ sơ" });
    }
};