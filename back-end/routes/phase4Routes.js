// ĐỢT 4 - bảo hiểm + bồi thường, OTP quên mật khẩu, audit log.
// Mount trong index.js:  app.use('/api/ext', phase4Routes);
const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { writeAudit } = require('../audit');

const router = express.Router();

const INSURANCE_RATE = 0.015;      // 1.5% giá trị khai báo
const INSURANCE_MIN_FEE = 1;       // phí tối thiểu
const MAX_DECLARED = 100000;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const money = (n) => Math.round(Number(n) * 100) / 100;
const feeFor = (value) => money(Math.max(INSURANCE_MIN_FEE, value * INSURANCE_RATE));
const TERMINAL = ['CANCELLED', 'RETURNED'];

async function notify(username, orderId, title, message) {
    try { await pool.query('INSERT INTO notifications (username, order_id, title, message) VALUES ($1,$2,$3,$4)', [username, orderId, title, message]); }
    catch (e) { console.error('notify error:', e.message); }
}

// =====================================================================
// 1. BẢO HIỂM HÀNG HÓA
// =====================================================================
router.get('/insurance/quote', (req, res) => {
    const v = Number(req.query.value);
    if (!(v > 0)) return res.status(400).json({ error: 'value must be greater than 0' });
    res.json({ declared_value: v, fee: feeFor(v), rate: INSURANCE_RATE, min_fee: INSURANCE_MIN_FEE });
});

router.post('/orders/:id/insurance', async (req, res) => {
    const { username } = req.body;
    const value = Number(req.body.declared_value);
    if (!username) return res.status(400).json({ error: 'Missing username' });
    if (!(value > 0) || value > MAX_DECLARED) return res.status(400).json({ error: `Declared value must be between 0 and ${MAX_DECLARED}` });
    try {
        const o = (await pool.query('SELECT id, username, status, insured FROM orders WHERE id = $1', [req.params.id])).rows[0];
        if (!o) return res.status(404).json({ error: 'Order not found' });
        if (String(o.username || '').toLowerCase() !== String(username).toLowerCase()) return res.status(403).json({ error: 'This is not your order' });
        if (o.insured) return res.status(400).json({ error: 'This order is already insured' });
        const st = String(o.status || '').toUpperCase();
        if (['DELIVERED', 'DONE', ...TERMINAL].includes(st)) return res.status(400).json({ error: 'Insurance can only be bought before delivery' });
        const fee = feeFor(value);
        await pool.query('UPDATE orders SET insured = TRUE, insured_value = $1, insurance_fee = $2 WHERE id = $3', [value, fee, o.id]);
        await writeAudit({ actor: username, action: 'INSURANCE_BOUGHT', entity: 'orders', entityId: o.id, detail: `value=${value} fee=${fee}` });
        res.json({ message: 'Insurance added', insured_value: value, insurance_fee: fee });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 2. BỒI THƯỜNG
// =====================================================================
const REASONS = ['Damaged', 'Lost', 'Delayed', 'Other'];

router.post('/claims', async (req, res) => {
    const { username, order_id, reason, description } = req.body;
    const amount = Number(req.body.claimed_amount);
    if (!username || !order_id) return res.status(400).json({ error: 'Missing username or order_id' });
    if (!REASONS.includes(reason)) return res.status(400).json({ error: 'Invalid reason' });
    if (!(amount > 0)) return res.status(400).json({ error: 'Claimed amount must be greater than 0' });
    if (!description || String(description).trim().length < 5) return res.status(400).json({ error: 'Please describe the problem (at least 5 characters)' });
    try {
        const o = (await pool.query('SELECT id, username, status, insured, insured_value FROM orders WHERE id = $1', [order_id])).rows[0];
        if (!o) return res.status(404).json({ error: 'Order not found' });
        if (String(o.username || '').toLowerCase() !== String(username).toLowerCase()) return res.status(403).json({ error: 'This is not your order' });
        if (!o.insured) return res.status(400).json({ error: 'Only insured orders can be claimed' });
        if (amount > Number(o.insured_value)) return res.status(400).json({ error: `Claim cannot exceed the insured value (${o.insured_value})` });
        const st = String(o.status || '').toUpperCase();
        if (['PENDING', 'CANCELLED'].includes(st)) return res.status(400).json({ error: 'This order has not been shipped yet' });
        const open = await pool.query(`SELECT 1 FROM claims WHERE order_id = $1 AND status IN ('PENDING','APPROVED')`, [order_id]);
        if (open.rows.length) return res.status(400).json({ error: 'This order already has an open claim' });
        const r = await pool.query(
            `INSERT INTO claims (order_id, username, reason, description, claimed_amount) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [order_id, username, reason, String(description).trim(), amount]);
        await writeAudit({ actor: username, action: 'CLAIM_CREATED', entity: 'claims', entityId: r.rows[0].id, detail: `order=${order_id} reason=${reason} amount=${amount}` });
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/claims', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    try {
        const r = await pool.query(
            `SELECT id, order_id, reason, description, claimed_amount::float AS claimed_amount, status, approved_amount::float AS approved_amount,
                    resolver_note, created_at, resolved_at, paid_at
             FROM claims WHERE LOWER(username) = LOWER($1) ORDER BY id DESC`, [username]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// OMS xem toàn bộ yêu cầu
router.get('/oms/claims', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT c.id, c.order_id, c.username, c.reason, c.description, c.claimed_amount::float AS claimed_amount, c.status,
                    c.approved_amount::float AS approved_amount, c.resolver_note, c.resolved_by, c.created_at, c.resolved_at, c.paid_at,
                    o.product_name, o.insured_value::float AS insured_value
             FROM claims c LEFT JOIN orders o ON o.id = c.order_id
             ORDER BY (c.status = 'PENDING') DESC, c.id DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// OMS duyệt / từ chối
router.put('/oms/claims/:id', async (req, res) => {
    const { decision, note, resolved_by } = req.body;
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision must be approve or reject' });
    if (decision === 'reject' && !String(note || '').trim()) return res.status(400).json({ error: 'Please give a reason for rejecting' });
    try {
        const c = (await pool.query('SELECT * FROM claims WHERE id = $1', [req.params.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Claim not found' });
        if (c.status !== 'PENDING') return res.status(400).json({ error: `Claim is already ${c.status}` });
        let approved = null;
        if (decision === 'approve') {
            approved = req.body.approved_amount === undefined || req.body.approved_amount === '' ? Number(c.claimed_amount) : Number(req.body.approved_amount);
            if (!(approved > 0) || approved > Number(c.claimed_amount)) return res.status(400).json({ error: 'Approved amount must be between 0 and the claimed amount' });
        }
        const status = decision === 'approve' ? 'APPROVED' : 'REJECTED';
        await pool.query(`UPDATE claims SET status=$1, approved_amount=$2, resolver_note=$3, resolved_by=$4, resolved_at=NOW() WHERE id=$5`,
            [status, approved, note || null, resolved_by || 'OMS', c.id]);
        await notify(c.username, c.order_id, decision === 'approve' ? 'Claim approved' : 'Claim rejected',
            decision === 'approve'
                ? `Your claim #${c.id} for order #${c.order_id} was approved for ${approved}. Accounting will pay it soon.`
                : `Your claim #${c.id} for order #${c.order_id} was rejected. Reason: ${note}`);
        await writeAudit({ actor: resolved_by || 'OMS', action: 'CLAIM_' + status, entity: 'claims', entityId: c.id, detail: `approved=${approved} note=${note || ''}` });
        res.json({ message: `Claim ${status}` });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ACC: danh sách đã duyệt cần chi trả + đánh dấu đã trả
router.get('/acc/claims', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, order_id, username, reason, approved_amount::float AS approved_amount, status, resolved_at, paid_at
             FROM claims WHERE status IN ('APPROVED','PAID') ORDER BY (status='APPROVED') DESC, id DESC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/acc/claims/:id/pay', async (req, res) => {
    try {
        const c = (await pool.query('SELECT * FROM claims WHERE id = $1', [req.params.id])).rows[0];
        if (!c) return res.status(404).json({ error: 'Claim not found' });
        if (c.status !== 'APPROVED') return res.status(400).json({ error: 'Only approved claims can be paid' });
        await pool.query(`UPDATE claims SET status='PAID', paid_at=NOW() WHERE id=$1`, [c.id]);
        await notify(c.username, c.order_id, 'Claim paid', `We have paid ${c.approved_amount} for your claim #${c.id}.`);
        await writeAudit({ actor: req.body.username || 'ACC', action: 'CLAIM_PAID', entity: 'claims', entityId: c.id, detail: `amount=${c.approved_amount}` });
        res.json({ message: 'Claim marked as paid' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 3. QUÊN MẬT KHẨU BẰNG OTP:  forgot -> verify-otp -> reset
//    Chưa có dịch vụ email/SMS: OTP được in ra CONSOLE của backend.
//    Khi chạy thử (mặc định) OTP còn được trả về trong response (dev_otp).
//    Khi triển khai thật: đặt OTP_DEV=false và nối nhà cung cấp email/SMS tại hàm sendOtp().
// =====================================================================
const OTP_DEV = process.env.OTP_DEV !== 'false';
async function sendOtp(username, otp) {
    console.log(`🔐 [OTP] ${username}: ${otp} (hết hạn sau 10 phút)`);
}

router.post('/auth/forgot', async (req, res) => {
    const username = String(req.body.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Please enter your username' });
    const generic = { message: 'If this account exists, a verification code has been sent.' };
    try {
        const u = (await pool.query('SELECT username FROM users WHERE LOWER(username) = LOWER($1)', [username])).rows[0];
        if (!u) return res.json(generic);                    // không tiết lộ tài khoản có tồn tại hay không
        const recent = (await pool.query(
            `SELECT COUNT(*)::int AS c FROM password_resets WHERE LOWER(username)=LOWER($1) AND created_at > NOW() - INTERVAL '10 minutes'`, [u.username])).rows[0].c;
        if (recent >= 3) return res.status(429).json({ error: 'Too many requests. Please wait 10 minutes and try again.' });
        const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await pool.query(`INSERT INTO password_resets (username, otp_hash, expires_at) VALUES ($1,$2, NOW() + INTERVAL '10 minutes')`, [u.username, sha(u.username.toLowerCase() + ':' + otp)]);
        await sendOtp(u.username, otp);
        await writeAudit({ actor: u.username, action: 'PASSWORD_RESET_REQUESTED', entity: 'users' });
        res.json(OTP_DEV ? { ...generic, dev_otp: otp } : generic);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/verify-otp', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const otp = String(req.body.otp || '').trim();
    if (!username || !/^\d{6}$/.test(otp)) return res.status(400).json({ error: 'Enter the 6-digit code' });
    try {
        const row = (await pool.query(
            `SELECT * FROM password_resets WHERE LOWER(username)=LOWER($1) AND used = FALSE AND expires_at > NOW() ORDER BY id DESC LIMIT 1`, [username])).rows[0];
        if (!row) return res.status(400).json({ error: 'Code expired or not requested. Please request a new code.' });
        if (row.attempts >= 5) return res.status(429).json({ error: 'Too many wrong attempts. Please request a new code.' });
        if (row.otp_hash !== sha(row.username.toLowerCase() + ':' + otp)) {
            await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE id = $1', [row.id]);
            await writeAudit({ actor: row.username, action: 'OTP_FAILED', entity: 'users' });
            return res.status(400).json({ error: 'Wrong code' });
        }
        const token = crypto.randomBytes(24).toString('hex');
        await pool.query(`UPDATE password_resets SET reset_token_hash=$1, token_expires_at = NOW() + INTERVAL '15 minutes' WHERE id=$2`, [sha(token), row.id]);
        res.json({ reset_token: token });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/auth/reset', async (req, res) => {
    const username = String(req.body.username || '').trim();
    const { reset_token, new_password } = req.body;
    if (!username || !reset_token) return res.status(400).json({ error: 'Missing data' });
    if (!new_password || String(new_password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    try {
        const row = (await pool.query(
            `SELECT * FROM password_resets WHERE LOWER(username)=LOWER($1) AND used = FALSE AND reset_token_hash = $2 AND token_expires_at > NOW()
             ORDER BY id DESC LIMIT 1`, [username, sha(reset_token)])).rows[0];
        if (!row) return res.status(400).json({ error: 'Reset session expired. Please start again.' });
        // Dự án đang lưu mật khẩu dạng thường trong cột password_hash (giống đăng nhập hiện tại) nên giữ nguyên quy ước này.
        await pool.query('UPDATE users SET password_hash = $1 WHERE LOWER(username) = LOWER($2)', [String(new_password), row.username]);
        await pool.query('UPDATE password_resets SET used = TRUE WHERE LOWER(username) = LOWER($1)', [row.username]);
        await writeAudit({ actor: row.username, action: 'PASSWORD_RESET_DONE', entity: 'users' });
        res.json({ message: 'Password changed. You can now sign in.' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 4. AUDIT LOG (cho ADMIN xem)
// =====================================================================
router.get('/admin/audit', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const { actor, q, from, to } = req.query;
    const where = [], params = [];
    if (actor) { params.push(`%${actor}%`); where.push(`actor ILIKE $${params.length}`); }
    if (q) { params.push(`%${q}%`); where.push(`(action ILIKE $${params.length} OR detail ILIKE $${params.length} OR entity_id = $${params.length + 1})`); params.push(String(q)); }
    if (from) { params.push(from); where.push(`created_at >= $${params.length}::date`); }
    if (to) { params.push(to); where.push(`created_at < ($${params.length}::date + 1)`); }
    try {
        const r = await pool.query(
            `SELECT id, actor, action, entity, entity_id, status_code, detail, ip, created_at
             FROM audit_logs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${limit}`, params);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
