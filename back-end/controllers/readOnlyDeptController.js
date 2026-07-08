const pool = require('../config/db');

// Lấy danh sách hồ sơ chứng từ nâng cao kèm số liệu KPI tổng hợp
exports.getDocsOrders = async (req, res) => {
    try {
        // 1. DÙNG SELECT o.* : Tuyệt đối chống sập 500 kể cả khi Database thiếu cột mới
        //    ĐÃ BỔ SUNG: LEFT JOIN trucks để lấy đúng tên tài xế phụ trách xe (trước đây
        //    chỉ có biển số assigned_truck, không có tên tài xế dù giao diện có hiện nhãn này).
        const ordersResult = await pool.query(
            `SELECT o.*, t.driver_name as truck_driver_name
             FROM orders o
             LEFT JOIN trucks t ON o.assigned_truck = t.license_plate
             ORDER BY o.id DESC`
        );
        const allOrders = ordersResult.rows;



        // 2. LỌC DỮ LIỆU BẰNG JAVASCRIPT: Chuẩn hóa chữ để phòng DOCS thấy đơn NGAY KHI OMS DUYỆT
        const docsOrders = allOrders.filter(order => {
            const status = (order.status || '').trim().toUpperCase();
            const dept = (order.current_dept || '').trim().toUpperCase();

            // Định nghĩa các trạng thái ban đầu (Khi chưa được OMS duyệt)
            const isPendingStatus = ['PENDING', 'CHỜ DUYỆT', 'CHỜ OMS DUYỆT', 'MỚI TẠO'].includes(status);
            const isInitialDept = ['OMS', 'CUSTOMER'].includes(dept);

            // ĐIỀU KIỆN: Chỉ cần đơn đã được duyệt (Không còn Pending) hoặc đã đi qua các phòng ban khác
            return !isPendingStatus || !isInitialDept;
        }).map(order => {
            // Tự động bù đắp dữ liệu (Thay thế COALESCE) để Frontend Vue không bị lỗi render giao diện
            return {
                id: order.id,
                customer_name: order.customer_name,
                product_name: order.product_name,
                quantity: order.quantity,
                status: order.status,
                current_dept: order.current_dept,
                payment_status: order.payment_status,
                total_cost: order.total_cost,
                warehouse_location: order.warehouse_location || 'Chưa gán',
                delivery_route: order.delivery_route || 'Chưa lập',
                assigned_truck: order.assigned_truck || 'Chưa gán',
                truck_driver_name: order.truck_driver_name || '',
                bot_fee: Number(order.bot_fee) || 0,
                fuel_fee: Number(order.fuel_fee) || 0,
                driver_notes: order.driver_notes || 'Không có',
                pod_image: order.pod_image || '',
                created_at: order.created_at
            };
        });

        // 3. TỰ ĐỘNG TÍNH TOÁN KPI BẰNG JAVASCRIPT CHÍNH XÁC
        let totalArchives = docsOrders.length;
        let doneArchives = 0;
        let closedArchives = 0;
        let hasPodProof = 0;

        docsOrders.forEach(order => {
            const status = (order.status || '').trim().toUpperCase();
            const dept = (order.current_dept || '').trim().toUpperCase();

            if (['DONE', 'ĐÃ GIAO HÀNG', 'ĐÃ HOÀN THÀNH'].includes(status)) {
                doneArchives++;
            }
            if (dept === 'ARCHIVED') {
                closedArchives++;
            }
            if (order.pod_image && order.pod_image.trim() !== '') {
                hasPodProof++;
            }
        });

        // 4. TRẢ VỀ ĐÚNG CẤU TRÚC GÓI TIN MÀ FILE DocsView.vue ĐANG ĐỢI
        res.json({
            archives: docsOrders,
            kpi: {
                totalArchives: totalArchives,
                doneArchives: doneArchives,
                closedArchives: closedArchives,
                hasPodProof: hasPodProof
            }
        });

    } catch (err) {
        console.error("🔴 LỖI NGHIÊM TRỌNG TẠI READ_ONLY_DEPT_CONTROLLER:", err.message);
        res.status(500).json({ error: "Lỗi cơ sở dữ liệu phòng DOCS", detail: err.message });
    }
};

// Khóa cứng và niêm phong chứng từ vào kho lưu trữ vĩnh viễn
exports.lockArchiveFile = async (req, res) => {
    const { id } = req.params;
    try {
        const queryText = `
            UPDATE orders
            SET current_dept = 'ARCHIVED', status = 'DONE'
            WHERE id = $1
            RETURNING *
        `;
        const result = await pool.query(queryText, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy mã hồ sơ cần niêm phong!" });
        }

        // Ghi nhật ký hệ thống
        await pool.query(
            `INSERT INTO order_logs (order_id, old_status, new_status, notes)
             VALUES ($1, 'DONE', 'DONE', 'Phòng chứng từ (DOCS) tiến hành kiểm toán dữ liệu và Niêm phong hồ sơ vào kho số vĩnh viễn.')`,
            [id]
        );

        res.json({ message: "🔒 Đã niêm phong hồ sơ vào kho điện tử thành công!", order: result.rows[0] });
    } catch (err) {
        console.error("🔴 LỖI KHI KHÓA CHỨNG TỪ:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi khóa hồ sơ" });
    }
};

// =========================================================================
// PHÒNG DOCS GỬI BÁO CÁO 1 ĐƠN HÀNG CỤ THỂ CHO ADMIN
// Đã đổi từ gửi TOÀN BỘ đơn hàng -> chỉ gửi đúng đơn hàng được bấm (order_id).
// Không xuất file tải về - lưu snapshot vào bảng "reports" để Admin mở xem
// trực tiếp ngay trong giao diện (tab "Báo Cáo" bên AdminView.vue).
// Luôn truy vấn lại DB mới nhất (không tin dữ liệu từ client gửi lên) để
// báo cáo phản ánh đúng số liệu thời điểm gửi.
// =========================================================================
exports.submitOrderReportToAdmin = async (req, res) => {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).json({ error: "Thiếu order_id: phải chọn 1 đơn hàng cụ thể để gửi báo cáo" });
        }

        const orderResult = await pool.query(
            `SELECT o.*, t.driver_name as truck_driver_name
             FROM orders o
             LEFT JOIN trucks t ON o.assigned_truck = t.license_plate
             WHERE o.id = $1`,
            [order_id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: "Không tìm thấy đơn hàng cần gửi báo cáo" });
        }

        const order = orderResult.rows[0];
        const snapshot = [{
            id: order.id,
            customer_name: order.customer_name,
            product_name: order.product_name,
            quantity: order.quantity,
            status: order.status,
            current_dept: order.current_dept,
            payment_status: order.payment_status || '',
            warehouse_location: order.warehouse_location || 'Chưa gán',
            delivery_route: order.delivery_route || 'Chưa lập',
            assigned_truck: order.assigned_truck || 'Chưa gán',
            truck_driver_name: order.truck_driver_name || '',
            bot_fee: Number(order.bot_fee) || 0,
            fuel_fee: Number(order.fuel_fee) || 0,
            total_cost: Number(order.total_cost) || 0,
            driver_notes: order.driver_notes || '',
            created_at: order.created_at
        }];

        const title = (req.body.title && req.body.title.trim())
            ? req.body.title.trim()
            : `Báo cáo đơn hàng #${order.id} - ${new Date().toLocaleDateString('vi-VN')}`;
        const createdBy = req.body.created_by || 'Phòng Chứng Từ (DOCS)';

        const result = await pool.query(
            `INSERT INTO reports (title, report_type, created_by, data)
             VALUES ($1, 'DOCS_ORDER_REPORT', $2, $3)
             RETURNING id, title, created_by, created_at`,
            [title, createdBy, JSON.stringify(snapshot)]
        );

        res.json({
            message: `📤 Đã gửi báo cáo đơn hàng #${order.id} cho Admin thành công!`,
            report: result.rows[0]
        });
    } catch (err) {
        console.error("🔴 LỖI GỬI BÁO CÁO CHO ADMIN:", err.message);
        res.status(500).json({ error: "Lỗi hệ thống khi gửi báo cáo", detail: err.message });
    }
};