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
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (getTmsOrders):", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng TMS", detail: err.message });
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
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (getTruckFleet):", err.message);
        res.status(500).json({ error: "Không thể lấy danh sách đội xe", detail: err.message });
    }
};

// 2a. THÊM XE MỚI VÀO ĐỘI XE
exports.createTruck = async (req, res) => {
    const { license_plate, type, driver_name, fuel_norm, maintenance_date, registry_expiry, status } = req.body;
    if (!license_plate || !type) {
        return res.status(400).json({ error: "Thiếu biển số hoặc chủng loại xe" });
    }
    try {
        const result = await pool.query(
            `INSERT INTO trucks (license_plate, type, driver_name, fuel_norm, maintenance_date, registry_expiry, status)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'Sẵn sàng'))
             RETURNING *`,
            [license_plate, type, driver_name || null, fuel_norm || null, maintenance_date || null, registry_expiry || null, status || null]
        );
        res.json({ message: "✅ Đã thêm xe mới vào đội xe!", truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (createTruck):", err.message);
        if (err.code === '23505') {
            return res.status(409).json({ error: "Biển số xe đã tồn tại trong hệ thống" });
        }
        res.status(500).json({ error: "Lỗi thêm xe mới", detail: err.message });
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
            return res.status(404).json({ error: "Không tìm thấy xe" });
        }
        res.json({ message: "✅ Đã cập nhật thông tin xe!", truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (updateTruck):", err.message);
        res.status(500).json({ error: "Lỗi cập nhật xe", detail: err.message });
    }
};

// 2c. KIỂM TRA / CẬP NHẬT TÌNH TRẠNG KỸ THUẬT CỦA XE
// (Sẵn sàng / Đang đi giao hàng / Bảo trì / Quá hạn bảo trì / Hỏng ...)
exports.updateTruckStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({ error: "Thiếu trạng thái kỹ thuật cần cập nhật" });
    }
    try {
        const result = await pool.query(
            `UPDATE trucks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy xe" });
        }
        res.json({ message: `🔧 Đã cập nhật tình trạng xe: ${status}`, truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (updateTruckStatus):", err.message);
        res.status(500).json({ error: "Lỗi cập nhật tình trạng xe", detail: err.message });
    }
};

// 2d. XÓA XE KHỎI ĐỘI XE (ngừng khai thác / thanh lý)
exports.deleteTruck = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`DELETE FROM trucks WHERE id = $1 RETURNING *`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy xe" });
        }
        res.json({ message: "🗑️ Đã xóa xe khỏi đội xe." });
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (deleteTruck):", err.message);
        res.status(500).json({ error: "Lỗi xóa xe", detail: err.message });
    }
};

// 2e. NHẬN TỌA ĐỘ GPS THỜI GIAN THỰC TỪ APP TÀI XẾ (GpsBaseService bắn định kỳ)
// Nhận diện xe theo license_plate (không cần biết order id đang chạy)
exports.updateTruckGps = async (req, res) => {
    const { license_plate, lat, lng } = req.body;
    if (!license_plate || lat === undefined || lng === undefined) {
        return res.status(400).json({ error: "Thiếu biển số hoặc tọa độ GPS" });
    }
    try {
        const result = await pool.query(
            `UPDATE trucks
             SET current_lat = $1, current_lng = $2, gps_updated_at = NOW()
             WHERE license_plate = $3 RETURNING id, license_plate, current_lat, current_lng, gps_updated_at`,
            [lat, lng, license_plate]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy xe với biển số này" });
        }
        res.json({ message: "📍 Đã cập nhật vị trí GPS thời gian thực.", truck: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (updateTruckGps):", err.message);
        res.status(500).json({ error: "Lỗi cập nhật GPS xe", detail: err.message });
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
            [id, `Phòng TMS điều phối chuyến đi thành công. Xe tải: ${license_plate}, Lộ trình: ${route_name}`, 'APPROVED', 'SHIPPING']
        );

        // Xe vừa được gán chuyến -> cập nhật tình trạng kỹ thuật sang "Đang đi giao hàng"
        await pool.query(
            `UPDATE trucks SET status = 'Đang đi giao hàng', updated_at = NOW() WHERE license_plate = $1`,
            [license_plate]
        );

        res.json({ message: "🚚 Đã điều xe và xếp lộ trình di chuyển thành công!", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi điều phối chuyến xe" });
    }
};

// 3a. LẤY DANH SÁCH CHUYẾN ĐANG GIAO CỦA MỘT XE CỤ THỂ (dùng cho app tài xế mobile)
// Tài xế đăng nhập -> app biết biển số xe của mình -> gọi API này để lấy chuyến đang chạy
exports.getDriverTrips = async (req, res) => {
    const { license_plate } = req.params;
    if (!license_plate) {
        return res.status(400).json({ error: "Thiếu biển số xe" });
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
        console.error("🔴 LỖI TẠI TMS_CONTROLLER (getDriverTrips):", err.message);
        res.status(500).json({ error: "Không thể lấy danh sách chuyến của tài xế", detail: err.message });
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
            [id, `Tài xế nộp E-POD thành công tại GPS: ${gps_coordinates}. Chi phí phát sinh (BOT: $${bot_fee}, Dầu: $${fuel_fee}).`, 'SHIPPING', 'DELIVERED']
        );

        // Xe vừa giao xong đơn -> trả lại tình trạng "Sẵn sàng" cho lượt điều xe kế tiếp
        if (result.rows[0]?.assigned_truck) {
            await pool.query(
                `UPDATE trucks SET status = 'Sẵn sàng', updated_at = NOW() WHERE license_plate = $1`,
                [result.rows[0].assigned_truck]
            );
        }

        res.json({ message: "🏁 Tài xế đã nộp E-POD thành công! Đơn hàng chuyển sang phòng Kế toán (ACC).", order: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Lỗi cập nhật biên bản E-POD giao hàng" });
    }
};