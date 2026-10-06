// ĐỢT 1 - router độc lập, không đụng orderRoutes.js hiện tại.
// Cài đặt: đặt file này vào backend/routes/, rồi trong server.js (app.js) thêm:
//     app.use('/api/ext', require('./routes/phase1Routes'));
// Cần multer (đã dùng cho upload ảnh đơn hàng). Thư mục ảnh: uploads/ (đã được serve tĩnh).
const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../config/db');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, 'pod-' + Date.now() + path.extname(file.originalname || '.jpg'))
});
const upload = multer({ storage });

const log = (orderId, oldS, newS, notes) =>
    pool.query(
        "INSERT INTO order_logs (order_id, old_status, new_status, notes) VALUES ($1,$2,$3,$4)",
        [orderId, oldS, newS, notes]
    );

// ========================= 1. ĐỊA CHỈ GIAO HÀNG =========================
router.get('/addresses', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        const r = await pool.query(
            'SELECT * FROM customer_addresses WHERE LOWER(username)=LOWER($1) ORDER BY is_default DESC, id DESC',
            [username]
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/addresses', async (req, res) => {
    const { username, label, address, receiver_name, receiver_phone, is_default } = req.body;
    if (!username || !label || !address) return res.status(400).json({ error: 'Missing fields' });
    try {
        if (is_default) await pool.query('UPDATE customer_addresses SET is_default=FALSE WHERE LOWER(username)=LOWER($1)', [username]);
        const r = await pool.query(
            `INSERT INTO customer_addresses (username,label,address,receiver_name,receiver_phone,is_default)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [username, label, address, receiver_name || '', receiver_phone || '', !!is_default]
        );
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/addresses/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM customer_addresses WHERE id=$1', [req.params.id]);
        res.json({ message: 'Deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Gắn địa chỉ giao + lịch lấy hàng vào đơn (gọi ngay sau khi tạo đơn)
router.put('/orders/:id/delivery-info', async (req, res) => {
    const { delivery_address, receiver_name, receiver_phone, pickup_date, pickup_note } = req.body;
    try {
        const r = await pool.query(
            `UPDATE orders SET delivery_address=$1, receiver_name=$2, receiver_phone=$3,
                    pickup_date=$4, pickup_note=$5 WHERE id=$6 RETURNING *`,
            [delivery_address || null, receiver_name || null, receiver_phone || null,
             pickup_date || null, pickup_note || null, req.params.id]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
        await log(req.params.id, r.rows[0].status, r.rows[0].status,
            `Delivery info updated. Address: ${delivery_address || '-'}. Pickup: ${pickup_date || 'not scheduled'}`);
        res.json({ message: 'Saved', order: r.rows[0] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================= 2. HỦY ĐƠN (chỉ khi còn NEW/ chưa duyệt) =========================
router.put('/orders/:id/cancel', async (req, res) => {
    const { reason } = req.body;
    try {
        const cur = await pool.query('SELECT status, payment_status, total_price FROM orders WHERE id=$1', [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Order not found' });
        const o = cur.rows[0];
        if (o.status !== 'NEW' && o.status !== 'RETURNED') {
            return res.status(400).json({ error: 'Only orders that have not been approved can be cancelled.' });
        }
        const paid = o.payment_status === 'PAID';
        await pool.query(
            `UPDATE orders SET status='CANCELLED', cancel_reason=$1, current_dept='CUSTOMER',
                    refund_status=$2, refund_amount=$3 WHERE id=$4`,
            [reason || 'Customer cancelled', paid ? 'PENDING' : 'NONE', paid ? o.total_price : 0, req.params.id]
        );
        await log(req.params.id, o.status, 'CANCELLED', `Customer cancelled the order. Reason: ${reason || '-'}`);
        res.json({ message: paid ? 'Order cancelled. Refund is pending.' : 'Order cancelled.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================= 3. YÊU CẦU TRẢ HÀNG (sau khi giao) =========================
router.post('/orders/:id/return-request', async (req, res) => {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'Please enter a reason' });
    try {
        const cur = await pool.query('SELECT status, return_status FROM orders WHERE id=$1', [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Order not found' });
        const o = cur.rows[0];
        if (!['DONE', 'DELIVERED'].includes(o.status)) return res.status(400).json({ error: 'Only delivered orders can be returned.' });
        if (o.return_status === 'REQUESTED' || o.return_status === 'APPROVED') return res.status(400).json({ error: 'A return request already exists.' });
        await pool.query(`UPDATE orders SET return_status='REQUESTED', return_reason=$1 WHERE id=$2`, [reason, req.params.id]);
        await log(req.params.id, o.status, o.status, `Customer requested a return. Reason: ${reason}`);
        res.json({ message: 'Return request sent to OMS.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// OMS: danh sách yêu cầu trả hàng
router.get('/oms/return-requests', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, customer_name, product_name, quantity, total_price, status, return_status, return_reason,
                    refund_status, refund_amount
             FROM orders WHERE return_status IN ('REQUESTED','APPROVED','REJECTED') ORDER BY id DESC`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// OMS: duyệt / từ chối. Duyệt => tạo yêu cầu hoàn tiền cho ACC
router.put('/oms/return-requests/:id', async (req, res) => {
    const { approve, note } = req.body;
    try {
        const cur = await pool.query('SELECT status, total_price FROM orders WHERE id=$1', [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Order not found' });
        const o = cur.rows[0];
        if (approve) {
            await pool.query(
                `UPDATE orders SET return_status='APPROVED', refund_status='PENDING', refund_amount=$1 WHERE id=$2`,
                [o.total_price, req.params.id]
            );
            await log(req.params.id, o.status, o.status, 'OMS approved the return request. Refund pending at ACC.');
        } else {
            await pool.query(`UPDATE orders SET return_status='REJECTED', return_reject_note=$1 WHERE id=$2`, [note || '', req.params.id]);
            await log(req.params.id, o.status, o.status, `OMS rejected the return request. ${note || ''}`);
        }
        res.json({ message: approve ? 'Return approved' : 'Return rejected' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ACC: danh sách hoàn tiền + xác nhận đã hoàn
router.get('/acc/refunds', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, customer_name, product_name, refund_amount, refund_status, status, cancel_reason, return_reason
             FROM orders WHERE refund_status IN ('PENDING','REFUNDED') ORDER BY id DESC`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/orders/:id/refund', async (req, res) => {
    try {
        const r = await pool.query(`UPDATE orders SET refund_status='REFUNDED' WHERE id=$1 AND refund_status='PENDING' RETURNING status`, [req.params.id]);
        if (!r.rows.length) return res.status(400).json({ error: 'No pending refund for this order' });
        await log(req.params.id, r.rows[0].status, r.rows[0].status, 'ACC confirmed the refund has been transferred.');
        res.json({ message: 'Refund confirmed' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================= 4. PROOF OF DELIVERY =========================
// multipart/form-data: image (file, tùy chọn), signature (data URL PNG), received_by (text)
router.post('/orders/:id/pod', upload.single('image'), async (req, res) => {
    const { signature, received_by } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    if (!imagePath && !signature) return res.status(400).json({ error: 'Photo or signature required' });
    try {
        const cur = await pool.query('SELECT status FROM orders WHERE id=$1', [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'Order not found' });
        await pool.query(
            `UPDATE orders SET pod_image=COALESCE($1, pod_image), pod_signature=COALESCE($2, pod_signature), pod_received_by=$3, pod_at=NOW() WHERE id=$4`,
            [imagePath, signature || null, received_by || null, req.params.id]
        );
        await log(req.params.id, cur.rows[0].status, cur.rows[0].status,
            `Proof of delivery recorded. Received by: ${received_by || '-'}`);
        res.json({ message: 'Proof of delivery saved', pod_image: imagePath });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/orders/:id/pod', async (req, res) => {
    try {
        const r = await pool.query(
            'SELECT id, pod_image, pod_signature, pod_received_by, pod_at FROM orders WHERE id=$1', [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Order not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========================= 5. TMS: LỌC THEO ĐỊA CHỈ + GOM TUYẾN =========================
// Danh sách đơn cho TMS, có kèm địa chỉ giao để lọc/gom (thay cho tuyến gán sẵn cứng).
router.get('/tms/orders', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status, current_dept,
                    COALESCE(delivery_route, '') as delivery_route,
                    COALESCE(assigned_truck, '') as assigned_truck,
                    COALESCE(bot_fee, 0) as bot_fee,
                    COALESCE(fuel_fee, 0) as fuel_fee,
                    COALESCE(driver_notes, '') as driver_notes,
                    COALESCE(pod_image, '') as pod_image,
                    COALESCE(gps_coordinates, '') as gps_coordinates,
                    COALESCE(delivery_address, '') as delivery_address,
                    receiver_name, receiver_phone, pickup_date, pickup_note
             FROM orders
             WHERE UPPER(current_dept) = 'TMS'
               AND UPPER(status) IN ('APPROVED', 'PACKED', 'SHIPPING', 'DELIVERED')
             ORDER BY pickup_date ASC NULLS LAST, id ASC`
        );
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Gom nhiều đơn thành 1 tuyến + gán 1 xe cho cả tuyến (1 transaction: hoặc tất cả, hoặc không đơn nào).
// body: { order_ids: [1,2,3], route_name: "Quận 9, TP.HCM - 06/10", license_plate: "51C-123.45" }
router.post('/tms/consolidate', async (req, res) => {
    const { order_ids, route_name, license_plate } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length === 0) return res.status(400).json({ error: 'No orders selected' });
    if (!route_name || !route_name.trim()) return res.status(400).json({ error: 'Route name is required' });
    if (!license_plate) return res.status(400).json({ error: 'Truck is required' });

    const ids = order_ids.map(Number).filter(Number.isInteger);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const truck = await client.query('SELECT status FROM trucks WHERE license_plate=$1 FOR UPDATE', [license_plate]);
        if (!truck.rows.length) throw new Error('Truck not found');

        const found = await client.query(
            `SELECT id, status FROM orders
             WHERE id = ANY($1::int[]) AND UPPER(current_dept)='TMS' AND UPPER(status) IN ('APPROVED','PACKED')
             FOR UPDATE`, [ids]);
        if (found.rows.length !== ids.length) {
            throw new Error('Some orders are no longer available for dispatch. Please refresh and try again.');
        }

        await client.query(
            `UPDATE orders SET delivery_route=$1, assigned_truck=$2, status='SHIPPING' WHERE id = ANY($3::int[])`,
            [route_name.trim(), license_plate, ids]);

        for (const o of found.rows) {
            await client.query(
                `INSERT INTO order_logs (order_id, old_status, new_status, notes) VALUES ($1,$2,'SHIPPING',$3)`,
                [o.id, o.status, `TMS consolidated ${ids.length} order(s) into route "${route_name.trim()}". Truck: ${license_plate}`]);
        }

        await client.query(`UPDATE trucks SET status='Đang đi giao hàng', updated_at=NOW() WHERE license_plate=$1`, [license_plate]);

        await client.query('COMMIT');
        res.json({ message: `Route created with ${ids.length} order(s)`, count: ids.length });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally {
        client.release();
    }
});

module.exports = router;