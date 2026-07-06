const pool = require('../config/db');

// =========================================================================
// 1. LẤY TOÀN BỘ ĐƠN HÀNG CỦA KHÁCH (ĐÃ SỬA: THÊM VỊ TRÍ GPS XE THỜI GIAN THỰC)
// =========================================================================
exports.getCustomerOrders = async (req, res) => {
    let { username } = req.query;

    try {
        if (!username || username === 'undefined' || username.trim() === '') {
            // LEFT JOIN trucks để trả kèm vị trí GPS xe hiện tại (nếu đơn đã được gán xe)
            const resultAll = await pool.query(
                `SELECT o.*,
                        t.current_lat as truck_lat,
                        t.current_lng as truck_lng,
                        t.gps_updated_at as truck_gps_updated_at
                 FROM orders o
                 LEFT JOIN trucks t ON o.assigned_truck = t.license_plate
                 ORDER BY o.id DESC`
            );
            return res.json(resultAll.rows);
        }

        const searchName = username.trim();
        // ĐÃ BỔ SUNG: LEFT JOIN trucks lấy current_lat/current_lng/gps_updated_at
        // (được app tài xế bắn định kỳ lên server) để khách hàng xem được vị trí
        // xe đang chở đơn hàng của mình trên bản đồ, thay vì chỉ biết trạng thái chữ.
        const queryText = `
            SELECT o.id, o.username, o.customer_name, o.product_name, o.quantity, o.status, o.current_dept, o.notes, o.driver_notes,
                   COALESCE(o.cargo_type, 'Hàng hóa thông thường') as cargo_type,
                   COALESCE(o.total_price, 0) as total_price,
                   COALESCE(o.payment_status, '') as payment_status,
                   COALESCE(o.product_image, '') as product_image,
                   COALESCE(o.assigned_truck, '') as assigned_truck,
                   COALESCE(o.delivery_route, '') as delivery_route,
                   t.current_lat as truck_lat,
                   t.current_lng as truck_lng,
                   t.gps_updated_at as truck_gps_updated_at
            FROM orders o
            LEFT JOIN trucks t ON o.assigned_truck = t.license_plate
            WHERE LOWER(o.username) = LOWER($1)
               OR LOWER(o.customer_name) = LOWER($1)
               OR o.username IS NULL
               OR o.username = ''
            ORDER BY o.id DESC
        `;

        const result = await pool.query(queryText, [searchName]);
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TRUY XUẤT ĐƠN HÀNG CUSTOMER:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi truy xuất đơn hàng" });
    }
};

// =========================================================================
// 2. KHỞI TẠO ĐƠN HÀNG MỚI (TỜ KHAI KÝ GỬI HÀNG HÓA CHUYỂN OMS)
// =========================================================================
exports.createOrder = async (req, res) => {
    const { username, customer_name, product_name, cargo_type, quantity, total_price } = req.body;
    const productImagePath = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        const safePrice = parseFloat(total_price) || 0;

        // Thiết lập luân chuyển ban đầu cuối cùng từ 'CUSTOMER' thành 'OMS'
        const queryText = `
            INSERT INTO orders (
                username, customer_name, product_name, cargo_type,
                quantity, total_price, total_cost, product_image, status, current_dept
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NEW', 'OMS')
            RETURNING *
        `;

        const values = [
            username,
            customer_name,
            product_name,
            cargo_type || 'Hàng hóa thông thường',
            parseInt(quantity) || 1,
            safePrice,          // $6: total_price
            safePrice,          // $7: total_cost
            productImagePath    // $8
        ];

        const result = await pool.query(queryText, values);
        const newOrder = result.rows[0];

        // Ghi log hành trình đơn hàng mới khởi tạo
        await pool.query(
            "INSERT INTO order_logs (order_id, old_status, new_status, notes) VALUES ($1, 'NONE', 'NEW', $2)",
            [newOrder.id, `Khách hàng tạo tờ khai trực tuyến thành công, chuyển cấp thẩm định OMS cho lô hàng: ${product_name}`]
        );

        res.status(201).json({
            message: "Tạo yêu cầu luân chuyển thành công!",
            order: newOrder
        });
    } catch (err) {
        console.error("🔴 LỖI KHỞI TẠO ĐƠN HÀNG:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi khởi tạo đơn hàng" });
    }
};

// =========================================================================
// 3. MỚI: KHÁCH HÀNG XÁC NHẬN ĐÃ CHUYỂN KHOẢN (Cổng thanh toán -> chờ Kế toán duyệt)
//    Route này trước đây bị THIẾU HOÀN TOÀN ở backend (PUT /api/orders/:id/pay),
//    khiến nút "Tôi đã hoàn tất chuyển khoản" trên CustomerView.vue luôn báo lỗi.
//    Không đánh dấu PAID ngay - chỉ chuyển hồ sơ sang phòng Kế toán (ACC) để họ
//    đối soát và tự bấm duyệt (đúng như accController.approvePayment đang chờ
//    status = 'PENDING' + current_dept = 'ACC').
// =========================================================================
exports.confirmPaymentSubmitted = async (req, res) => {
    const { id } = req.params;
    try {
        const oldOrder = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
        if (oldOrder.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng cần xác nhận thanh toán!" });
        }
        const oldStatus = oldOrder.rows[0].status;

        const result = await pool.query(
            `UPDATE orders
             SET status = 'PENDING', current_dept = 'ACC', payment_status = 'PENDING'
             WHERE id = $1 RETURNING *`,
            [id]
        );

        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [id, 'Khách hàng xác nhận đã chuyển khoản thanh toán qua QR. Hồ sơ chuyển phòng Kế toán (ACC) đối soát và duyệt thu tiền.', oldStatus, 'PENDING']
        );

        res.json({ message: "✅ Đã ghi nhận xác nhận thanh toán! Chờ phòng Kế toán đối soát và duyệt.", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI XÁC NHẬN THANH TOÁN CỦA KHÁCH HÀNG:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi xác nhận thanh toán", detail: err.message });
    }
};