const pool = require('../config/db');

// =========================================================================
// 1. LẤY DANH SÁCH ĐƠN HÀNG VÀ BÁO CÁO TỔNG KẾT DOANH THU TÀI CHÍNH
// =========================================================================
exports.getAccOrders = async (req, res) => {
    try {
        // Lấy tất cả đơn hàng để hiển thị sổ cái chứng từ
        // ĐÃ SỬA LỖI 500: cargo_image là cột kiểu text (đường dẫn ảnh do WMS upload),
        // COALESCE(cargo_image, false) trộn text với boolean khiến Postgres báo lỗi
        // "COALESCE types text and boolean cannot be matched" -> sập toàn bộ API.
        const ordersResult = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status, current_dept, payment_status, total_cost,
                    COALESCE(warehouse_location, 'Not assigned') as warehouse_location,
                    COALESCE(cargo_condition, 'Normal') as cargo_condition,
                    COALESCE(cargo_image, '') as cargo_image,
                    COALESCE(delivery_route, 'Route not yet planned') as delivery_route,
                    COALESCE(assigned_truck, 'No vehicle assigned') as assigned_truck,
                    COALESCE(bot_fee, 0) as bot_fee,
                    COALESCE(fuel_fee, 0) as fuel_fee,
                    COALESCE(driver_notes, '') as driver_notes,
                    COALESCE(pod_image, '') as pod_image
             FROM orders
             ORDER BY id DESC`
        );

        // THUẬT TOÁN TỔNG KẾT DOANH THU & CHI PHÍ E-POD TỪ DATABASE
        const financialSummary = await pool.query(`
            SELECT
                -- 1. Tổng tiền hàng dự kiến thu từ Khách hàng
                SUM(total_cost) as total_customer_revenue,

                -- 2. Tổng tiền hàng THỰC TẾ ĐÃ THU (Đơn hàng đã PAID hoặc DONE)
                SUM(CASE WHEN payment_status = 'PAID' OR status = 'DONE' THEN total_cost ELSE 0 END) as collected_customer_revenue,

                -- 3. Tổng chi phí E-POD phát sinh (BOT + Xăng xe) từ tài xế gửi về
                SUM(COALESCE(bot_fee, 0) + COALESCE(fuel_fee, 0)) as total_epod_cost,

                -- 4. Chi tiết tách biệt phần tiền E-POD
                SUM(COALESCE(bot_fee, 0)) as total_bot_fee,
                SUM(COALESCE(fuel_fee, 0)) as total_fuel_fee
            FROM orders
        `);

        const summary = financialSummary.rows[0];

        // Tính toán các chỉ số tài chính thực tế
        const customerRevenue = parseFloat(summary.collected_customer_revenue) || 0;
        const epodCost = parseFloat(summary.total_epod_cost) || 0;
        const netProfit = customerRevenue - epodCost; // Lợi nhuận ròng thực tế

        res.json({
            orders: ordersResult.rows,
            summary: {
                totalCustomerRevenue: parseFloat(summary.total_customer_revenue) || 0,
                collectedCustomerRevenue: customerRevenue,
                totalEpodCost: epodCost,
                totalBotFee: parseFloat(summary.total_bot_fee) || 0,
                totalFuelFee: parseFloat(summary.total_fuel_fee) || 0,
                netProfit: netProfit
            }
        });
    } catch (err) {
        console.error("🔴 ERROR AT ACC_CONTROLLER (getAccOrders):", err.message);
        res.status(500).json({ error: "Error retrieving list of financial accounting data", detail: err.message });
    }
};

// =========================================================================
// 2. KẾ TOÁN DUYỆT ĐỐI SOÁT DÒNG TIỀN (CHIA TÁCH THEO TỪNG GIAI ĐOẠN)
// =========================================================================
exports.approvePayment = async (req, res) => {
    const { id } = req.params;
    try {
        // Kiểm tra trạng thái hiện tại của đơn hàng
        const orderCheck = await pool.query("SELECT status, total_cost, COALESCE(bot_fee,0) as bot_fee, COALESCE(fuel_fee,0) as fuel_fee FROM orders WHERE id = $1", [id]);
        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ error: "No order records matching the review requirement were found!" });
        }

        const currentOrder = orderCheck.rows[0];
        let updateQuery = '';
        let logNotes = '';

        if (currentOrder.status === 'DELIVERED') {
            // TRƯỜNG HỢP 1: Duyệt quyết toán phần chi phí E-POD của Tài xế gửi về khi giao xong
            updateQuery = `UPDATE orders SET current_dept = 'DONE', status = 'DONE' WHERE id = $1 RETURNING *`;
            logNotes = `The accountant has reviewed the E-POD documents: Approved the payment for the toll fee portion BOT (${currentOrder.bot_fee} USD) and fuel(${currentOrder.fuel_fee} USD). Order settlement file successfully closed.`;
        } else {
            // TRƯỜNG HỢP 2: Duyệt thu tiền cọc/tiền hàng đầu kỳ của Khách hàng gửi lên
            updateQuery = `UPDATE orders SET payment_status = 'PAID', current_dept = 'WMS', status = 'APPROVED' WHERE id = $1 RETURNING *`;
            logNotes = `The accountant confirms receipt of the full payment from the customer.(${currentOrder.total_cost} USD). Activate the order to transfer unloading/delivery to the Warehouse Management System (WMS).`;
        }

        const result = await pool.query(updateQuery, [id]);

        // Ghi lịch sử sổ cái thời gian thực
        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes)
             VALUES ($1, $2, $3, $4)`,
            [id, currentOrder.status, result.rows[0].status, logNotes]
        );

        res.json({
            message: "⚡ Financial reconciliation and cash flow approval were successful!",
            order: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 ERROR AT ACC_CONTROLLER (approvePayment):", err.message);
        res.status(500).json({ error: "Accounting approval system error", detail: err.message });
    }
};