const pool = require('../config/db');

// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG THUỘC KHO TRUNG CHUYỂN (WMS)
// =========================================================================
exports.getWmsOrders = async (req, res) => {
    try {
        // Lấy toàn bộ đơn hàng đang ở phòng WMS và đã được phê duyệt (APPROVED)
        // Sử dụng COALESCE để tránh trả về giá trị null gây lỗi hiển thị giao diện Vue
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
// 2. QUẢN LÝ VỊ TRÍ LƯU KHO (Gán ô kệ/Aisle/Shelf/Bin)
// =========================================================================
exports.updateOrderLocation = async (req, res) => {
    const { id } = req.params;
    const { location } = req.body; // Lấy chuỗi vị trí từ UI gửi lên (VD: "Khu A - Kệ 01 - Tầng 1")

    if (!location) {
        return res.status(400).json({ error: "Vui lòng cung cấp tọa độ vị trí ô kệ trong kho!" });
    }

    try {
        const result = await pool.query(
            `UPDATE orders 
             SET warehouse_location = $1 
             WHERE id = $2 
             RETURNING *`,
            [location, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng yêu cầu định vị!" });
        }

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
    const { condition, has_image } = req.body; // Gồm nội dung chữ mô tả lỗi và trạng thái ảnh đính kèm

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
            return res.status(404).json({ error: "Không tìm thấy đơn hàng cần lập biên bản khảo sát!" });
        }

        res.json({ message: "⚠️ Đã ghi nhận biên bản và hình ảnh hư hại ngoại quan vào hệ thống!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI LẬP BIÊN BẢN HƯ HẠI WMS:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu khi cập nhật tình trạng hàng hóa", detail: err.message });
    }
};