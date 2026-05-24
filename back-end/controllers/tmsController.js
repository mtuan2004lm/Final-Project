const pool = require('../config/db');

// 1. LẤY DANH SÁCH ĐƠN HÀNG CHỜ VẬN CHUYỂN HOẶC ĐANG ĐI ĐƯỜNG
exports.getTmsOrders = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status, current_dept,
                    COALESCE(delivery_route, '') as delivery_route,
                    COALESCE(assigned_truck, '') as assigned_truck,
                    COALESCE(bot_fee, 0) as bot_fee,
                    COALESCE(fuel_fee, 0) as fuel_fee,
                    COALESCE(driver_notes, '') as driver_notes,
                    COALESCE(pod_image, '') as pod_image,
                    COALESCE(gps_coordinates, '') as gps_coordinates
             FROM orders 
             WHERE UPPER(current_dept) = 'TMS' AND UPPER(status) IN ('PACKED', 'SHIPPING', 'DELIVERED')
             ORDER BY id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (getTmsOrders):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng TMS", detail: err.message });
    }
};

// 2. LẤY DANH SÁCH ĐỘI XE & QUẢN LÝ TÌNH TRẠNG BẢO TRÌ (MOCK FLEET DATA)
exports.getTruckFleet = async (req, res) => {
    try {
        // Trong thực tế sẽ viết bảng 'trucks'. Đây là dữ liệu chuẩn hóa phục vụ quản lý:
        const fleet = [
            { id: 1, license_plate: '29C-123.45', type: 'Tải 3.5 Tấn', maintenance_date: '2026-08-15', registry_expiry: '2026-12-20', fuel_norm: '12L/100km', status: 'Sẵn sàng' },
            { id: 2, license_plate: '51D-999.88', type: 'Tải 8 Tấn', maintenance_date: '2026-06-02', registry_expiry: '2026-11-14', fuel_norm: '18L/100km', status: 'Đang đi giao hàng' },
            { id: 3, license_plate: '43C-456.78', type: 'Đông lạnh 2.5 Tấn', maintenance_date: '2026-04-10', registry_expiry: '2026-05-30', fuel_norm: '14L/100km', status: '⚠️ Quá hạn bảo trì' },
            { id: 4, license_plate: '30H-888.66', type: 'Container 40ft', maintenance_date: '2026-09-01', registry_expiry: '2027-01-10', fuel_norm: '32L/100km', status: 'Sẵn sàng' }
        ];
        res.json(fleet);
    } catch (err) {
        res.status(500).json({ error: "Không thể lấy danh sách đội xe" });
    }
};

// 3. ĐIỀU PHỐI ĐƠN HÀNG VÀO CHUYẾN (Gán tuyến đường + Chọn đầu xe)
exports.assignDeliveryRoute = async (req, res) => {
    const { id } = req.params;
    const { route_name, license_plate } = req.body;
    try {
        const result = await pool.query(
            `UPDATE orders 
             SET delivery_route = $1, 
                 assigned_truck = $2, 
                 status = 'SHIPPING' 
             WHERE id = $3 RETURNING *`,
            [route_name, license_plate, id]
        );
        res.json({ message: "🚚 Đã điều xe và xếp lộ trình di chuyển thành công!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi điều phối chuyến xe" });
    }
};

// 4. CẬP NHẬT PHỤ PHÍ DỌC ĐƯỜNG & BIÊN BẢN E-POD (Kèm GPS)
exports.submitDriverPod = async (req, res) => {
    const { id } = req.params;
    const { bot_fee, fuel_fee, driver_notes, pod_image, gps_coordinates } = req.body;
    try {
        const result = await pool.query(
            `UPDATE orders 
             SET bot_fee = $1, 
                 fuel_fee = $2, 
                 driver_notes = $3, 
                 pod_image = $4, 
                 gps_coordinates = $5,
                 status = 'DELIVERED',
                 current_dept = 'ACC' -- Tự động đẩy sang phòng Kế toán kiểm tra dòng tiền lợi nhuận
             WHERE id = $6 RETURNING *`,
            [bot_fee, fuel_fee, driver_notes, pod_image, gps_coordinates, id]
        );
        res.json({ message: "🏁 Tài xế đã nộp E-POD thành công! Đơn hàng chuyển sang phòng Kế toán (ACC).", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi cập nhật biên bản E-POD giao hàng" });
    }
};