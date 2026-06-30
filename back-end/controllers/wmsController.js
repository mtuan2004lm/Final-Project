const pool = require('../config/db');

// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG WMS (Tương thích Android Studio & Web Vue)
// =========================================================================
exports.getWmsOrders = async (req, res) => {
    try {
        const queryText = `
            SELECT * FROM orders 
            WHERE UPPER(current_dept) = 'WMS' AND UPPER(status) = 'APPROVED' 
            ORDER BY id ASC
        `;
        const result = await pool.query(queryText);
        
        // Bọc dữ liệu an toàn cho cả Web và Android
        const safeRows = result.rows.map(row => {
            const cleanedRow = { ...row };
            // 1. Quét sạch null thành chuỗi rỗng
            Object.keys(cleanedRow).forEach(key => {
                if (cleanedRow[key] === null) cleanedRow[key] = '';
            });
            // 2. Ép thêm trường is_scanned để App Android không bị crash
            if (cleanedRow.is_scanned === undefined || cleanedRow.is_scanned === '') {
                cleanedRow.is_scanned = false; 
            }
            return cleanedRow;
        });

        res.json(safeRows);
    } catch (err) {
        console.error("🔴 LỖI TẠI WMS_CONTROLLER (getWmsOrders):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng WMS" });
    }
};

// =========================================================================
// 2. QUẢN LÝ VỊ TRÍ LƯU KHO
// =========================================================================
exports.updateOrderLocation = async (req, res) => {
    const { id } = req.params;
    const { warehouse_location } = req.body;
    try {
        const result = await pool.query(
            `UPDATE orders SET warehouse_location = $1 WHERE id = $2 RETURNING *`,
            [warehouse_location, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Không tìm thấy đơn hàng!" });
        res.json({ message: "🎯 Cập nhật vị trí thành công!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi cập nhật vị trí kho" });
    }
};

// =========================================================================
// 3. BÁO CÁO HƯ HẠI & CẬP NHẬT ẢNH KHO (Dành cho Web Vue)
// =========================================================================
exports.updateCargoCondition = async (req, res) => {
    const { id } = req.params;
    const { cargo_condition } = req.body;
    const cargoImagePath = req.file ? `/uploads/${req.file.filename}` : '';
    
    try {
        let result;
        if (cargoImagePath) {
            result = await pool.query(
                `UPDATE orders SET cargo_condition = $1, cargo_image = $2 WHERE id = $3 RETURNING *`,
                [cargo_condition, cargoImagePath, id]
            );
        } else {
            result = await pool.query(
                `UPDATE orders SET cargo_condition = $1 WHERE id = $2 RETURNING *`,
                [cargo_condition, id]
            );
        }
        res.json({ message: "⚠️ Đã ghi nhận báo cáo hư hại!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi ghi nhận báo cáo hư hại" });
    }
};

// =========================================================================
// 4. XUẤT KHO & BÀN GIAO TMS (Dành cho Web Vue)
// =========================================================================
exports.releaseToTms = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `UPDATE orders SET current_dept = 'TMS', status = 'APPROVED' WHERE id = $1 RETURNING *`,
            [id]
        );
        res.json({ message: "📤 Xuất kho bàn giao TMS thành công!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi lệnh xuất kho sang TMS" });
    }
};

// =========================================================================
// 5. NHẬT KÝ KHO WMS
// =========================================================================
exports.getWarehouseGlobalLogs = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM order_logs WHERE notes ILIKE '%kho%' OR notes ILIKE '%WMS%' ORDER BY changed_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        res.json([]); // Nếu bảng chưa có thì trả mảng rỗng chống sập API
    }
};

// =========================================================================
// 6. XÁC NHẬN MÃ KIỆN (API riêng cho Máy quét PDA / Android Studio)
// =========================================================================
exports.scanBarcode = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`UPDATE orders SET status = 'APPROVED' WHERE id = $1 RETURNING *`, [id]);
        res.json({ message: "⚡ Đã xác nhận mã kiện nhập kho!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống", detail: err.message });
    }
};