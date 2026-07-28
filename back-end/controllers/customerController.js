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
                   COALESCE(o.cargo_type, 'Normal goods') as cargo_type,
                   COALESCE(o.total_price, 0) as total_price,
                   COALESCE(o.payment_status, '') as payment_status,
                   COALESCE(o.product_image, '') as product_image,
                   COALESCE(o.assigned_truck, '') as assigned_truck,
                   COALESCE(o.delivery_route, '') as delivery_route,
                   o.rating,
                   o.feedback,
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
        console.error("🔴 ERROR AT CUSTOMER_CONTROLLER (getCustomerOrders):", err.message);
        res.status(500).json({ error: "Error system when retrieving customer orders" });
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
            cargo_type || 'Normal goods',
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
            [newOrder.id, `The customer successfully created the online declaration, transferred the OMS for the shipment: ${product_name}`]
        );

        res.status(201).json({
            message: "Request for shipment creation successful!",
            order: newOrder
        });
    } catch (err) {
        console.error("🔴 ERROR AT CUSTOMER_CONTROLLER (createOrder):", err.message);
        res.status(500).json({ error: "Error system when creating order" });
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
            return res.status(404).json({ error: "The order to be confirmed for payment could not be found!" });
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
            [id, 'The customer confirmed the payment transfer via QR. The document was transferred to the Accounting Department (ACC) for reconciliation and approval of the payment.', oldStatus, 'PENDING']
        );

        res.json({ message: "✅ Payment confirmation has been recorded! Waiting for the Accounting Department to reconcile and approve.", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 ERROR AT CUSTOMER_CONTROLLER (confirmPaymentSubmitted):", err.message);
        res.status(500).json({ error: "Error system when confirming payment", detail: err.message });
    }
};

// =========================================================================
// 4. MỚI: KHÁCH HÀNG ĐÁNH GIÁ DỊCH VỤ SAU KHI NHẬN HÀNG
//    Route này trước đây bị THIẾU HOÀN TOÀN ở backend (POST /api/orders/:id/feedback),
//    khiến nút "Submit Service Review" trên CustomerView.vue luôn báo lỗi 404 Not Found.
//    Hai cột rating (integer) và feedback (text) đã có sẵn trong bảng orders nên
//    chỉ cần UPDATE, không phải sửa schema.
// =========================================================================
exports.submitFeedback = async (req, res) => {
    const { id } = req.params;
    const { rating, feedback } = req.body;

    try {
        // Chỉ nhận điểm từ 1-5 để tránh dữ liệu rác làm sai thống kê phía Admin
        const safeRating = parseInt(rating);
        if (isNaN(safeRating) || safeRating < 1 || safeRating > 5) {
            return res.status(400).json({ error: "The rating must be a number between 1 and 5!" });
        }

        const existing = await pool.query("SELECT status FROM orders WHERE id = $1", [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: "The order to be reviewed could not be found!" });
        }

        // Chỉ cho đánh giá khi hàng đã thực sự tới tay khách (DELIVERED hoặc DONE),
        // khớp với điều kiện lọc completedOrders bên CustomerView.vue.
        const currentStatus = existing.rows[0].status;
        if (currentStatus !== 'DELIVERED' && currentStatus !== 'DONE') {
            return res.status(400).json({ error: "Only delivered or completed orders can be reviewed!" });
        }

        const result = await pool.query(
            `UPDATE orders
             SET rating = $1, feedback = $2
             WHERE id = $3 RETURNING *`,
            [safeRating, feedback || '', id]
        );

        await pool.query(
            `INSERT INTO order_logs (order_id, notes, old_status, new_status)
             VALUES ($1, $2, $3, $4)`,
            [
                id,
                `The customer rated the service ${safeRating}/5 stars. Feedback: ${feedback || '(no comment)'}`,
                currentStatus,
                currentStatus
            ]
        );

        res.json({ message: "✅ Thank you for your service review!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 ERROR AT CUSTOMER_CONTROLLER (submitFeedback):", err.message);
        res.status(500).json({ error: "Error system when submitting the review", detail: err.message });
    }
};