// ĐỢT 2 - thông báo trong app, chat hỗ trợ, dashboard khách, chứng từ (vận đơn / hóa đơn).
// Mount trong index.js:  app.use('/api/ext', phase2Routes);
const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// =====================================================================
// 1. THÔNG BÁO (notification center)
//    Thông báo được tạo tự động bởi TRIGGER trong phase2_migration.sql
// =====================================================================
router.get('/notifications', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        const list = await pool.query(
            `SELECT id, order_id, title, message, is_read, created_at
             FROM notifications WHERE LOWER(username) = LOWER($1)
             ORDER BY id DESC LIMIT 50`, [username]);
        const unread = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM notifications WHERE LOWER(username) = LOWER($1) AND is_read = FALSE`, [username]);
        res.json({ unread: unread.rows[0].cnt, notifications: list.rows });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Đánh dấu đã đọc: có id -> 1 thông báo, không có id -> tất cả của user
router.put('/notifications/read', async (req, res) => {
    const { username, id } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        if (id) {
            await pool.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1 AND LOWER(username) = LOWER($2)`, [id, username]);
        } else {
            await pool.query(`UPDATE notifications SET is_read = TRUE WHERE LOWER(username) = LOWER($1)`, [username]);
        }
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 2. CHAT HỖ TRỢ KHÁCH <-> OMS (mỗi khách = 1 cuộc hội thoại)
// =====================================================================
// Lấy tin nhắn của 1 khách. after = id tin cuối đã có (tải thêm tin mới, nhẹ khi polling)
router.get('/support/messages', async (req, res) => {
    const { username, after } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        const r = await pool.query(
            `SELECT id, username, order_id, sender, message, is_read, created_at
             FROM support_messages
             WHERE LOWER(username) = LOWER($1) AND id > $2
             ORDER BY id ASC LIMIT 200`, [username, parseInt(after) || 0]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/support/messages', async (req, res) => {
    const { username, sender, message, order_id } = req.body;
    if (!username || !message || !message.trim()) return res.status(400).json({ error: 'Missing username or message' });
    const from = sender === 'OMS' ? 'OMS' : 'CUSTOMER';
    try {
        const r = await pool.query(
            `INSERT INTO support_messages (username, order_id, sender, message)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [username, order_id || null, from, message.trim()]);
        // OMS trả lời -> khách nhận thông báo trong chuông
        if (from === 'OMS') {
            await pool.query(
                `INSERT INTO notifications (username, order_id, title, message) VALUES ($1, $2, 'New support reply', $3)`,
                [username, order_id || null, 'Support: ' + message.trim().slice(0, 120)]);
        }
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Đánh dấu đã đọc: reader = 'OMS' (đọc tin của khách) hoặc 'CUSTOMER' (đọc tin của OMS)
router.put('/support/read', async (req, res) => {
    const { username, reader } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    const senderToMark = reader === 'OMS' ? 'CUSTOMER' : 'OMS';
    try {
        await pool.query(
            `UPDATE support_messages SET is_read = TRUE WHERE LOWER(username) = LOWER($1) AND sender = $2 AND is_read = FALSE`,
            [username, senderToMark]);
        res.json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Số tin khách chưa được OMS đọc, của riêng 1 khách (badge trên tab Chat bên khách = tin OMS chưa đọc)
router.get('/support/unread', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        const r = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM support_messages
             WHERE LOWER(username) = LOWER($1) AND sender = 'OMS' AND is_read = FALSE`, [username]);
        res.json({ unread: r.rows[0].cnt });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// OMS: danh sách các cuộc hội thoại (mới nhất trước) kèm số tin khách chưa đọc
router.get('/support/threads', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT t.username,
                    t.last_id,
                    m.message AS last_message,
                    m.sender AS last_sender,
                    m.created_at AS last_at,
                    COALESCE(u.unread, 0)::int AS unread
             FROM (SELECT LOWER(username) AS lname, MAX(username) AS username, MAX(id) AS last_id
                   FROM support_messages GROUP BY LOWER(username)) t
             JOIN support_messages m ON m.id = t.last_id
             LEFT JOIN (SELECT LOWER(username) AS lname, COUNT(*) AS unread
                        FROM support_messages WHERE sender = 'CUSTOMER' AND is_read = FALSE
                        GROUP BY LOWER(username)) u ON u.lname = t.lname
             ORDER BY t.last_id DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 3. DASHBOARD CỦA KHÁCH HÀNG
// =====================================================================
router.get('/customer/stats', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        // Cùng quy tắc nhận diện đơn của khách như getCustomerOrders (username hoặc customer_name)
        const where = `(LOWER(username) = LOWER($1) OR LOWER(customer_name) = LOWER($1))`;

        const totals = await pool.query(
            `SELECT COUNT(*)::int AS total_orders,
                    COUNT(*) FILTER (WHERE UPPER(status) IN ('DELIVERED','DONE'))::int AS delivered_orders,
                    COUNT(*) FILTER (WHERE UPPER(status) = 'CANCELLED')::int AS cancelled_orders,
                    COUNT(*) FILTER (WHERE UPPER(status) NOT IN ('DELIVERED','DONE','CANCELLED','RETURNED'))::int AS active_orders,
                    COALESCE(SUM(COALESCE(total_price, total_cost, 0)) FILTER (WHERE UPPER(status) <> 'CANCELLED'), 0)::float AS total_spent,
                    COALESCE(SUM(COALESCE(total_price, total_cost, 0)) FILTER (WHERE UPPER(payment_status) = 'PAID' AND UPPER(status) <> 'CANCELLED'), 0)::float AS total_paid,
                    COALESCE(SUM(refund_amount) FILTER (WHERE refund_status = 'REFUNDED'), 0)::float AS total_refunded
             FROM orders WHERE ${where}`, [username]);

        const monthly = await pool.query(
            `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                    COUNT(*)::int AS orders,
                    COALESCE(SUM(COALESCE(total_price, total_cost, 0)), 0)::float AS spent
             FROM orders
             WHERE ${where} AND UPPER(status) <> 'CANCELLED'
               AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
             GROUP BY 1 ORDER BY 1`, [username]);

        const byCargo = await pool.query(
            `SELECT COALESCE(cargo_type, 'Other') AS cargo_type, COUNT(*)::int AS orders,
                    COALESCE(SUM(COALESCE(total_price, total_cost, 0)), 0)::float AS spent
             FROM orders WHERE ${where} AND UPPER(status) <> 'CANCELLED'
             GROUP BY 1 ORDER BY spent DESC`, [username]);

        const t = totals.rows[0];
        const finished = t.delivered_orders + t.cancelled_orders;
        res.json({
            ...t,
            success_rate: finished > 0 ? Math.round((t.delivered_orders / finished) * 100) : null,
            monthly: monthly.rows,
            by_cargo: byCargo.rows
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 4. CHỨNG TỪ: VẬN ĐƠN & HÓA ĐƠN (trang HTML in-ready -> nút "Print / Save as PDF")
//    Dùng HTML thay vì PDF thuần để hiển thị đúng tiếng Việt có dấu, không cần thư viện thêm.
// =====================================================================
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const dt = (d) => d ? new Date(d).toLocaleString('vi-VN') : '-';

const docShell = (title, body) => `<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; margin: 0; background: #f0f2f5; }
  .page { max-width: 820px; margin: 20px auto; background: #fff; padding: 36px 40px; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.08); }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2c3e50; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 24px; font-weight: 800; letter-spacing: 1px; }
  .doc-title { font-size: 20px; font-weight: 700; text-align: right; }
  .muted { color: #7f8c8d; font-size: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px; }
  .box { border: 1px solid #dfe6e9; border-radius: 6px; padding: 12px 14px; font-size: 13px; line-height: 1.7; }
  .box h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; color: #7f8c8d; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 10px 0 18px; }
  th, td { border: 1px solid #dfe6e9; padding: 9px 10px; text-align: left; }
  th { background: #f8f9fa; font-size: 12px; text-transform: uppercase; color: #7f8c8d; }
  .right { text-align: right; }
  .total td { font-weight: 800; font-size: 15px; background: #fff8ee; }
  .qr { text-align: center; }
  .qr img { width: 130px; height: 130px; }
  .code { font-family: monospace; font-size: 18px; font-weight: 800; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center; font-size: 12px; margin-top: 30px; }
  .sign div { height: 80px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
  .paid { background: #e8f5e9; color: #2e7d32; } .unpaid { background: #ffebee; color: #c62828; } .pending { background: #fff3cd; color: #856404; }
  .toolbar { text-align: center; margin: 14px; }
  .toolbar button { background: #2980b9; color: #fff; border: 0; padding: 10px 22px; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 14px; }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; max-width: none; } .toolbar { display: none; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ Print / Save as PDF</button></div>
<div class="page">${body}</div></body></html>`;

const getOrderForDoc = async (id) => {
    const r = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return r.rows[0];
};

router.get('/documents/waybill/:id', async (req, res) => {
    try {
        const o = await getOrderForDoc(req.params.id);
        if (!o) return res.status(404).send('Order not found');
        const code = 'PKG-' + (60000 + Number(o.id));
        const qr = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(code);
        res.send(docShell('Waybill ' + code, `
          <div class="head">
            <div><div class="brand">LOGISTICS PRO</div><div class="muted">Electronic waybill</div></div>
            <div class="doc-title">WAYBILL<br><span class="code">${code}</span></div>
          </div>
          <div class="grid">
            <div class="box"><h4>Sender / Customer</h4><b>${esc(o.customer_name)}</b><br>Account: ${esc(o.username || '-')}<br>Created: ${dt(o.created_at)}</div>
            <div class="box"><h4>Receiver</h4><b>${esc(o.receiver_name || '-')}</b><br>Phone: ${esc(o.receiver_phone || '-')}<br>Address: ${esc(o.delivery_address || '-')}</div>
          </div>
          <table>
            <thead><tr><th>Product</th><th>Category</th><th class="right">Packages</th><th>Status</th></tr></thead>
            <tbody><tr><td>${esc(o.product_name)}</td><td>${esc(o.cargo_type || '-')}</td><td class="right">${esc(o.quantity)}</td><td>${esc(o.status)}</td></tr></tbody>
          </table>
          <div class="grid">
            <div class="box"><h4>Transport</h4>Route: ${esc(o.delivery_route || 'Not assigned yet')}<br>Truck: ${esc(o.assigned_truck || 'Not assigned yet')}<br>Pickup schedule: ${dt(o.pickup_date)}<br>Pickup note: ${esc(o.pickup_note || '-')}</div>
            <div class="box qr"><img src="${qr}" alt="QR"><div class="code">${code}</div><div class="muted">Scan at warehouse (WMS)</div></div>
          </div>
          <div class="sign"><div>Sender<br><span class="muted">(sign &amp; full name)</span></div><div>Driver<br><span class="muted">(sign &amp; full name)</span></div><div>Receiver<br><span class="muted">(sign &amp; full name)</span></div></div>
        `));
    } catch (e) { res.status(500).send('Error: ' + esc(e.message)); }
});

router.get('/documents/invoice/:id', async (req, res) => {
    try {
        const o = await getOrderForDoc(req.params.id);
        if (!o) return res.status(404).send('Order not found');
        const code = 'PKG-' + (60000 + Number(o.id));
        const total = o.total_price != null && Number(o.total_price) > 0 ? o.total_price : o.total_cost;
        const qty = Number(o.quantity) || 1;
        const unit = qty > 0 ? Number(total) / qty : 0;
        const ps = String(o.payment_status || '').toUpperCase();
        const payBadge = ps === 'PAID' ? '<span class="badge paid">PAID</span>'
                       : ps === 'PENDING' ? '<span class="badge pending">PENDING APPROVAL</span>'
                       : '<span class="badge unpaid">UNPAID</span>';
        res.send(docShell('Invoice ' + code, `
          <div class="head">
            <div><div class="brand">LOGISTICS PRO</div><div class="muted">Freight service invoice</div></div>
            <div class="doc-title">INVOICE<br><span class="code">INV-${60000 + Number(o.id)}</span></div>
          </div>
          <div class="grid">
            <div class="box"><h4>Billed to</h4><b>${esc(o.customer_name)}</b><br>Account: ${esc(o.username || '-')}<br>Order: #${esc(o.id)} (${code})<br>Date: ${dt(o.created_at)}</div>
            <div class="box"><h4>Payment</h4>Status: ${payBadge}<br>Method: ${esc(o.payment_method || 'Bank transfer (QR)')}<br>Delivery address: ${esc(o.delivery_address || '-')}</div>
          </div>
          <table>
            <thead><tr><th>Description</th><th>Category</th><th class="right">Qty</th><th class="right">Unit price</th><th class="right">Amount</th></tr></thead>
            <tbody>
              <tr><td>Freight - ${esc(o.product_name)}</td><td>${esc(o.cargo_type || '-')}</td><td class="right">${qty}</td><td class="right">${money(unit)}</td><td class="right">${money(total)}</td></tr>
              ${o.refund_status === 'REFUNDED' ? `<tr><td colspan="4" class="right">Refunded</td><td class="right">-${money(o.refund_amount)}</td></tr>` : ''}
              <tr class="total"><td colspan="4" class="right">TOTAL</td><td class="right">${money(o.refund_status === 'REFUNDED' ? Number(total) - Number(o.refund_amount || 0) : total)}</td></tr>
            </tbody>
          </table>
          <p class="muted">Thank you for choosing Logistics Pro. This invoice was generated electronically on ${dt(new Date())}.</p>
        `));
    } catch (e) { res.status(500).send('Error: ' + esc(e.message)); }
});

module.exports = router;
