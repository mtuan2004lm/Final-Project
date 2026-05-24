const pool = require('../config/db');

// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG THUỘC KHO TRUNG CHUYỂN (WMS)
// =========================================================================
exports.getWmsOrders = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status, current_dept,
                    COALESCE(warehouse_location, '') as warehouse_location,
                    COALESCE(cargo_condition, '') as cargo_condition,
                    COALESCE(cargo_image, false) as cargo_image,
                    COALESCE(is_scanned, false) as is_scanned
             FROM orders 
             WHERE UPPER(current_dept) = 'WMS' AND UPPER(status) = 'APPROVED' 
             ORDER BY id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER (getWmsOrders):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng WMS", detail: err.message });
    }
};

// =========================================================================
// 2. QUẢN LÝ VỊ TRÍ LƯU KHO (Gán ô kệ/Aisle/Shelf/Slot cho kiện hàng)
// =========================================================================
exports.updateOrderLocation = async (req, res) => {
    const { id } = req.params;
    const { location } = req.body;

    try {
        const result = await pool.query(
            `UPDATE orders 
             SET warehouse_location = $1 
             WHERE id = $2 
             RETURNING *`,
            [location, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy mã đơn hàng!" });
        }

        // Tạo một log lịch sử put-away ô kệ vào DB
        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, 'APPROVED', 'APPROVED', $2)`,
            [id, `Nhân viên kho thực hiện Put-away phân bổ kiện hàng vào ô kệ lưu kho: ${location}`]
        );

        res.json({ message: `📍 Đã gán vị trí kho thành công: ${location}`, order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI CẬP NHẬT VỊ TRÍ Ô KỆ WMS:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu khi phân phối vị trí chứa hàng", detail: err.message });
    }
};

// =========================================================================
// 3. BÁO CÁO TÌNH TRẠNG HƯ HẠI NGOẠI QUAN (Cargo Condition Report)
// =========================================================================
exports.updateCargoCondition = async (req, res) => {
    const { id } = req.params;
    const { condition, has_image } = req.body;

    try {
        const result = await pool.query(
            `UPDATE orders 
             SET cargo_condition = $1, 
                 cargo_image = $2,
                 is_scanned = true
             WHERE id = $3 
             RETURNING *`,
            [condition, has_image, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        }

        // Lưu vết lập biên bản sự cố rách móp hàng hóa
        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, 'APPROVED', 'APPROVED', $2)`,
            [id, `🚨 Khảo sát ngoại quan phát hiện bất thường và lập biên bản hư hại: ${condition}`]
        );

        res.json({ message: "⚠️ Đã ghi nhận biên bản và hình ảnh hư hại ngoại quan vào hệ thống!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI BÁO CÁO HƯ HẠI NGOẠI QUAN WMS:", err.message);
        res.status(500).json({ error: "Lỗi lưu báo cáo tình trạng hàng hóa", detail: err.message });
    }
};

// =========================================================================
// 4. XỬ LÝ QUÉT MÃ BARCODE XÁC NHẬN NHẬP BÃI HOẶC ĐÓNG GÓI (LOG LỊCH SỬ)
// =========================================================================
exports.scanBarcode = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE orders SET is_scanned = true WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy kiện hàng cần quét mã!" });
        }

        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, 'APPROVED', 'APPROVED', $2)`,
            [id, 'Máy PDA Kho quét mã Barcode thành công: Xác nhận nhập bãi kho thành công, kiện hàng sẵn sàng xuất bến giao xe tải.']
        );

        res.json({ message: "⚡ Thiết bị PDA quét mã Barcode và ghi sổ cái lịch sử thành công!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER (scanBarcode):", err.message);
        res.status(500).json({ error: "Lỗi hệ thống ghi nhận máy quét Barcode", detail: err.message });
    }
};

// =========================================================================
// 5. MỚI THÊM: TRUY XUẤT TẤT CẢ LỊCH SỬ LIÊN QUAN ĐẾN KHO (TẬP HỢP LOGS)
// =========================================================================
exports.getWarehouseGlobalLogs = async (req, res) => {
    try {
        // Lấy toàn bộ các log có chứa từ khóa liên quan đến Kho như 'Kho', 'PDA', 'kệ', 'ngoại quan', 'đóng gói', 'WMS'
        const result = await pool.query(
            `SELECT order_id, old_status, new_status, notes, changed_at 
             FROM order_logs 
             WHERE notes ILIKE '%kho%' 
                OR notes ILIKE '%pda%' 
                OR notes ILIKE '%kệ%' 
                OR notes ILIKE '%ngoại quan%' 
                OR notes ILIKE '%đóng gói%'
                OR notes ILIKE '%WMS%'
             ORDER BY changed_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER (getWarehouseGlobalLogs):", err.message);
        res.status(500).json({ error: "Không thể lấy lịch sử tổng hợp kho", detail: err.message });
    }
};