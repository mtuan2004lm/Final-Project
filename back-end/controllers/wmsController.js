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
                    COALESCE(cargo_image, '') as cargo_image, -- SỬA THÀNH CHUỖI RỖNG
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
// 2. QUẢN LÝ VỊ TRÍ LƯU KHO (Giữ nguyên theo yêu cầu)
// =========================================================================
exports.updateOrderLocation = async (req, res) => {
    const { id } = req.params;
    const { location } = req.body;
    try {
        const result = await pool.query(
            `UPDATE orders SET warehouse_location = $1 WHERE id = $2 RETURNING *`,
            [location, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy mã đơn hàng!" });
        }
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
// 3. BÁO CÁO TÌNH TRẠNG HƯ HẠI NGOẠI QUAN (Cập nhật xử lý lưu Tên File Ảnh)
// =========================================================================
exports.updateCargoCondition = async (req, res) => {
    const { id } = req.params;
    const { condition } = req.body; 
    
    // Đọc tên file ảnh từ Multer middleware nếu có người dùng tải lên
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        const result = await pool.query(
            `UPDATE orders 
             SET cargo_condition = $1, 
                 cargo_image = CASE WHEN $2 <> '' THEN $2 ELSE cargo_image END, -- Giữ ảnh cũ nếu không up ảnh mới
                 is_scanned = true
             WHERE id = $3 
             RETURNING *`,
            [condition, imagePath, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        }

        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, 'APPROVED', 'APPROVED', $2)`,
            [id, `🚨 Khảo sát ngoại quan phát hiện bất thường và lập biên bản hư hại: ${condition}`]
        );

        res.json({ message: "⚠️ Đã ghi nhận biên bản và tải ảnh hình ảnh hư hại lên hệ thống!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI BÁO CÁO HƯ HẠI NGOẠI QUAN WMS:", err.message);
        res.status(500).json({ error: "Lỗi lưu báo cáo tình trạng hàng hóa", detail: err.message });
    }
};

// =========================================================================
// 4. XỬ LÝ NHẬP MÃ ĐƠN XÁC NHẬN NHẬP KHO (Đã đổi tên logic từ Quét Barcode thành Nhập Mã)
// =========================================================================
exports.scanBarcode = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE orders SET is_scanned = true WHERE id = $1 RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy kiện hàng cần xác nhận!" });
        }

        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes) 
             VALUES ($1, 'APPROVED', 'APPROVED', $2)`,
            [id, 'Hệ thống ghi nhận mã kiện hàng: Xác nhận hoàn tất nhập bãi kho trung chuyển thành công.']
        );

        res.json({ message: "⚡ Đã xác nhận mã kiện nhập kho thành công vào hệ thống!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER (scanBarcode):", err.message);
        res.status(500).json({ error: "Lỗi hệ thống ghi nhận mã kiện nhập kho", detail: err.message });
    }
};

// =========================================================================
// 5. TRUY XUẤT TẤT CẢ LỊCH SỬ LIÊN QUAN ĐẾN KHO (Giữ nguyên theo yêu cầu)
// =========================================================================
exports.getWarehouseGlobalLogs = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT order_id, old_status, new_status, notes, changed_at 
             FROM order_logs 
             WHERE notes ILIKE '%kho%' OR notes ILIKE '%pda%' OR notes ILIKE '%kệ%' 
                OR notes ILIKE '%ngoại quan%' OR notes ILIKE '%đóng gói%' OR notes ILIKE '%WMS%'
             ORDER BY changed_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER (getWarehouseGlobalLogs):", err.message);
        res.status(500).json({ error: "Không thể lấy lịch sử tổng hợp kho", detail: err.message });
    }
};