const pool = require('../config/db');

// 1. LẤY DANH SÁCH ĐƠN HÀNG WMS
exports.getWmsOrders = async (req, res) => {
    try {
        const queryText = `
            SELECT * FROM orders
            WHERE UPPER(current_dept) = 'WMS'
              AND UPPER(status) = 'APPROVED'
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

            if (cleanedRow.is_scanned === undefined || cleanedRow.is_scanned === '') {
                cleanedRow.is_scanned = false;
            }

            return cleanedRow;
        });

        res.json(safeRows);
    } catch (err) {
        console.error('🔴 LỖI TẠI WMS_CONTROLLER (getWmsOrders):', err.message);
        res.status(500).json({ error: 'Lỗi cơ sở dữ liệu phòng WMS' });
    }
};

// 2. QUẢN LÝ VỊ TRÍ LƯU KHO (TỰ ĐỘNG GHI NHẬT KÝ)
exports.updateOrderLocation = async (req, res) => {
    const { id } = req.params;
    const { warehouse_location } = req.body;

    try {
        const result = await pool.query(
            `UPDATE orders 
             SET warehouse_location = $1 
             WHERE id = $2 
             RETURNING *`,
            [warehouse_location, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng!' });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Khi xếp vị trí kệ trên Web/Mobile
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Sắp xếp vị trí kiện hàng vào ô/kệ: ${warehouse_location} (Kho WMS)`, result.rows[0].status, result.rows[0].status]
        );

        res.json({
            message: '🎯 Cập nhật vị trí thành công!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Lỗi cập nhật vị trí kho',
            detail: err.message
        });
    }
};

// 3. BÁO CÁO HƯ HẠI & CẬP NHẬT ẢNH KHO (TỰ ĐỘNG GHI NHẬT KÝ)
exports.updateCargoCondition = async (req, res) => {
    const { id } = req.params;
    const { cargo_condition } = req.body;
   
    const damageImagePath = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        let result;

        if (damageImagePath) {
            result = await pool.query(
                `UPDATE orders 
                 SET cargo_condition = $1, damage_image = $2 
                 WHERE id = $3 
                 RETURNING *`,
                [cargo_condition, damageImagePath, id]
            );
        } else {
            result = await pool.query(
                `UPDATE orders 
                 SET cargo_condition = $1 
                 WHERE id = $2 
                 RETURNING *`,
                [cargo_condition, id]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy đơn hàng!' });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Khi cập nhật tình trạng hàng hóa
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Cập nhật tình trạng kiện hàng tại kho: ${cargo_condition}`, result.rows[0].status, result.rows[0].status]
        );

        res.json({
            message: '⚠️ Đã ghi nhận báo cáo hư hại!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Lỗi ghi nhận báo cáo hư hại',
            detail: err.message
        });
    }
};

// 4. XUẤT KHO & BÀN GIAO TMS (TỰ ĐỘNG GHI NHẬT KÝ)
exports.releaseToTms = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `UPDATE orders 
             SET current_dept = 'TMS', status = 'APPROVED' 
             WHERE id = $1 AND is_scanned = true
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Không thể bàn giao! Đơn hàng này chưa được thực hiện quét xác nhận mã kiện.' });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Khi xuất kho giao cho xe tải
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Xuất kho thành công, bàn giao kiện hàng sang phòng Vận tải TMS`, 'APPROVED', 'APPROVED']
        );

        res.json({
            message: '📤 Xuất kho bàn giao TMS thành công!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Lỗi lệnh xuất kho sang TMS',
            detail: err.message
        });
    }
};

// 5. NHẬT KÝ KHO WMS
exports.getWarehouseGlobalLogs = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM order_logs 
             WHERE notes ILIKE '%kho%' 
                OR notes ILIKE '%WMS%' 
             ORDER BY changed_at DESC`
        );

        res.json(result.rows);
    } catch (err) {
        res.json([]);
    }
};

// 6. XÁC NHẬN MÃ KIỆN TRÊN WEB VÀ MOBILE/PDA (TỰ ĐỘNG GHI NHẬT KÝ CHUNG)
exports.scanBarcode = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `UPDATE orders
             SET is_scanned = true
             WHERE id = $1
               AND UPPER(current_dept) = 'WMS'
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Không tìm thấy đơn WMS cần quét!'
            });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Khi quét thành công từ Web hay Mobile
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Quét xác nhận mã đối chiếu kiện hàng nhập kho bãi thành công`, result.rows[0].status, result.rows[0].status]
        );

        res.json({
            message: '⚡ Đã xác nhận mã kiện nhập kho!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Lỗi hệ thống',
            detail: err.message
        });
    }
};