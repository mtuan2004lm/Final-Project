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
        console.error('🔴 ERROR AT WMS_CONTROLLER (getWmsOrders):', err.message);
        res.status(500).json({ error: 'Error database of the WMS department' });
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
            return res.status(404).json({ error: 'The order could not be found!' });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Sắp xếp vị trí ô kệ
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Sorting the location of the cargo into the shelf/rack: ${warehouse_location}`, result.rows[0].status, result.rows[0].status]
        );

        res.json({
            message: '🎯 The location has been updated successfully!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error updating the warehouse location',
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
            return res.status(404).json({ error: 'The order could not be found!' });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Cập nhật tình trạng hàng hóa tại kho
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `Update the cargo condition at the warehouse: ${cargo_condition}`, result.rows[0].status, result.rows[0].status]
        );

        res.json({
            message: '⚠️ The damage report has been recorded!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error recording the damage report',
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
            return res.status(400).json({ error: 'Cannot release! The order has not been scanned and verified.' });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Xuất kho bàn giao sang phòng xe
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `The order has been released and handed over to the TMS department.`, 'APPROVED', 'APPROVED']
        );

        res.json({
            message: '📤 The order has been released and handed over to the TMS department successfully!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error releasing the order to the TMS department',
            detail: err.message
        });
    }
};

// 5. NHẬT KÝ KHO WMS (ĐÃ TỐI ƯU CHỐNG MẤT DỮ LIỆU & LỌC SẠCH SẼ)
exports.getWarehouseGlobalLogs = async (req, res) => {
    try {
        // Giải pháp lọc thông minh bằng SQL: 
        // 1. Chỉ giữ lại các từ khóa liên quan đến Kho (kho, WMS, kệ, quét mã, vị trí)
        // 2. Sử dụng NOT ILIKE để ẩn hoàn toàn các hoạt động chạy xe đường trường của tài xế (TMS) hoặc hoàn trả đơn (OMS)
        // => Lịch sử gốc trong Database vẫn lưu đầy đủ 100%, nhưng giao diện kho sẽ cực kỳ sạch sẽ.
        const result = await pool.query(
            `SELECT * FROM order_logs 
             WHERE (notes ILIKE '%kho%' OR notes ILIKE '%WMS%' OR notes ILIKE '%kệ%' OR notes ILIKE '%quét%' OR notes ILIKE '%vị trí%')
               AND notes NOT ILIKE '%tài xế%'
               AND notes NOT ILIKE '%điều xe%'
               AND notes NOT ILIKE '%E-POD%'
               AND notes NOT ILIKE '%hoàn trả%'
               AND notes NOT ILIKE '%lộ trình%'
               AND notes NOT ILIKE '%tuyến đường%'
             ORDER BY changed_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 ERROR AT WMS_CONTROLLER (getWarehouseGlobalLogs):", err.message);
        res.json([]);
    }
};

// 5b. NHẬT KÝ KHO WMS THEO MÃ ĐƠN (TRA CỨU RIÊNG LẺ TỪNG ĐƠN HÀNG)
exports.getWarehouseLogsByOrder = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT * FROM order_logs 
             WHERE order_id = $1
               AND (notes ILIKE '%kho%' OR notes ILIKE '%WMS%' OR notes ILIKE '%kệ%' OR notes ILIKE '%quét%' OR notes ILIKE '%vị trí%')
               AND notes NOT ILIKE '%tài xế%'
               AND notes NOT ILIKE '%điều xe%'
               AND notes NOT ILIKE '%E-POD%'
               AND notes NOT ILIKE '%hoàn trả%'
               AND notes NOT ILIKE '%lộ trình%'
               AND notes NOT ILIKE '%tuyến đường%'
             ORDER BY changed_at DESC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 ERROR AT WMS_CONTROLLER (getWarehouseLogsByOrder):", err.message);
        res.status(500).json({ error: 'Lỗi truy vấn nhật ký kho theo mã đơn' });
    }
};

// 6. XÁC NHẬN MÃ KIỆN TRÊN WEB VÀ MOBILE/PDA (TỰ ĐỘNG GHI NHẬT KÝ)
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
                error: 'The WMS order to be scanned could not be found!'
            });
        }

        // 🌟 TỰ ĐỘNG GHI LOG: Quét nhận hàng thành công
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `The barcode has been successfully scanned and verified.`, result.rows[0].status, result.rows[0].status]
        );

        res.json({
            message: '⚡ The barcode has been successfully scanned and verified!',
            order: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            error: 'Error system',
            detail: err.message
        });
    }
};