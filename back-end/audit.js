// Audit log: ghi lại MỌI thao tác thay đổi dữ liệu (POST/PUT/PATCH/DELETE) mà không phải sửa từng controller.
// Không ghi mật khẩu, OTP, ảnh/chữ ký (bị che hoặc cắt ngắn).
const pool = require('./config/db');

const SECRET_KEYS = /pass|otp|token|signature|image|photo|secret/i;

function sanitize(v, depth = 0) {
    if (v === null || typeof v !== 'object') return typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v;
    if (depth > 2) return '…';
    if (Array.isArray(v)) return v.length > 5 ? [...v.slice(0, 5).map(x => sanitize(x, depth + 1)), `…(+${v.length - 5})`] : v.map(x => sanitize(x, depth + 1));
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = SECRET_KEYS.test(k) ? '***' : sanitize(val, depth + 1);
    return out;
}

async function writeAudit({ actor, action, entity, entityId, statusCode, detail, ip }) {
    try {
        await pool.query(
            `INSERT INTO audit_logs (actor, action, entity, entity_id, status_code, detail, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [actor || null, action, entity || null, entityId ? String(entityId) : null, statusCode || null, detail ? String(detail).slice(0, 1000) : null, ip || null]);
    } catch (e) { console.error('audit log error:', e.message); }    // không bao giờ làm hỏng request chính
}

function middleware(req, res, next) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    // Login mobile trả HTTP 200 kèm success:false -> bắt kết quả để ghi đúng LOGIN / LOGIN_FAILED
    const origJson = res.json.bind(res);
    res.json = (payload) => { if (payload && payload.success === false) res.locals.loginFailed = true; return origJson(payload); };
    res.on('finish', () => {
        const url = (req.originalUrl || '').split('?')[0];
        if (!url.startsWith('/api/')) return;
        // Các endpoint đợt 4 đã tự ghi log với tên hành động riêng -> bỏ qua để khỏi trùng
        if (/\/api\/ext\/(claims|oms\/claims|acc\/claims|auth\/|orders\/\d+\/insurance|admin\/(users|pricing|archive)|acc\/(invoices|reconcile|receivables)|docs\/(orders\/\d+\/files|files))/.test(url)) return;
        const body = req.body || {};
        // Đoán người thực hiện từ body/query; nếu không có thì để trống
        const actor = body.username || body.changed_by || body.actor || req.query.username || null;
        const m = url.match(/\/(orders|claims|fleet\/trucks|fleet\/drivers|addresses)\/(\d+)/);
        const isLogin = /\/auth\/(login|mobile-login)$/.test(url);
        let action = `${req.method} ${url.replace(/\/\d+/g, '/:id')}`;
        if (isLogin) action = (res.statusCode >= 400 || res.locals.loginFailed) ? 'LOGIN_FAILED' : 'LOGIN';
        writeAudit({
            actor, action,
            entity: m ? m[1] : null, entityId: m ? m[2] : null,
            statusCode: res.statusCode,
            detail: JSON.stringify(sanitize(body)),
            ip: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().replace('::ffff:', '')
        });
    });
    next();
}

module.exports = { middleware, writeAudit };
