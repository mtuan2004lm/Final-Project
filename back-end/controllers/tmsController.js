// tmsController.js
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
             WHERE UPPER(current_dept) = 'TMS'
               AND UPPER(status) IN ('APPROVED', 'PACKED', 'SHIPPING', 'DELIVERED')
             ORDER BY id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (getTmsOrders):", err.message);
        res.status(500).json({ error: "Error database of the TMS department", detail: err.message });
    }
};

// 2. LẤY DANH SÁCH ĐỘI XE (ĐÃ CHUYỂN SANG BẢNG "trucks" THẬT TRONG DB)
exports.getTruckFleet = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, license_plate, type, driver_name,
                    COALESCE(fuel_norm, '') as fuel_norm,
                    maintenance_date, registry_expiry, status,
                    current_lat, current_lng, gps_updated_at
             FROM trucks
             ORDER BY id ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (getTruckFleet):", err.message);
        res.status(500).json({ error: "Cannot get the list of the truck fleet", detail: err.message });
    }
};

// 2a. THÊM XE MỚI VÀO ĐỘI XE
exports.createTruck = async (req, res) => {
    const { license_plate, type, driver_name, fuel_norm, maintenance_date, registry_expiry, status } = req.body;
    if (!license_plate || !type) {
        return res.status(400).json({ error: "Missing license plate or type of truck" });
    }
    try {
        const result = await pool.query(
            `INSERT INTO trucks (license_plate, type, driver_name, fuel_norm, maintenance_date, registry_expiry, status)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'Sẵn sàng'))
             RETURNING *`,
            [license_plate, type, driver_name || null, fuel_norm || null, maintenance_date || null, registry_expiry || null, status || null]
        );
        res.json({ message: "✅ The new truck has been added to the fleet!", truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (createTruck):", err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: "The license plate already exists in the system" });
        }
        res.status(500).json({ error: "Error adding new truck", detail: err.message });
    }
};

// 2b. SỬA THÔNG TIN XE (loại xe, tài xế phụ trách, định mức dầu, lịch bảo trì/đăng kiểm)
exports.updateTruck = async (req, res) => {
    const { id } = req.params;
    const { type, driver_name, fuel_norm, maintenance_date, registry_expiry } = req.body;
    try {
        const result = await pool.query(
            `UPDATE trucks
             SET type = COALESCE($1, type),
                 driver_name = COALESCE($2, driver_name),
                 fuel_norm = COALESCE($3, fuel_norm),
                 maintenance_date = COALESCE($4, maintenance_date),
                 registry_expiry = COALESCE($5, registry_expiry),
                 updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [type, driver_name, fuel_norm, maintenance_date, registry_expiry, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "The truck could not be found" });
        }
        res.json({ message: "✅ The truck information has been updated!", truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (updateTruck):", err.message);
        res.status(500).json({ error: "Error updating truck", detail: err.message });
    }
};

// 2c. KIỂM TRA / CẬP NHẬT TÌNH TRẠNG KỸ THUẬT CỦA XE
// (Sẵn sàng / Đang đi giao hàng / Bảo trì / Quá hạn bảo trì / Hỏng ...)
exports.updateTruckStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({ error: "Missing technical status to update" });
    }
    try {
        const result = await pool.query(
            `UPDATE trucks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "The truck could not be found" });
        }
        res.json({ message: `🔧 The truck status has been updated: ${status}`, truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (updateTruckStatus):", err.message);
        res.status(500).json({ error: "Error updating truck status", detail: err.message });
    }
};

// 2d. XÓA XE KHỎI ĐỘI XE (ngừng khai thác / thanh lý)
exports.deleteTruck = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM trucks WHERE id = $1 RETURNING *`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "The truck could not be found" });
        }
        res.json({ message: "🗑️ The truck has been removed from the fleet." });
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (deleteTruck):", err.message);
        res.status(500).json({ error: "Error deleting truck", detail: err.message });
    }
};

// 2e. NHẬN TỌA ĐỘ GPS THỜI GIAN THỰC TỪ APP TÀI XẾ (GpsBaseService bắn định kỳ)
// Nhận diện xe theo license_plate (không cần biết order id đang chạy)
exports.updateTruckGps = async (req, res) => {
    const { license_plate, lat, lng } = req.body;
    if (!license_plate || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "Missing license plate or GPS coordinates" });
    }
    try {
        const result = await pool.query(
            `UPDATE trucks
             SET current_lat = $1, current_lng = $2, gps_updated_at = NOW()
             WHERE license_plate = $3 RETURNING id, license_plate, current_lat, current_lng, gps_updated_at`,
            [lat, lng, license_plate]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "The truck with this license plate could not be found" });
        }
        res.json({ message: "📍 The GPS position has been updated.", truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (updateTruckGps):", err.message);
        res.status(500).json({ error: "Error updating GPS position", detail: err.message });
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

        // 🌟 BỔ SUNG: Ghi nhận vết lịch sử sang chặng TMS cho dữ liệu đồng bộ
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `The TMS department successfully coordinated the shipment. Truck: ${license_plate}, Route: ${route_name}`, 'APPROVED', 'SHIPPING']
        );

        // Xe vừa được gán chuyến -> cập nhật tình trạng kỹ thuật sang "Đang đi giao hàng"
        await pool.query(
            `UPDATE trucks SET status = 'Shipping', updated_at = NOW() WHERE license_plate = $1`,
            [license_plate]
        );

        res.json({ message: "🚚 The truck has been assigned to the route and the shipment has been successfully coordinated!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Error coordinating the shipment" });
    }
};

// 3a. LẤY DANH SÁCH CHUYẾN ĐANG GIAO CỦA MỘT XE CỤ THỂ (dùng cho app tài xế mobile)
// Tài xế đăng nhập -> app biết biển số xe của mình -> gọi API này để lấy chuyến đang chạy
exports.getDriverTrips = async (req, res) => {
    const { license_plate } = req.params;
    if (!license_plate) {
        return res.status(400).json({ error: "Missing license plate" });
    }
    try {
        const result = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status,
                    COALESCE(delivery_route, '') as delivery_route,
                    COALESCE(assigned_truck, '') as assigned_truck,
                    COALESCE(bot_fee, 0) as bot_fee,
                    COALESCE(fuel_fee, 0) as fuel_fee,
                    COALESCE(driver_notes, '') as driver_notes,
                    COALESCE(gps_coordinates, '') as gps_coordinates
             FROM orders
             WHERE assigned_truck = $1
               AND UPPER(status) = 'SHIPPING'
             ORDER BY id ASC`,
            [license_plate]
        );
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 ERROR AT TMS_CONTROLLER (getDriverTrips):", err.message);
        res.status(500).json({ error: "Cannot get the list of trips for the driver", detail: err.message });
    }
};

// 4. CẬP NHẬT PHỤ PHÍ DỌC ĐƯỜNG & BIÊN BẢN E-POD
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
                 current_dept = 'ACC'
             WHERE id = $6 RETURNING *`,
            [bot_fee, fuel_fee, driver_notes, pod_image, gps_coordinates, id]
        );

        // 🌟 BỔ SUNG: Ghi nhận vết lịch sử khi tài xế hoàn thành chặng giao hàng ngoài đường
        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, `The driver successfully submitted the E-POD at GPS: ${gps_coordinates}. The incurred costs (BOT: $${bot_fee}, Fuel: $${fuel_fee}).`, 'SHIPPING', 'DELIVERED']
        );

        // Xe vừa giao xong đơn -> trả lại tình trạng "Sẵn sàng" cho lượt điều xe kế tiếp
        if (result.rows[0]?.assigned_truck) {
            await pool.query(
                `UPDATE trucks SET status = 'Ready', updated_at = NOW() WHERE license_plate = $1`,   
                [result.rows[0].assigned_truck]
            );
        }

        res.json({ message: "🏁 The driver has successfully submitted the E-POD! The order has been transferred to the Accounting Department (ACC).", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Error updating the E-POD delivery report" });
    }
};