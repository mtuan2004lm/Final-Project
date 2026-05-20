const pool = require('../config/db');

// Lấy danh sách các đơn hàng đang nằm tại phòng Kế toán chờ duyệt tiền
exports.getAccOrders = async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM orders WHERE current_dept = 'ACC' ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi lấy danh sách đơn của Kế toán");
    }
};

// Kế toán bấm Xác nhận đã nhận tiền -> Duyệt thanh toán thành công và trả đơn về cho phòng ban Logistics tiếp tục xử lý
exports.approvePayment = async (req, res) => {
    const { id } = req.params;
    try {
        // Cập nhật trạng thái thanh toán thành PAID (Đã thu tiền) 
        // Sau khi thu tiền xong, chuyển tiếp đơn sang khâu xử lý tiếp theo (Ví dụ: Trở lại OMS hoặc đẩy thẳng sang WMS/TMS tuỳ luồng của bạn, ở đây tạm đưa về 'OMS' đã duyệt tiền)
        await pool.query(
            "UPDATE orders SET payment_status = 'PAID', current_dept = 'OMS' WHERE id = $1", 
            [id]
        );
        res.json({ message: "Kế toán đã xác nhận nhận đủ tiền. Đơn hàng hợp lệ để bốc xếp!" });
    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi xác nhận thanh toán");
    }
};