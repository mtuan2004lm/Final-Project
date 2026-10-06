// ĐỢT 5 - KẾ TOÁN (công nợ, sao kê, hóa đơn VAT, xuất CSV, đối soát) + DOCS (tệp đính kèm, tìm kiếm,
// lịch sử niêm phong, mẫu chứng từ). Mount trong index.js:  app.use('/api/ext', phase5AccDocsRoutes);
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pool = require('../config/db');
const { writeAudit } = require('../audit');
const { getSettings } = require('../settings');

const router = express.Router();

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (Math.round(Number(n || 0) * 100) / 100).toFixed(2);
const amountSql = `COALESCE(NULLIF(total_price, 0), total_cost, 0)`;
const NOT_OPEN = `('NEW','CANCELLED','RETURNED','DONE')`;
const logOrder = (orderId, oldS, newS, notes) =>
    pool.query('INSERT INTO order_logs (order_id, old_status, new_status, notes) VALUES ($1,$2,$3,$4)', [orderId, oldS, newS, notes]);

async function requireAdmin(req, res) {
    const actor = String((req.body && req.body.actor) || req.query.actor || '').trim();
    const r = actor ? await pool.query(`SELECT username FROM users WHERE LOWER(username) = LOWER($1) AND UPPER(role) = 'ADMIN' AND COALESCE(active, TRUE) = TRUE`, [actor]) : { rows: [] };
    if (!r.rows.length) { res.status(403).json({ error: 'Only an active Admin can do this' }); return null; }
    return r.rows[0].username;
}

const PAGE_CSS = `
  body{font-family:'Segoe UI',Arial,sans-serif;max-width:820px;margin:24px auto;padding:0 20px;color:#222}
  h1{font-size:22px;margin:0} h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #2c3e50;padding-bottom:4px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2c3e50;padding-bottom:10px}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:left} th{background:#f2f4f6}
  .right{text-align:right} .tot td{font-weight:bold;background:#fafafa} .sign{display:flex;justify-content:space-between;margin-top:60px;text-align:center}
  .sign div{width:30%} .stamp{color:#c0392b;border:3px solid #c0392b;display:inline-block;padding:2px 12px;transform:rotate(-8deg);font-weight:bold}
  .btn{margin:14px 0;padding:8px 18px;background:#2c3e50;color:#fff;border:none;border-radius:4px;cursor:pointer}
  @media print{.btn{display:none}}`;
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head><body>
  <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>${body}</body></html>`;

// =====================================================================
// KẾ TOÁN 1. CÔNG NỢ KHÁCH HÀNG + NHẮC NỢ
// =====================================================================
router.get('/acc/receivables', async (req, res) => {
    try {
        const cfg = await getSettings();
        const rows = (await pool.query(
            `SELECT id, username, customer_name, ${amountSql}::float AS amount, status, payment_status, created_at,
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::int AS age_days
             FROM orders
             WHERE UPPER(COALESCE(payment_status,'')) <> 'PAID' AND UPPER(COALESCE(status,'')) NOT IN ${NOT_OPEN}
             ORDER BY created_at ASC`)).rows;
        const by = {};
        rows.forEach(o => {
            const key = (o.username || o.customer_name || '(unknown)');
            const g = by[key] = by[key] || { username: o.username, customer_name: o.customer_name, total: 0, overdue_total: 0, oldest_days: 0, orders: [] };
            const overdue = o.age_days > cfg.overdue_days;
            g.total += o.amount; if (overdue) g.overdue_total += o.amount;
            g.oldest_days = Math.max(g.oldest_days, o.age_days);
            g.orders.push({ ...o, overdue });
        });
        const customers = Object.values(by).map(g => ({ ...g, total: Math.round(g.total * 100) / 100, overdue_total: Math.round(g.overdue_total * 100) / 100 }))
            .sort((a, b) => b.overdue_total - a.overdue_total || b.total - a.total);
        res.json({
            overdue_days: cfg.overdue_days, customers,
            total_receivable: Math.round(customers.reduce((s, c) => s + c.total, 0) * 100) / 100,
            total_overdue: Math.round(customers.reduce((s, c) => s + c.overdue_total, 0) * 100) / 100
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/acc/receivables/remind', async (req, res) => {
    const { username, actor } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        const cfg = await getSettings();
        const r = (await pool.query(
            `SELECT id, ${amountSql}::float AS amount FROM orders
             WHERE LOWER(username) = LOWER($1) AND UPPER(COALESCE(payment_status,'')) <> 'PAID' AND UPPER(COALESCE(status,'')) NOT IN ${NOT_OPEN}
               AND created_at < NOW() - make_interval(days => $2::int)`, [username, cfg.overdue_days])).rows;
        if (!r.length) return res.status(400).json({ error: 'This customer has no overdue invoices' });
        const total = r.reduce((s, o) => s + o.amount, 0);
        await pool.query('INSERT INTO notifications (username, order_id, title, message) VALUES ($1,$2,$3,$4)',
            [username, r[0].id, 'Payment reminder', `You have ${r.length} overdue invoice(s) totalling ${money(total)} USD (orders ${r.map(o => '#' + o.id).join(', ')}). Please complete the payment.`]);
        await writeAudit({ actor: actor || 'ACC', action: 'PAYMENT_REMINDER', entity: 'users', detail: `to=${username} orders=${r.length} total=${money(total)}` });
        res.json({ message: `Reminder sent for ${r.length} invoice(s)`, count: r.length, total });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// KẾ TOÁN 2. SAO KÊ THEO THÁNG (JSON + trang in được)
// =====================================================================
async function buildStatement(username, month) {
    const m = /^(\d{4})-(\d{2})$/.exec(month || '');
    if (!username || !m) throw Object.assign(new Error('username and month (YYYY-MM) are required'), { status: 400 });
    const start = `${m[1]}-${m[2]}-01`;
    const orders = (await pool.query(
        `SELECT id, product_name, quantity, status, payment_status, created_at, ${amountSql}::float AS amount,
                COALESCE(refund_amount, 0)::float AS refund_amount, refund_status
         FROM orders
         WHERE LOWER(username) = LOWER($1) AND created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 month')
           AND UPPER(COALESCE(status,'')) <> 'CANCELLED'
         ORDER BY created_at ASC`, [username, start])).rows;
    const billed = orders.reduce((s, o) => s + o.amount, 0);
    const paid = orders.filter(o => String(o.payment_status).toUpperCase() === 'PAID').reduce((s, o) => s + o.amount, 0);
    const refunded = orders.filter(o => o.refund_status === 'REFUNDED').reduce((s, o) => s + o.refund_amount, 0);
    return { username, month, orders, billed: Math.round(billed * 100) / 100, paid: Math.round(paid * 100) / 100,
             refunded: Math.round(refunded * 100) / 100, balance: Math.round((billed - paid) * 100) / 100 };
}

router.get('/acc/statement', async (req, res) => {
    try { res.json(await buildStatement(req.query.username, req.query.month)); }
    catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

router.get('/documents/statement', async (req, res) => {
    try {
        const s = await buildStatement(req.query.username, req.query.month);
        const rows = s.orders.map(o => `<tr><td>#${o.id}</td><td>${esc(new Date(o.created_at).toLocaleDateString('en-GB'))}</td><td>${esc(o.product_name)} × ${o.quantity}</td>
            <td>${esc(o.status)}</td><td>${esc(o.payment_status || 'UNPAID')}</td><td class="right">${money(o.amount)}</td></tr>`).join('');
        res.send(page(`Statement ${s.month}`, `
          <div class="head"><div><h1>ACCOUNT STATEMENT</h1><div>Customer: <b>${esc(s.username)}</b> &nbsp; Period: <b>${esc(s.month)}</b></div></div><div><b>LOGISTICS PRO</b></div></div>
          <h2>Orders</h2><table><tr><th>Order</th><th>Date</th><th>Item</th><th>Status</th><th>Payment</th><th class="right">Amount (USD)</th></tr>
          ${rows || '<tr><td colspan="6">No orders in this period.</td></tr>'}</table>
          <h2>Summary</h2><table>
            <tr><td>Total billed</td><td class="right">${money(s.billed)}</td></tr>
            <tr><td>Paid</td><td class="right">${money(s.paid)}</td></tr>
            <tr><td>Refunded</td><td class="right">${money(s.refunded)}</td></tr>
            <tr class="tot"><td>Balance due</td><td class="right">${money(s.balance)}</td></tr></table>`));
    } catch (e) { res.status(e.status || 500).send(esc(e.message)); }
});

// =====================================================================
// KẾ TOÁN 3. HÓA ĐƠN CHÍNH THỨC (số liên tục + VAT)
// =====================================================================
router.post('/acc/invoices', async (req, res) => {
    const { order_id, issued_by } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Missing order_id' });
    const client = await pool.connect();
    try {
        const o = (await client.query(
            `SELECT id, username, customer_name, status, payment_status, ${amountSql}::float AS amount, COALESCE(insurance_fee,0)::float AS insurance_fee FROM orders WHERE id = $1`, [order_id])).rows[0];
        if (!o) return res.status(404).json({ error: 'Order not found' });
        const st = String(o.status || '').toUpperCase();
        if (['NEW', 'CANCELLED', 'RETURNED'].includes(st)) return res.status(400).json({ error: `Cannot invoice an order with status ${st}` });
        if (String(o.payment_status || '').toUpperCase() !== 'PAID' && !['DELIVERED', 'DONE'].includes(st))
            return res.status(400).json({ error: 'Invoice can be issued after the order is paid or delivered' });

        const cfg = await getSettings();
        const subtotal = Math.round((o.amount + o.insurance_fee) * 100) / 100;
        const vat = Math.round(subtotal * cfg.vat_rate * 100) / 100;
        const total = Math.round((subtotal + vat) * 100) / 100;

        await client.query('BEGIN');
        const ins = await client.query(
            `INSERT INTO invoices (order_id, username, customer_name, subtotal, vat_rate, vat_amount, total, issued_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, issued_at`,
            [o.id, o.username, o.customer_name, subtotal, cfg.vat_rate, vat, total, issued_by || 'ACC']);
        const no = `INV-${new Date(ins.rows[0].issued_at).getFullYear()}-${String(ins.rows[0].id).padStart(6, '0')}`;
        await client.query('UPDATE invoices SET invoice_no = $1 WHERE id = $2', [no, ins.rows[0].id]);
        await client.query('COMMIT');
        await writeAudit({ actor: issued_by || 'ACC', action: 'INVOICE_ISSUED', entity: 'invoices', entityId: ins.rows[0].id, detail: `${no} order=${o.id} total=${total}` });
        res.status(201).json({ id: ins.rows[0].id, invoice_no: no, subtotal, vat_amount: vat, total });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        if (e.code === '23505') return res.status(400).json({ error: 'This order already has an active invoice' });
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

router.get('/acc/invoices', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, invoice_no, order_id, customer_name, subtotal::float AS subtotal, vat_rate::float AS vat_rate, vat_amount::float AS vat_amount,
                    total::float AS total, status, issued_by, issued_at, cancelled_at, cancel_reason
             FROM invoices ORDER BY id DESC LIMIT 300`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/acc/invoices/:id/cancel', async (req, res) => {
    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason for cancelling' });
    try {
        const r = await pool.query(`UPDATE invoices SET status='CANCELLED', cancelled_at=NOW(), cancel_reason=$1 WHERE id=$2 AND status='ISSUED' RETURNING invoice_no`, [reason, req.params.id]);
        if (!r.rows.length) return res.status(400).json({ error: 'Invoice not found or already cancelled' });
        await writeAudit({ actor: req.body.actor || 'ACC', action: 'INVOICE_CANCELLED', entity: 'invoices', entityId: req.params.id, detail: `${r.rows[0].invoice_no}: ${reason}` });
        res.json({ message: 'Invoice cancelled' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/documents/invoice-official/:id', async (req, res) => {
    try {
        const inv = (await pool.query(`SELECT i.*, o.product_name, o.quantity, o.cargo_type, o.delivery_address, ${amountSql.replace(/total_price|total_cost/g, m => 'o.' + m)}::float AS freight,
                COALESCE(o.insurance_fee,0)::float AS insurance_fee FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.id = $1`, [req.params.id])).rows[0];
        if (!inv) return res.status(404).send('Invoice not found');
        res.send(page(inv.invoice_no, `
          <div class="head"><div><h1>VAT INVOICE</h1><div>No: <b>${esc(inv.invoice_no)}</b> &nbsp; Date: ${esc(new Date(inv.issued_at).toLocaleDateString('en-GB'))}</div>
            ${inv.status === 'CANCELLED' ? `<div class="stamp">CANCELLED</div>` : ''}</div><div style="text-align:right"><b>LOGISTICS PRO</b><br/>Freight &amp; warehousing services</div></div>
          <h2>Customer</h2><div>${esc(inv.customer_name)} (${esc(inv.username)})</div>
          <h2>Details (order #${inv.order_id})</h2><table><tr><th>Description</th><th>Qty</th><th class="right">Amount (USD)</th></tr>
            <tr><td>Freight - ${esc(inv.product_name)} (${esc(inv.cargo_type)})</td><td>${inv.quantity}</td><td class="right">${money(inv.freight)}</td></tr>
            ${inv.insurance_fee > 0 ? `<tr><td>Cargo insurance</td><td>1</td><td class="right">${money(inv.insurance_fee)}</td></tr>` : ''}
            <tr><td colspan="2" class="right">Subtotal</td><td class="right">${money(inv.subtotal)}</td></tr>
            <tr><td colspan="2" class="right">VAT (${(Number(inv.vat_rate) * 100).toFixed(1)}%)</td><td class="right">${money(inv.vat_amount)}</td></tr>
            <tr class="tot"><td colspan="2" class="right">TOTAL</td><td class="right">${money(inv.total)}</td></tr></table>
          <div class="sign"><div>Buyer<br/><br/><br/>(sign)</div><div></div><div>Issued by ${esc(inv.issued_by)}<br/><br/><br/>(sign &amp; stamp)</div></div>`));
    } catch (e) { res.status(500).send(esc(e.message)); }
});

// =====================================================================
// KẾ TOÁN 4. XUẤT CSV (mở được bằng Excel)
// =====================================================================
const csvCell = (v) => {
    let s = v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString() : String(v));
    if (/^[=+\-@]/.test(s)) s = "'" + s;               // chống công thức độc hại khi mở bằng Excel
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers, rows) => '﻿' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');

router.get('/acc/export/:kind', async (req, res) => {
    const { from, to } = req.query;
    const range = (col, params) => {
        const w = [];
        if (from) { params.push(from); w.push(`${col} >= $${params.length}::date`); }
        if (to) { params.push(to); w.push(`${col} < ($${params.length}::date + 1)`); }
        return w.length ? 'WHERE ' + w.join(' AND ') : '';
    };
    try {
        const p = []; let headers, rows;
        switch (req.params.kind) {
            case 'orders': {
                headers = ['Order ID', 'Created', 'Customer', 'Product', 'Qty', 'Cargo type', 'Status', 'Payment', 'Total (USD)', 'BOT fee', 'Fuel fee', 'Refund status', 'Refund amount'];
                rows = (await pool.query(`SELECT id, created_at, customer_name, product_name, quantity, cargo_type, status, payment_status, ${amountSql} AS amount, bot_fee, fuel_fee, refund_status, refund_amount FROM orders ${range('created_at', p)} ORDER BY id`, p)).rows.map(Object.values);
                break; }
            case 'refunds': {
                headers = ['Order ID', 'Customer', 'Product', 'Refund amount', 'Refund status', 'Order status', 'Reason'];
                rows = (await pool.query(`SELECT id, customer_name, product_name, refund_amount, refund_status, status, COALESCE(cancel_reason, return_reason) FROM orders ${range('created_at', p)}${p.length ? ' AND' : ' WHERE'} refund_status IN ('PENDING','REFUNDED') ORDER BY id`, p)).rows.map(Object.values);
                break; }
            case 'claims': {
                headers = ['Claim', 'Order', 'Customer', 'Reason', 'Claimed', 'Approved', 'Status', 'Created', 'Resolved', 'Paid'];
                rows = (await pool.query(`SELECT id, order_id, username, reason, claimed_amount, approved_amount, status, created_at, resolved_at, paid_at FROM claims ${range('created_at', p)} ORDER BY id`, p)).rows.map(Object.values);
                break; }
            case 'invoices': {
                headers = ['Invoice no', 'Order', 'Customer', 'Subtotal', 'VAT rate', 'VAT', 'Total', 'Status', 'Issued', 'Issued by'];
                rows = (await pool.query(`SELECT invoice_no, order_id, customer_name, subtotal, vat_rate, vat_amount, total, status, issued_at, issued_by FROM invoices ${range('issued_at', p)} ORDER BY id`, p)).rows.map(Object.values);
                break; }
            case 'fleet-costs': {
                headers = ['Truck', 'Date', 'Type', 'Cost (USD)', 'Detail'];
                const a = [], b = [];
                const m = (await pool.query(`SELECT t.license_plate, l.log_date, l.kind, l.cost, l.note FROM truck_maintenance_logs l JOIN trucks t ON t.id = l.truck_id ${range('l.log_date', a)}`, a)).rows;
                const f = (await pool.query(`SELECT t.license_plate, l.log_date, 'Fuel' AS kind, l.cost, (l.liters || ' L') AS note FROM truck_fuel_logs l JOIN trucks t ON t.id = l.truck_id ${range('l.log_date', b)}`, b)).rows;
                rows = [...m, ...f].map(Object.values).sort((x, y) => String(x[0]).localeCompare(String(y[0])) || new Date(x[1]) - new Date(y[1]));
                break; }
            default: return res.status(404).json({ error: 'Unknown export' });
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.kind}-${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(toCsv(headers, rows));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// KẾ TOÁN 5. ĐỐI SOÁT SAO KÊ NGÂN HÀNG (khớp theo mã đơn trong nội dung + số tiền)
// =====================================================================
const orderIdFromText = (text) => {
    const m = /PKG[-\s]?(\d{1,6})/i.exec(String(text || ''));
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n > 60000 ? n - 60000 : n;
};

router.post('/acc/reconcile', async (req, res) => {
    const rows = req.body.rows;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'No rows provided' });
    if (rows.length > 1000) return res.status(400).json({ error: 'Maximum 1000 rows' });
    try {
        const results = [];
        const seen = new Set();
        for (const [i, r] of rows.entries()) {
            const amount = Number(String(r.amount ?? '').replace(/[^0-9.\-]/g, ''));
            const id = orderIdFromText(r.description);
            const base = { row: i + 1, date: r.date || '', description: String(r.description || '').slice(0, 120), amount };
            if (!id) { results.push({ ...base, status: 'no_code' }); continue; }
            const o = (await pool.query(`SELECT id, customer_name, payment_status, status, ${amountSql}::float AS amount FROM orders WHERE id = $1`, [id])).rows[0];
            if (!o) { results.push({ ...base, order_id: id, status: 'no_order' }); continue; }
            if (String(o.payment_status || '').toUpperCase() === 'PAID') { results.push({ ...base, order_id: id, status: 'already_paid' }); continue; }
            if (seen.has(id)) { results.push({ ...base, order_id: id, status: 'duplicate' }); continue; }
            seen.add(id);
            if (Math.abs(o.amount - amount) > 0.01) { results.push({ ...base, order_id: id, customer_name: o.customer_name, expected: o.amount, status: 'amount_mismatch' }); continue; }
            results.push({ ...base, order_id: id, customer_name: o.customer_name, expected: o.amount, status: 'matched' });
        }
        res.json({ results, matched: results.filter(r => r.status === 'matched').length });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/acc/reconcile/confirm', async (req, res) => {
    const { order_ids, actor } = req.body;
    if (!Array.isArray(order_ids) || !order_ids.length) return res.status(400).json({ error: 'No orders provided' });
    try {
        let done = 0;
        for (const id of order_ids.map(Number).filter(Number.isInteger)) {
            const r = await pool.query(`UPDATE orders SET payment_status = 'PAID' WHERE id = $1 AND UPPER(COALESCE(payment_status,'')) <> 'PAID' RETURNING status`, [id]);
            if (r.rows.length) {
                await logOrder(id, r.rows[0].status, r.rows[0].status, 'Accounting confirmed the payment from the bank statement reconciliation.');
                done++;
            }
        }
        await writeAudit({ actor: actor || 'ACC', action: 'BANK_RECONCILE_CONFIRMED', entity: 'orders', detail: `confirmed=${done} ids=${order_ids.join(',')}`.slice(0, 500) });
        res.json({ message: `${done} order(s) marked as paid`, confirmed: done });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// DOCS 1. TỆP ĐÍNH KÈM HỒ SƠ
// =====================================================================
const DOC_DIR = path.join(__dirname, '..', 'uploads', 'docs');
fs.mkdirSync(DOC_DIR, { recursive: true });
const ALLOWED = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt'];
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, DOC_DIR),
        filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`)
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => ALLOWED.includes(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('File type not allowed (pdf, jpg, png, doc, docx, xls, xlsx, csv, txt)'))
});
const DOC_TYPES = ['Contract', 'Delivery note', 'Customs', 'Invoice', 'Damage report', 'Other'];
const fileUrl = (name) => `/uploads/docs/${name}`;

router.post('/docs/orders/:id/files', (req, res) => {
    upload.single('file')(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is larger than 10 MB' : err.message });
        if (!req.file) return res.status(400).json({ error: 'No file received' });
        const drop = () => fs.unlink(req.file.path, () => {});
        try {
            const o = (await pool.query('SELECT id, current_dept FROM orders WHERE id = $1', [req.params.id])).rows[0];
            if (!o) { drop(); return res.status(404).json({ error: 'Order not found' }); }
            if (String(o.current_dept).toUpperCase() === 'ARCHIVED') { drop(); return res.status(400).json({ error: 'This record is sealed. Ask an Admin to reopen it first.' }); }
            const type = DOC_TYPES.includes(req.body.doc_type) ? req.body.doc_type : 'Other';
            const r = await pool.query(
                `INSERT INTO order_documents (order_id, doc_type, file_name, original_name, mime, size_bytes, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
                [o.id, type, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, req.body.uploaded_by || null]);
            await writeAudit({ actor: req.body.uploaded_by, action: 'DOC_UPLOADED', entity: 'orders', entityId: o.id, detail: `${req.file.originalname} (${type})` });
            res.status(201).json({ id: r.rows[0].id, message: 'File uploaded' });
        } catch (e) { drop(); res.status(500).json({ error: e.message }); }
    });
});

router.get('/docs/orders/:id/files', async (req, res) => {
    try {
        const r = await pool.query(`SELECT id, doc_type, file_name, original_name, mime, size_bytes, uploaded_by, uploaded_at FROM order_documents WHERE order_id = $1 ORDER BY id DESC`, [req.params.id]);
        res.json(r.rows.map(x => ({ ...x, url: fileUrl(x.file_name) })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/docs/files/:id', async (req, res) => {
    try {
        const f = (await pool.query(`SELECT d.id, d.file_name, d.original_name, d.order_id, o.current_dept FROM order_documents d JOIN orders o ON o.id = d.order_id WHERE d.id = $1`, [req.params.id])).rows[0];
        if (!f) return res.status(404).json({ error: 'File not found' });
        if (String(f.current_dept).toUpperCase() === 'ARCHIVED') return res.status(400).json({ error: 'This record is sealed and cannot be changed' });
        await pool.query('DELETE FROM order_documents WHERE id = $1', [f.id]);
        fs.unlink(path.join(DOC_DIR, path.basename(f.file_name)), () => {});
        await writeAudit({ actor: req.body.actor || req.query.actor, action: 'DOC_DELETED', entity: 'orders', entityId: f.order_id, detail: f.original_name });
        res.json({ message: 'File deleted' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// DOCS 2. TÌM KIẾM NÂNG CAO
// =====================================================================
router.get('/docs/search', async (req, res) => {
    const { q, from, to, status, dept, payment, sealed } = req.query;
    const w = [`UPPER(COALESCE(o.status,'')) <> 'NEW'`], p = [];
    if (q) {
        p.push(`%${q}%`); const i = p.length;
        const num = parseInt(String(q).replace(/\D/g, ''), 10);
        let idCond = '';
        if (Number.isInteger(num)) { p.push(num > 60000 ? num - 60000 : num); idCond = ` OR o.id = $${p.length}`; }
        w.push(`(o.customer_name ILIKE $${i} OR o.product_name ILIKE $${i} OR o.delivery_route ILIKE $${i} OR o.assigned_truck ILIKE $${i} OR o.warehouse_location ILIKE $${i}${idCond})`);
    }
    if (from) { p.push(from); w.push(`o.created_at >= $${p.length}::date`); }
    if (to) { p.push(to); w.push(`o.created_at < ($${p.length}::date + 1)`); }
    if (status) { p.push(String(status).toUpperCase()); w.push(`UPPER(o.status) = $${p.length}`); }
    if (dept) { p.push(String(dept).toUpperCase()); w.push(`UPPER(o.current_dept) = $${p.length}`); }
    if (payment) { p.push(String(payment).toUpperCase()); w.push(`UPPER(COALESCE(o.payment_status,'UNPAID')) = $${p.length}`); }
    if (sealed === 'true') w.push(`UPPER(o.current_dept) = 'ARCHIVED'`);
    if (sealed === 'false') w.push(`UPPER(o.current_dept) <> 'ARCHIVED'`);
    try {
        const r = await pool.query(
            `SELECT o.id, o.customer_name, o.product_name, o.quantity, o.status, o.current_dept, o.payment_status, o.created_at,
                    ${amountSql.replace(/total_price|total_cost/g, m => 'o.' + m)}::float AS amount,
                    (SELECT COUNT(*)::int FROM order_documents d WHERE d.order_id = o.id) AS files
             FROM orders o WHERE ${w.join(' AND ')} ORDER BY o.id DESC LIMIT 200`, p);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// DOCS 3. LỊCH SỬ NIÊM PHONG + MỞ LẠI (chỉ Admin)
// =====================================================================
router.get('/docs/orders/:id/archive-history', async (req, res) => {
    try {
        const r = await pool.query('SELECT id, action, actor, reason, created_at FROM archive_events WHERE order_id = $1 ORDER BY id DESC', [req.params.id]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/archive/:id/reopen', async (req, res) => {
    try {
        const actor = await requireAdmin(req, res); if (!actor) return;
        const reason = String(req.body.reason || '').trim();
        if (reason.length < 5) return res.status(400).json({ error: 'Please give a reason (at least 5 characters)' });
        const r = await pool.query(`UPDATE orders SET current_dept = 'DOCS' WHERE id = $1 AND UPPER(current_dept) = 'ARCHIVED' RETURNING id`, [req.params.id]);
        if (!r.rows.length) return res.status(400).json({ error: 'This record is not sealed' });
        await pool.query(`INSERT INTO archive_events (order_id, action, actor, reason) VALUES ($1,'REOPENED',$2,$3)`, [req.params.id, actor, reason]);
        await logOrder(req.params.id, 'DONE', 'DONE', `Admin ${actor} reopened the sealed record: ${reason}`);
        await writeAudit({ actor, action: 'ARCHIVE_REOPENED', entity: 'orders', entityId: req.params.id, detail: reason });
        res.json({ message: 'Record reopened' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// DOCS 4. MẪU CHỨNG TỪ CÓ SỐ HIỆU TỰ ĐỘNG
// =====================================================================
const docNo = (prefix, o) => `${prefix}-${new Date(o.created_at || Date.now()).getFullYear()}-${String(o.id).padStart(6, '0')}`;
const loadOrder = async (id) => (await pool.query(
    `SELECT o.*, t.driver_name FROM orders o LEFT JOIN trucks t ON t.license_plate = o.assigned_truck WHERE o.id = $1`, [id])).rows[0];

router.get('/documents/handover/:id', async (req, res) => {
    try {
        const o = await loadOrder(req.params.id);
        if (!o) return res.status(404).send('Order not found');
        res.send(page('Handover record', `
          <div class="head"><div><h1>GOODS HANDOVER RECORD</h1><div>No: <b>${docNo('BBBG', o)}</b></div></div><div><b>LOGISTICS PRO</b></div></div>
          <h2>Order</h2><table><tr><th>Package code</th><td>PKG-${60000 + o.id}</td><th>Order</th><td>#${o.id}</td></tr>
            <tr><th>Item</th><td>${esc(o.product_name)}</td><th>Quantity</th><td>${o.quantity}</td></tr>
            <tr><th>Cargo type</th><td>${esc(o.cargo_type)}</td><th>Customer</th><td>${esc(o.customer_name)}</td></tr></table>
          <h2>Delivery</h2><table><tr><th>Route</th><td>${esc(o.delivery_route || '-')}</td><th>Vehicle</th><td>${esc(o.assigned_truck || '-')}</td></tr>
            <tr><th>Driver</th><td>${esc(o.driver_name || '-')}</td><th>Delivery address</th><td>${esc(o.delivery_address || '-')}</td></tr>
            <tr><th>Receiver</th><td>${esc(o.receiver_name || '-')}</td><th>Phone</th><td>${esc(o.receiver_phone || '-')}</td></tr></table>
          <p>The receiver confirms the goods above were handed over in good condition, unless stated otherwise in the damage report.</p>
          <div class="sign"><div>Delivered by<br/>(driver)<br/><br/><br/></div><div>Received by<br/>(receiver)<br/><br/><br/></div><div>Confirmed by<br/>(Docs department)<br/><br/><br/></div></div>`));
    } catch (e) { res.status(500).send(esc(e.message)); }
});

router.get('/documents/damage/:id', async (req, res) => {
    try {
        const o = await loadOrder(req.params.id);
        if (!o) return res.status(404).send('Order not found');
        res.send(page('Damage report', `
          <div class="head"><div><h1>DAMAGE / CONDITION REPORT</h1><div>No: <b>${docNo('BBHH', o)}</b></div></div><div><b>LOGISTICS PRO</b></div></div>
          <h2>Order</h2><table><tr><th>Package code</th><td>PKG-${60000 + o.id}</td><th>Order</th><td>#${o.id}</td></tr>
            <tr><th>Item</th><td>${esc(o.product_name)}</td><th>Quantity</th><td>${o.quantity}</td></tr>
            <tr><th>Customer</th><td>${esc(o.customer_name)}</td><th>Warehouse location</th><td>${esc(o.warehouse_location || '-')}</td></tr></table>
          <h2>Condition recorded</h2><table><tr><th>Cargo condition</th><td>${esc(o.cargo_condition || 'Normal')}</td></tr>
            <tr><th>Notes</th><td>${esc(o.notes || o.driver_notes || '-')}</td></tr></table>
          <h2>Findings</h2><div style="border:1px solid #ccc;min-height:90px;padding:8px"></div>
          <div class="sign"><div>Prepared by<br/>(warehouse)<br/><br/><br/></div><div>Witness<br/>(driver / customer)<br/><br/><br/></div><div>Approved by<br/>(Docs department)<br/><br/><br/></div></div>`));
    } catch (e) { res.status(500).send(esc(e.message)); }
});

module.exports = router;
