const pool = require('../config/db');

// Lấy danh sách hồ sơ chứng từ nâng cao kèm số liệu KPI tổng hợp
exports.getDocsOrders = async (req, res) => {
    try {
        // 1. DÙNG SELECT * : Tuyệt đối chống sập 500 kể cả khi Database thiếu cột mới
        const ordersResult = await pool.query('SELECT * FROM orders ORDER BY id DESC');
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