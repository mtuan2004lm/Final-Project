// ĐỢT 5 - ADMIN: quản lý người dùng, bảng giá cấu hình, cảnh báo, báo cáo hiệu suất.
// Mount trong index.js:  app.use('/api/ext', phase5AdminRoutes);
const express = require('express');
const pool = require('../config/db');
const { writeAudit } = require('../audit');
const { getSettings, getRates } = require('../settings');

const router = express.Router();
const ROLES = ['CUSTOMER', 'OMS', 'WMS', 'TMS', 'ACC', 'DOCS', 'ADMIN'];

// Kiểm tra người thực hiện (actor = username đang đăng nhập) có phải ADMIN đang hoạt động không.
async function requireAdmin(req, res) {
    const actor = String((req.body && req.body.actor) || req.query.actor || '').trim();
    if (!actor) { res.status(403).json({ error: 'Admin account required' }); return null; }
    const r = await pool.query(`SELECT username FROM users WHERE LOWER(username) = LOWER($1) AND UPPER(role) = 'ADMIN' AND COALESCE(active, TRUE) = TRUE`, [actor]);
    if (!r.rows.length) { res.status(403).json({ error: 'Only an active Admin can do this' }); return null; }
    return r.rows[0].username;
}

// =====================================================================
// 1. QUẢN LÝ NGƯỜI DÙNG
// =====================================================================
router.get('/admin/users', async (req, res) => {
    try {
        let r;
        try {
            r = await pool.query(
                `SELECT id, username, full_name, UPPER(role) AS role, COALESCE(active, TRUE) AS active, created_at
                 FROM users ORDER BY id ASC`);
        } catch (e) {
            if (e.code !== '42703') throw e;      // thiếu cột -> chưa chạy phase5_migration.sql
            return res.status(500).json({ error: 'Database is missing the new columns. Please run phase5_migration.sql, then restart the backend.' });
        }
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/users', async (req, res) => {
    try {
        const actor = await requireAdmin(req, res); if (!actor) return;
        const username = String(req.body.username || '').trim();
        const fullName = String(req.body.full_name || '').trim();
        const role = String(req.body.role || '').toUpperCase();
        const password = String(req.body.password || '');
        if (!username || !fullName) return res.status(400).json({ error: 'Username and full name are required' });
        if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username)) return res.status(400).json({ error: 'Username: 3-40 letters, digits, . _ -' });
        if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const dup = await pool.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (dup.rows.length) return res.status(400).json({ error: 'This username already exists' });
        // Dự án đang lưu mật khẩu dạng thường trong cột password_hash (giống đăng nhập hiện tại).
        const r = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name, role`,
            [username, password, fullName, role]);
        await writeAudit({ actor, action: 'USER_CREATED', entity: 'users', entityId: r.rows[0].id, detail: `username=${username} role=${role}` });
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admin/users/:id', async (req, res) => {
    try {
        const actor = await requireAdmin(req, res); if (!actor) return;
        const u = (await pool.query('SELECT id, username, UPPER(role) AS role, COALESCE(active, TRUE) AS active FROM users WHERE id = $1', [req.params.id])).rows[0];
        if (!u) return res.status(404).json({ error: 'User not found' });

        const newRole = req.body.role !== undefined ? String(req.body.role).toUpperCase() : u.role;
        const newActive = req.body.active !== undefined ? !!req.body.active : u.active;
        const fullName = req.body.full_name !== undefined ? String(req.body.full_name).trim() : null;
        if (!ROLES.includes(newRole)) return res.status(400).json({ error: 'Invalid role' });
        if (fullName !== null && !fullName) return res.status(400).json({ error: 'Full name cannot be empty' });

        const isSelf = u.username.toLowerCase() === actor.toLowerCase();
        if (isSelf && (newRole !== u.role || newActive === false)) return res.status(400).json({ error: 'You cannot change your own role or disable your own account' });
        // luôn còn ít nhất 1 Admin đang hoạt động
        if (u.role === 'ADMIN' && (newRole !== 'ADMIN' || newActive === false)) {
            const others = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE UPPER(role) = 'ADMIN' AND COALESCE(active, TRUE) = TRUE AND id <> $1`, [u.id]);
            if (others.rows[0].c < 1) return res.status(400).json({ error: 'At least one active Admin must remain' });
        }
        await pool.query(`UPDATE users SET role = $1, active = $2, full_name = COALESCE($3, full_name) WHERE id = $4`, [newRole, newActive, fullName, u.id]);
        await writeAudit({ actor, action: 'USER_UPDATED', entity: 'users', entityId: u.id, detail: `role=${newRole} active=${newActive}` });
        res.json({ message: 'User updated' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/admin/users/:id/reset-password', async (req, res) => {
    try {
        const actor = await requireAdmin(req, res); if (!actor) return;
        const pw = String(req.body.new_password || '');
        if (pw.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const r = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING username', [pw, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
        await writeAudit({ actor, action: 'USER_PASSWORD_RESET', entity: 'users', entityId: req.params.id, detail: `username=${r.rows[0].username}` });
        res.json({ message: 'Password reset' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 2. BẢNG GIÁ + CÀI ĐẶT (GET công khai: khách hàng cần để tính cước)
// =====================================================================
router.get('/pricing', async (req, res) => {
    try {
        const [rates, cfg] = await Promise.all([getRates(), getSettings()]);
        res.json({ rates, insurance_rate: cfg.insurance_rate, insurance_min_fee: cfg.insurance_min_fee, vat_rate: cfg.vat_rate, overdue_days: cfg.overdue_days });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/admin/pricing', async (req, res) => {
    const client = await pool.connect();
    try {
        const actor = await requireAdmin(req, res); if (!actor) return;
        const { rates, insurance_rate, insurance_min_fee, vat_rate, overdue_days } = req.body;
        const known = await getRates();
        const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };

        await client.query('BEGIN');
        for (const [type, price] of Object.entries(rates || {})) {
            if (!(type in known)) throw new Error(`Unknown cargo type: ${type}`);
            const p = num(price, 0.01, 100000);
            if (p === null) throw new Error(`Invalid price for ${type}`);
            await client.query(`UPDATE price_rates SET unit_price = $1, updated_at = NOW() WHERE cargo_type = $2`, [p, type]);
        }
        const setIf = async (key, v, min, max, label) => {
            if (v === undefined || v === null || v === '') return;
            const n = num(v, min, max);
            if (n === null) throw new Error(`Invalid value for ${label}`);
            await client.query(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, String(n)]);
        };
        await setIf('insurance_rate', insurance_rate, 0, 0.5, 'insurance rate');
        await setIf('insurance_min_fee', insurance_min_fee, 0, 1000, 'minimum insurance fee');
        await setIf('vat_rate', vat_rate, 0, 0.5, 'VAT rate');
        await setIf('overdue_days', overdue_days, 1, 365, 'overdue days');
        await client.query('COMMIT');
        await writeAudit({ actor, action: 'PRICING_UPDATED', entity: 'settings', detail: JSON.stringify({ rates, insurance_rate, insurance_min_fee, vat_rate, overdue_days }) });
        res.json({ message: 'Pricing saved' });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        res.status(e.message.startsWith('Invalid') || e.message.startsWith('Unknown') ? 400 : 500).json({ error: e.message });
    } finally { client.release(); }
});

// =====================================================================
// 3. CẢNH BÁO TỔNG HỢP
// =====================================================================
router.get('/admin/alerts', async (req, res) => {
    try {
        const cfg = await getSettings();
        const stuck = (await pool.query(
            `SELECT o.id, o.customer_name, o.status, o.current_dept,
                    COALESCE(MAX(l.changed_at), o.created_at) AS since,
                    ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(l.changed_at), o.created_at))) / 3600)::int AS hours
             FROM orders o LEFT JOIN order_logs l ON l.order_id = o.id
             WHERE UPPER(o.status) IN ('NEW','APPROVED','PACKED','SHIPPING')
             GROUP BY o.id
             HAVING COALESCE(MAX(l.changed_at), o.created_at) < NOW() - make_interval(hours => $1::int)
             ORDER BY since ASC LIMIT 50`, [cfg.stuck_hours])).rows;

        const oldClaims = (await pool.query(
            `SELECT id, order_id, username, claimed_amount::float AS claimed_amount, created_at,
                    ROUND(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600)::int AS hours
             FROM claims WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '48 hours' ORDER BY created_at ASC`)).rows;

        const failedLogins = (await pool.query(
            `SELECT COALESCE(actor, '(unknown)') AS actor, COUNT(*)::int AS attempts, MAX(created_at) AS last_at
             FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at > NOW() - INTERVAL '24 hours'
             GROUP BY actor HAVING COUNT(*) >= 3 ORDER BY attempts DESC`)).rows;

        const unpaidOverdue = (await pool.query(
            `SELECT COUNT(*)::int AS c FROM orders
             WHERE UPPER(COALESCE(payment_status,'')) <> 'PAID' AND UPPER(status) NOT IN ('CANCELLED','RETURNED')
               AND created_at < NOW() - make_interval(days => $1::int)`, [cfg.overdue_days])).rows[0].c;

        res.json({ stuck_hours: cfg.stuck_hours, stuck, oldClaims, failedLogins, unpaidOverdue });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 4. BÁO CÁO HIỆU SUẤT
// =====================================================================
router.get('/admin/performance', async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    try {
        // Thời gian trung bình đơn nằm ở mỗi trạng thái (giờ), tính từ nhật ký order_logs
        const perStatus = (await pool.query(
            `SELECT UPPER(new_status) AS status, ROUND(AVG(EXTRACT(EPOCH FROM (next_at - changed_at)) / 3600)::numeric, 1)::float AS avg_hours, COUNT(*)::int AS samples
             FROM (SELECT new_status, changed_at, LEAD(changed_at) OVER (PARTITION BY order_id ORDER BY changed_at, id) AS next_at
                   FROM order_logs WHERE changed_at > NOW() - make_interval(days => $1::int)) t
             WHERE next_at IS NOT NULL AND UPPER(new_status) IN ('NEW','APPROVED','PACKED','SHIPPING')
             GROUP BY UPPER(new_status)`, [days])).rows;

        const totals = (await pool.query(
            `SELECT COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE UPPER(status) IN ('DELIVERED','DONE'))::int AS delivered,
                    COUNT(*) FILTER (WHERE UPPER(status) = 'CANCELLED')::int AS cancelled,
                    COUNT(*) FILTER (WHERE UPPER(status) = 'RETURNED' OR UPPER(COALESCE(return_status,'')) = 'APPROVED')::int AS returned
             FROM orders WHERE created_at > NOW() - make_interval(days => $1::int)`, [days])).rows[0];
        const closed = totals.delivered + totals.cancelled + totals.returned;
        const pct = (n) => closed ? Math.round((n / closed) * 1000) / 10 : null;

        // Xếp hạng tài xế (theo xe được gán)
        const drivers = (await pool.query(
            `SELECT COALESCE(NULLIF(t.driver_name, ''), o.assigned_truck) AS driver, o.assigned_truck AS truck,
                    COUNT(*)::int AS delivered,
                    ROUND(AVG(NULLIF(o.rating, 0))::numeric, 2)::float AS avg_rating,
                    ROUND(SUM(COALESCE(o.bot_fee,0) + COALESCE(o.fuel_fee,0))::numeric, 2)::float AS road_cost
             FROM orders o LEFT JOIN trucks t ON t.license_plate = o.assigned_truck
             WHERE UPPER(o.status) IN ('DELIVERED','DONE') AND o.assigned_truck IS NOT NULL AND o.assigned_truck <> ''
               AND o.created_at > NOW() - make_interval(days => $1::int)
             GROUP BY 1, 2 ORDER BY delivered DESC, avg_rating DESC NULLS LAST LIMIT 20`, [days])).rows;

        res.json({
            days, total_orders: totals.total,
            delivered_rate: pct(totals.delivered), cancelled_rate: pct(totals.cancelled), returned_rate: pct(totals.returned),
            per_status: perStatus, drivers
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
