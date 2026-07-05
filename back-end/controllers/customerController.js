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