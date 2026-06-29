const pool = require('../config/db');

// =========================================================================
// 1. LẤY TOÀN BỘ ĐƠN HÀNG CỦA KHÁCH (CẬP NHẬT CÁC CỘT MỚI THÊM)
// =========================================================================
exports.getCustomerOrders = async (req, res) => {
    let { username } = req.query; 

    try {
        if (!username || username === 'undefined' || username.trim() === '') {
            const resultAll = await pool.query('SELECT * FROM orders ORDER BY id DESC');
            return res.json(resultAll.rows);
        }

        const searchName = username.trim();
        const queryText = `
            SELECT id, username, customer_name, product_name, quantity, status, current_dept, notes,
                   COALESCE(cargo_type, 'Hàng hóa thông thường') as cargo_type,
                   COALESCE(total_price, 0) as total_price,
                   COALESCE(product_image, '') as product_image
            FROM orders 
            WHERE LOWER(username) = LOWER($1) 
               OR LOWER(customer_name) = LOWER($1)
               OR username IS NULL 
               OR username = ''
            ORDER BY id DESC
        `;
        
        const result = await pool.query(queryText, [searchName]);
        res.json(result.rows);
    } catch (err) {
        console.error("🔴 LỖI TRUY XUẤT ĐƠN HÀNG CUSTOMER:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi lấy danh sách đơn ký gửi", detail: err.message });
    }
};

// =========================================================================
// 2. KHỞI TẠO ĐƠN HÀNG MỚI (CHUYỂN THẲNG QUA PHÒNG OMS SAU KHI TẠO)
// =========================================================================
exports.createOrder = async (req, res) => {
    const { username, customer_name, product_name, cargo_type, quantity, total_price } = req.body;
    
    // Đọc tên file ảnh hàng hóa từ Multer middleware nếu có upload
    const productImagePath = req.file ? `/uploads/${req.file.filename}` : '';

    try {
        // Ép kiểu dữ liệu số an toàn chống lỗi dữ liệu trống
        const safePrice = parseFloat(total_price) || 0;

        // ĐÃ SỬA: Đổi giá trị tham số phòng ban cuối cùng từ 'CUSTOMER' thành 'OMS'
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
        console.error("🔴 LỖI KHỞI TẠO ĐƠN HÀNG PHÍA CUSTOMER:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu khi đăng ký đơn hàng mới", detail: err.message });
    }
};