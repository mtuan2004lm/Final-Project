// Đọc cài đặt chung + bảng giá từ database (Admin chỉnh được). Nếu bảng chưa tạo thì dùng giá trị mặc định.
const pool = require('./config/db');

const DEFAULT_SETTINGS = { insurance_rate: 0.015, insurance_min_fee: 1, vat_rate: 0.10, overdue_days: 7, stuck_hours: 24 };
const DEFAULT_RATES = {
    'Hàng hóa thông thường': 100,
    'Hàng hóa điện tử': 250,
    'Hàng hóa nguy hiểm': 180,
    'Hàng hóa nhanh': 400
};

async function getSettings() {
    try {
        const r = await pool.query('SELECT key, value FROM settings');
        const out = { ...DEFAULT_SETTINGS };
        r.rows.forEach(({ key, value }) => { if (key in out && !Number.isNaN(Number(value))) out[key] = Number(value); });
        return out;
    } catch (e) { return { ...DEFAULT_SETTINGS }; }
}

async function getRates() {
    try {
        const r = await pool.query('SELECT cargo_type, unit_price::float AS unit_price FROM price_rates');
        if (!r.rows.length) return { ...DEFAULT_RATES };
        const out = { ...DEFAULT_RATES };
        r.rows.forEach(x => { out[x.cargo_type] = x.unit_price; });
        return out;
    } catch (e) { return { ...DEFAULT_RATES }; }
}

module.exports = { getSettings, getRates, DEFAULT_SETTINGS, DEFAULT_RATES };
