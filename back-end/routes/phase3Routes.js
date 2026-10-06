// ĐỢT 3 - tạo đơn hàng loạt (CSV), quét QR hàng loạt (WMS), gom tuyến + gán xe tự động,
// tối ưu lộ trình, quản lý đội xe (bảo dưỡng, nhiên liệu, tài xế, cảnh báo hạn giấy tờ).
// Mount trong index.js:  app.use('/api/ext', phase3Routes);
const express = require('express');
const pool = require('../config/db');
const { optimizeStops, haversineKm } = require('../routeOptimizer');
const { getRates } = require('../settings');

const router = express.Router();

const DEPOT = {
    lat: parseFloat(process.env.DEPOT_LAT) || 10.7769,   // mặc định: trung tâm TP.HCM
    lng: parseFloat(process.env.DEPOT_LNG) || 106.7009
};

const log = (client, orderId, oldS, newS, notes) =>
    client.query('INSERT INTO order_logs (order_id, old_status, new_status, notes) VALUES ($1,$2,$3,$4)', [orderId, oldS, newS, notes]);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
// Chấp nhận Date (từ cột DATE của pg) hoặc chuỗi 'YYYY-MM-DD'; so theo ngày địa phương, không lệch múi giờ
const toLocalDay = (v) => {
    if (typeof v === 'string') { const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3]); }
    const d = new Date(v);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const daysUntil = (date) => date ? Math.round((toLocalDay(date).getTime() - todayStart().getTime()) / 86400000) : null;

// =====================================================================
// 1. TẠO ĐƠN HÀNG LOẠT TỪ CSV (khách hàng)
//    Giá do SERVER tính theo bảng giá, không tin giá từ client.
// =====================================================================
const PRICE = {
    'Hàng hóa thông thường': 100,
    'Hàng hóa điện tử': 250,
    'Hàng hóa nguy hiểm': 180,
    'Hàng hóa nhanh': 400
};

const normalizeCargo = (raw) => {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return 'Hàng hóa thông thường';
    if (/(thông thường|thuong|thường|regular|normal|standard)/.test(s)) return 'Hàng hóa thông thường';
    if (/(điện tử|dien tu|electronic)/.test(s)) return 'Hàng hóa điện tử';
    if (/(nguy hiểm|nguy hiem|hazard|danger)/.test(s)) return 'Hàng hóa nguy hiểm';
    if (/(nhanh|express|fast)/.test(s)) return 'Hàng hóa nhanh';
    return null;
};

router.post('/orders/bulk', async (req, res) => {
    const { username, orders } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    if (!Array.isArray(orders) || orders.length === 0) return res.status(400).json({ error: 'No rows to import' });
    if (orders.length > 200) return res.status(400).json({ error: 'Maximum 200 orders per import' });

    // Kiểm tra TOÀN BỘ dòng trước; có dòng lỗi -> không tạo gì cả (nhập hoặc tất cả hoặc không)
    const rowErrors = [];
    const clean = orders.map((o, i) => {
        const row = i + 1;
        const product = String(o.product_name || '').trim();
        const qty = parseInt(o.quantity, 10);
        const cargo = normalizeCargo(o.cargo_type);
        if (!product) rowErrors.push({ row, error: 'Missing product_name' });
        if (!Number.isInteger(qty) || qty < 1 || qty > 9999) rowErrors.push({ row, error: 'quantity must be a whole number from 1 to 9999' });
        if (!cargo) rowErrors.push({ row, error: `Unknown cargo_type "${o.cargo_type}"` });
        return {
            customer_name: String(o.customer_name || username).trim() || username,
            product_name: product,
            quantity: qty,
            cargo_type: cargo,
            delivery_address: String(o.delivery_address || '').trim() || null,
            receiver_name: String(o.receiver_name || '').trim() || null,
            receiver_phone: String(o.receiver_phone || '').trim() || null
        };
    });
    if (rowErrors.length) return res.status(400).json({ error: 'Some rows are invalid. Nothing was imported.', rowErrors });

    const RATES = await getRates();   // ĐỢT 5: bảng giá do Admin cấu hình
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const created = [];
        for (const o of clean) {
            const price = (RATES[o.cargo_type] ?? PRICE[o.cargo_type]) * o.quantity;
            const r = await client.query(
                `INSERT INTO orders (username, customer_name, product_name, cargo_type, quantity, total_price, total_cost,
                                     product_image, status, current_dept, delivery_address, receiver_name, receiver_phone)
                 VALUES ($1,$2,$3,$4,$5,$6,$6,'','NEW','OMS',$7,$8,$9) RETURNING id`,
                [username, o.customer_name, o.product_name, o.cargo_type, o.quantity, price,
                 o.delivery_address, o.receiver_name, o.receiver_phone]);
            await log(client, r.rows[0].id, 'NONE', 'NEW', `Order created from a CSV bulk import: ${o.product_name}`);
            created.push({ id: r.rows[0].id, price });
        }
        await client.query('COMMIT');
        res.status(201).json({ message: `${created.length} order(s) created`, count: created.length, created });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// =====================================================================
// 2. QUÉT QR HÀNG LOẠT (WMS)
//    body: { codes: ["PKG-60023","60024",...], release: false }
//    Mỗi mã xử lý độc lập (mã lỗi không chặn mã đúng); release=true -> bàn giao luôn sang TMS.
// =====================================================================
const parseCode = (code) => {
    const s = String(code || '').trim();
    const m = s.match(/PKG-(\d+)/i);
    if (m) { const id = Number(m[1]) - 60000; return id > 0 ? id : null; }
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return n > 60000 ? n - 60000 : n;    // "60024" (số của mã PKG) hoặc "24" (id thô) đều được
};

router.post('/wms/scan-batch', async (req, res) => {
    const { codes, release } = req.body;
    if (!Array.isArray(codes) || codes.length === 0) return res.status(400).json({ error: 'No codes provided' });
    if (codes.length > 500) return res.status(400).json({ error: 'Maximum 500 codes per batch' });

    const seen = new Set();
    const results = [];
    const client = await pool.connect();
    try {
        for (const code of codes) {
            const id = parseCode(code);
            if (!id) { results.push({ code, status: 'invalid_code' }); continue; }
            if (seen.has(id)) continue;           // bỏ mã trùng trong cùng lô
            seen.add(id);

            const cur = await client.query('SELECT id, status, current_dept, is_scanned FROM orders WHERE id = $1', [id]);
            const o = cur.rows[0];
            if (!o) { results.push({ code, id, status: 'not_found' }); continue; }
            if (String(o.current_dept).toUpperCase() !== 'WMS') {
                results.push({ code, id, status: 'not_in_warehouse', dept: o.current_dept }); continue;
            }

            let outcome = 'scanned';
            if (o.is_scanned) outcome = 'already_scanned';
            else {
                await client.query('UPDATE orders SET is_scanned = true WHERE id = $1', [id]);
                await log(client, id, o.status, o.status, 'The barcode has been successfully scanned and verified (batch scan).');
            }

            if (release) {
                await client.query(`UPDATE orders SET current_dept = 'TMS', status = 'APPROVED' WHERE id = $1`, [id]);
                await log(client, id, 'APPROVED', 'APPROVED', 'The order has been released and handed over to the TMS department (batch scan).');
                outcome = outcome === 'already_scanned' ? 'already_scanned_released' : 'scanned_released';
            }
            results.push({ code, id, status: outcome });
        }
        const ok = results.filter(r => r.status.startsWith('scanned') || r.status.startsWith('already_scanned')).length;
        res.json({ message: `${ok}/${results.length} package(s) processed`, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

// =====================================================================
// 3. GOM ĐƠN THEO ĐỊA CHỈ + GÁN XE TỰ ĐỘNG
// =====================================================================
const AVAILABLE = ['sẵn sàng', 'ready', 'available'];

const parts = (address) => String(address || '').split(',').map(x => x.trim()).filter(Boolean);
const groupKey = (address, mode) => {
    const p = parts(address);
    if (!p.length) return 'No address';
    if (mode === 'address') return String(address).trim();
    if (mode === 'city') return p[p.length - 1];
    return p.length <= 2 ? p.join(', ') : p.slice(-2).join(', ');   // area = quận + thành phố
};

// Xe hợp lệ: đang "Sẵn sàng", chưa quá hạn đăng kiểm / bảo hiểm / bảo dưỡng
const eligibleTrucks = (trucks) => trucks.filter(t => {
    if (!AVAILABLE.includes(String(t.status || '').trim().toLowerCase())) return false;
    for (const f of ['registry_expiry', 'insurance_expiry', 'maintenance_date']) {
        const d = daysUntil(t[f]);
        if (d !== null && d < 0) return false;
    }
    return true;
});

// Chọn xe vừa khít nhất (tải trọng nhỏ nhất mà vẫn chở đủ). Không xe nào đủ -> xe lớn nhất (fits=false).
const pickTruck = (trucks, qty) => {
    const sorted = trucks.slice().sort((a, b) => (a.capacity_pcs || 0) - (b.capacity_pcs || 0));
    const fit = sorted.find(t => (t.capacity_pcs || 0) >= qty);
    if (fit) return { truck: fit, fits: true };
    const biggest = sorted[sorted.length - 1];
    return biggest ? { truck: biggest, fits: false } : { truck: null, fits: false };
};

const loadTrucks = async () => (await pool.query('SELECT * FROM trucks ORDER BY id')).rows;

router.get('/tms/suggest-truck', async (req, res) => {
    const qty = parseInt(req.query.total_qty, 10) || 0;
    try {
        const trucks = eligibleTrucks(await loadTrucks());
        const { truck, fits } = pickTruck(trucks, qty);
        res.json({
            total_qty: qty,
            suggested: truck ? { id: truck.id, license_plate: truck.license_plate, type: truck.type, capacity_pcs: truck.capacity_pcs, fits } : null,
            available_count: trucks.length
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Đề xuất kế hoạch cho TẤT CẢ đơn đang chờ điều phối (chưa lưu gì).
router.get('/tms/auto-plan', async (req, res) => {
    const mode = ['city', 'address'].includes(req.query.mode) ? req.query.mode : 'area';
    try {
        const orders = (await pool.query(
            `SELECT id, customer_name, product_name, quantity, COALESCE(delivery_address,'') AS delivery_address, pickup_date
             FROM orders
             WHERE UPPER(current_dept) = 'TMS' AND UPPER(status) IN ('APPROVED','PACKED')
             ORDER BY pickup_date ASC NULLS LAST, id ASC`)).rows;
        let pool_ = eligibleTrucks(await loadTrucks());
        const maxCap = Math.max(0, ...pool_.map(t => t.capacity_pcs || 0));

        // gom theo khu vực
        const buckets = {};
        orders.forEach(o => { (buckets[groupKey(o.delivery_address, mode)] = buckets[groupKey(o.delivery_address, mode)] || []).push(o); });

        // cắt mỗi nhóm thành các chuyến không vượt tải trọng xe lớn nhất
        const trips = [];
        Object.entries(buckets).forEach(([key, list]) => {
            let cur = [], qty = 0;
            const flush = () => { if (cur.length) trips.push({ key, orders: cur, total_qty: qty }); cur = []; qty = 0; };
            list.forEach(o => {
                const q = Number(o.quantity) || 0;
                if (maxCap > 0 && cur.length && qty + q > maxCap) flush();
                cur.push(o); qty += q;
            });
            flush();
        });
        trips.sort((a, b) => b.total_qty - a.total_qty);

        const dd = new Date(); const stamp = `${String(dd.getDate()).padStart(2, '0')}/${String(dd.getMonth() + 1).padStart(2, '0')}`;
        const counters = {};
        const plan = trips.map(t => {
            counters[t.key] = (counters[t.key] || 0) + 1;
            const suffix = trips.filter(x => x.key === t.key).length > 1 ? ` #${counters[t.key]}` : '';
            const { truck, fits } = pickTruck(pool_, t.total_qty);
            if (truck) pool_ = pool_.filter(x => x.id !== truck.id);    // mỗi xe chỉ nhận 1 chuyến trong kế hoạch
            return {
                key: t.key,
                route_name: `${t.key} - ${stamp}${suffix}`,
                total_qty: t.total_qty,
                order_ids: t.orders.map(o => o.id),
                orders: t.orders,
                truck: truck ? { id: truck.id, license_plate: truck.license_plate, type: truck.type, capacity_pcs: truck.capacity_pcs } : null,
                fits
            };
        });
        res.json({ mode, groups: plan.length, unassigned: plan.filter(p => !p.truck).length, plan });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 4. TỐI ƯU THỨ TỰ ĐIỂM GIAO (tìm tọa độ qua OpenStreetMap Nominatim, có cache)
// =====================================================================
const geocodeOnce = async (q) => {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=vn&q=' + encodeURIComponent(q);
    const r = await fetch(url, {
        headers: { 'User-Agent': 'LogisticsPro-StudentProject/1.0', 'Accept-Language': 'vi,en' },
        signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) throw new Error('geocoder HTTP ' + r.status);
    const data = await r.json();
    return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
};

let lastGeocodeAt = 0;
const geocode = async (address) => {
    const key = String(address || '').trim();
    if (!key) return null;
    const cached = await pool.query('SELECT lat, lng, precise FROM geocode_cache WHERE address = $1', [key]);
    if (cached.rows.length) {
        const c = cached.rows[0];
        return c.lat == null ? null : { lat: c.lat, lng: c.lng, precise: c.precise };
    }
    // Nominatim yêu cầu tối đa 1 yêu cầu/giây
    const wait = 1100 - (Date.now() - lastGeocodeAt);
    if (wait > 0) await sleep(wait);
    lastGeocodeAt = Date.now();

    let found = null, precise = true;
    try {
        found = await geocodeOnce(key);
        if (!found) {                                   // thử lại bỏ số nhà / tên đường đầu tiên
            const p = parts(key);
            if (p.length > 1) {
                await sleep(1100); lastGeocodeAt = Date.now();
                found = await geocodeOnce(p.slice(1).join(', '));
                precise = false;
            }
        }
    } catch (e) {
        return null;                                   // lỗi mạng: không cache để lần sau thử lại
    }
    await pool.query(
        `INSERT INTO geocode_cache (address, lat, lng, precise) VALUES ($1,$2,$3,$4) ON CONFLICT (address) DO NOTHING`,
        [key, found ? found.lat : null, found ? found.lng : null, precise]);
    return found ? { ...found, precise } : null;
};

router.post('/tms/optimize-route', async (req, res) => {
    const { order_ids } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length === 0) return res.status(400).json({ error: 'No orders provided' });
    const ids = order_ids.map(Number).filter(Number.isInteger);
    try {
        const rows = (await pool.query(
            `SELECT id, customer_name, COALESCE(delivery_address,'') AS delivery_address FROM orders WHERE id = ANY($1::int[])`, [ids])).rows;
        const byId = Object.fromEntries(rows.map(r => [r.id, r]));

        const located = [], unresolved = [];
        for (const id of ids) {
            const o = byId[id];
            if (!o) continue;
            const pos = await geocode(o.delivery_address);
            if (pos) located.push({ id, lat: pos.lat, lng: pos.lng, precise: pos.precise !== false });
            else unresolved.push(id);
        }

        const opt = optimizeStops(DEPOT, located);
        const posById = Object.fromEntries(located.map(l => [l.id, l]));
        const stops = opt.order.map((id, i) => ({
            order_id: id,
            customer_name: byId[id].customer_name,
            address: byId[id].delivery_address,
            lat: posById[id].lat, lng: posById[id].lng,
            approximate: !posById[id].precise,
            leg_km: Math.round(opt.legs[i] * 10) / 10
        }));
        // đơn không tìm được tọa độ: để cuối, giữ nguyên thứ tự gốc
        unresolved.forEach(id => stops.push({
            order_id: id, customer_name: byId[id]?.customer_name, address: byId[id]?.delivery_address,
            lat: null, lng: null, approximate: true, leg_km: null
        }));

        // so sánh với thứ tự ban đầu (theo khoảng cách chim bay)
        let originalKm = 0, prev = DEPOT;
        located.forEach(l => { originalKm += haversineKm(prev, l); prev = l; });

        res.json({
            depot: DEPOT,
            ordered_ids: stops.map(s => s.order_id),
            stops,
            total_km: Math.round(opt.totalKm * 10) / 10,
            original_km: Math.round(originalKm * 10) / 10,
            unresolved,
            note: 'Distances are straight-line estimates, not road distances.'
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 5. QUẢN LÝ ĐỘI XE
// =====================================================================
router.get('/fleet/trucks', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, license_plate, type, driver_name, fuel_norm, status, current_lat, current_lng, gps_updated_at,
                    capacity_pcs, odometer_km,
                    to_char(maintenance_date, 'YYYY-MM-DD') AS maintenance_date,
                    to_char(registry_expiry, 'YYYY-MM-DD') AS registry_expiry,
                    to_char(insurance_expiry, 'YYYY-MM-DD') AS insurance_expiry
             FROM trucks ORDER BY id ASC`);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cập nhật các cột mở rộng của xe (tải trọng, hạn bảo hiểm, số km)
router.put('/fleet/trucks/:id/extra', async (req, res) => {
    const { capacity_pcs, insurance_expiry, odometer_km } = req.body;
    try {
        const r = await pool.query(
            `UPDATE trucks SET capacity_pcs = COALESCE($1, capacity_pcs),
                    insurance_expiry = COALESCE($2, insurance_expiry),
                    odometer_km = COALESCE($3, odometer_km), updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [capacity_pcs === '' ? null : capacity_pcs, insurance_expiry || null, odometer_km === '' ? null : odometer_km, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Truck not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Nhật ký bảo dưỡng ---
router.get('/fleet/trucks/:id/maintenance', async (req, res) => {
    try {
        res.json((await pool.query(`SELECT id, truck_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, kind, cost::float AS cost, odometer_km, note FROM truck_maintenance_logs WHERE truck_id = $1 ORDER BY truck_maintenance_logs.log_date DESC, id DESC`, [req.params.id])).rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fleet/trucks/:id/maintenance', async (req, res) => {
    const { log_date, kind, cost, odometer_km, note, next_due } = req.body;
    if (!['Maintenance', 'Repair', 'Inspection'].includes(kind)) return res.status(400).json({ error: 'kind must be Maintenance, Repair or Inspection' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(
            `INSERT INTO truck_maintenance_logs (truck_id, log_date, kind, cost, odometer_km, note)
             VALUES ($1, COALESCE($2, CURRENT_DATE), $3, COALESCE($4,0), $5, $6) RETURNING *`,
            [req.params.id, log_date || null, kind, cost || 0, odometer_km || null, note || null]);
        // Bảo dưỡng xong: cập nhật lịch bảo dưỡng kế tiếp / hạn đăng kiểm và số km
        if (kind === 'Maintenance' && next_due) await client.query(`UPDATE trucks SET maintenance_date = $1, updated_at = NOW() WHERE id = $2`, [next_due, req.params.id]);
        if (kind === 'Inspection' && next_due) await client.query(`UPDATE trucks SET registry_expiry = $1, updated_at = NOW() WHERE id = $2`, [next_due, req.params.id]);
        if (odometer_km) await client.query(`UPDATE trucks SET odometer_km = GREATEST(COALESCE(odometer_km,0), $1) WHERE id = $2`, [odometer_km, req.params.id]);
        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

router.delete('/fleet/maintenance/:logId', async (req, res) => {
    try { await pool.query('DELETE FROM truck_maintenance_logs WHERE id = $1', [req.params.logId]); res.json({ message: 'Deleted' }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Nhật ký nhiên liệu ---
router.get('/fleet/trucks/:id/fuel', async (req, res) => {
    try {
        res.json((await pool.query(`SELECT id, truck_id, to_char(log_date, 'YYYY-MM-DD') AS log_date, liters::float AS liters, cost::float AS cost, odometer_km, note FROM truck_fuel_logs WHERE truck_id = $1 ORDER BY truck_fuel_logs.log_date DESC, id DESC`, [req.params.id])).rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fleet/trucks/:id/fuel', async (req, res) => {
    const { log_date, liters, cost, odometer_km, note } = req.body;
    if (!(parseFloat(liters) > 0)) return res.status(400).json({ error: 'liters must be greater than 0' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await client.query(
            `INSERT INTO truck_fuel_logs (truck_id, log_date, liters, cost, odometer_km, note)
             VALUES ($1, COALESCE($2, CURRENT_DATE), $3, COALESCE($4,0), $5, $6) RETURNING *`,
            [req.params.id, log_date || null, liters, cost || 0, odometer_km || null, note || null]);
        if (odometer_km) await client.query(`UPDATE trucks SET odometer_km = GREATEST(COALESCE(odometer_km,0), $1) WHERE id = $2`, [odometer_km, req.params.id]);
        await client.query('COMMIT');
        res.status(201).json(r.rows[0]);
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally { client.release(); }
});

router.delete('/fleet/fuel/:logId', async (req, res) => {
    try { await pool.query('DELETE FROM truck_fuel_logs WHERE id = $1', [req.params.logId]); res.json({ message: 'Deleted' }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// Tổng hợp chi phí + mức tiêu hao thực tế (L/100km) của 1 xe
router.get('/fleet/trucks/:id/summary', async (req, res) => {
    try {
        const fuel = (await pool.query(
            `SELECT liters::float AS liters, cost::float AS cost, odometer_km FROM truck_fuel_logs WHERE truck_id = $1 ORDER BY log_date ASC, id ASC`, [req.params.id])).rows;
        const maint = (await pool.query(
            `SELECT COALESCE(SUM(cost),0)::float AS cost, COUNT(*)::int AS cnt FROM truck_maintenance_logs WHERE truck_id = $1`, [req.params.id])).rows[0];
        const fuelCost = fuel.reduce((s, r) => s + r.cost, 0);
        const liters = fuel.reduce((s, r) => s + r.liters, 0);
        // L/100km: dựa trên các lần đổ có số km đồng hồ (bỏ lần đầu vì chưa biết quãng đường trước đó)
        const withOdo = fuel.filter(f => f.odometer_km != null);
        let l100 = null;
        if (withOdo.length >= 2) {
            const km = withOdo[withOdo.length - 1].odometer_km - withOdo[0].odometer_km;
            const lit = withOdo.slice(1).reduce((s, r) => s + r.liters, 0);
            if (km > 0) l100 = Math.round((lit / km) * 1000) / 10;
        }
        res.json({ fuel_cost: fuelCost, fuel_liters: liters, fuel_fills: fuel.length, maintenance_cost: maint.cost, maintenance_count: maint.cnt,
                   total_cost: fuelCost + maint.cost, liters_per_100km: l100 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Tài xế ---
router.get('/fleet/drivers', async (req, res) => {
    try { res.json((await pool.query(`SELECT id, full_name, phone, license_no, license_class, to_char(license_expiry, 'YYYY-MM-DD') AS license_expiry, status, truck_license_plate, note FROM drivers ORDER BY id ASC`)).rows); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fleet/drivers', async (req, res) => {
    const d = req.body;
    if (!d.full_name || !d.full_name.trim()) return res.status(400).json({ error: 'Driver name is required' });
    try {
        const r = await pool.query(
            `INSERT INTO drivers (full_name, phone, license_no, license_class, license_expiry, status, truck_license_plate, note)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6,'Active'),$7,$8) RETURNING *`,
            [d.full_name.trim(), d.phone || null, d.license_no || null, d.license_class || null,
             d.license_expiry || null, d.status || null, d.truck_license_plate || null, d.note || null]);
        res.status(201).json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/fleet/drivers/:id', async (req, res) => {
    const d = req.body;
    try {
        const r = await pool.query(
            `UPDATE drivers SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone), license_no = COALESCE($3, license_no),
                    license_class = COALESCE($4, license_class), license_expiry = COALESCE($5, license_expiry),
                    status = COALESCE($6, status), truck_license_plate = $7, note = COALESCE($8, note)
             WHERE id = $9 RETURNING *`,
            [d.full_name || null, d.phone || null, d.license_no || null, d.license_class || null,
             d.license_expiry || null, d.status || null, d.truck_license_plate || null, d.note || null, req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'Driver not found' });
        res.json(r.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/fleet/drivers/:id', async (req, res) => {
    try { await pool.query('DELETE FROM drivers WHERE id = $1', [req.params.id]); res.json({ message: 'Deleted' }); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Cảnh báo hạn giấy tờ / bảo dưỡng (quá hạn hoặc còn <= 30 ngày) ---
router.get('/fleet/alerts', async (req, res) => {
    const WINDOW = 30;
    try {
        const alerts = [];
        const trucks = (await pool.query(`SELECT id, license_plate, to_char(registry_expiry,'YYYY-MM-DD') AS registry_expiry,
                 to_char(insurance_expiry,'YYYY-MM-DD') AS insurance_expiry, to_char(maintenance_date,'YYYY-MM-DD') AS maintenance_date FROM trucks`)).rows;
        trucks.forEach(t => [['registry_expiry', 'Registry / inspection'], ['insurance_expiry', 'Insurance'], ['maintenance_date', 'Maintenance due']]
            .forEach(([f, label]) => {
                const d = daysUntil(t[f]);
                if (d !== null && d <= WINDOW) alerts.push({ type: 'truck', ref: t.license_plate, kind: label, date: t[f], days_left: d, severity: d < 0 ? 'expired' : 'soon' });
            }));
        const drivers = (await pool.query(`SELECT id, full_name, to_char(license_expiry,'YYYY-MM-DD') AS license_expiry FROM drivers WHERE COALESCE(status,'Active') = 'Active'`)).rows;
        drivers.forEach(dr => {
            const d = daysUntil(dr.license_expiry);
            if (d !== null && d <= WINDOW) alerts.push({ type: 'driver', ref: dr.full_name, kind: 'Driver license', date: dr.license_expiry, days_left: d, severity: d < 0 ? 'expired' : 'soon' });
        });
        alerts.sort((a, b) => a.days_left - b.days_left);
        res.json(alerts);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// =====================================================================
// 6. GOM TUYẾN CÓ THỨ TỰ ĐIỂM GIAO + CHUYẾN CỦA TÀI XẾ (kèm địa chỉ, sắp theo thứ tự giao)
//    Thay thế /tms/consolidate trong phase1Routes (bản đó không lưu stop_sequence và không kiểm tra tải trọng).
//    Giao diện TMS mới gọi /tms/consolidate-ordered; /tms/consolidate cũ vẫn còn nhưng không còn được dùng.
// =====================================================================
router.post('/tms/consolidate-ordered', async (req, res) => {
    const { order_ids, route_name, license_plate } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length === 0) return res.status(400).json({ error: 'No orders selected' });
    if (!route_name || !route_name.trim()) return res.status(400).json({ error: 'Route name is required' });
    if (!license_plate) return res.status(400).json({ error: 'Truck is required' });
    const ids = order_ids.map(Number).filter(Number.isInteger);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const truck = (await client.query('SELECT status, capacity_pcs FROM trucks WHERE license_plate=$1 FOR UPDATE', [license_plate])).rows[0];
        if (!truck) throw new Error('Truck not found');

        const found = (await client.query(
            `SELECT id, status, quantity FROM orders
             WHERE id = ANY($1::int[]) AND UPPER(current_dept)='TMS' AND UPPER(status) IN ('APPROVED','PACKED') FOR UPDATE`, [ids])).rows;
        if (found.length !== ids.length) throw new Error('Some orders are no longer available for dispatch. Please refresh and try again.');

        const totalQty = found.reduce((s, o) => s + (Number(o.quantity) || 0), 0);
        if (truck.capacity_pcs && totalQty > truck.capacity_pcs) {
            throw new Error(`Load of ${totalQty} package(s) exceeds this truck's capacity (${truck.capacity_pcs}). Choose a bigger truck or split the route.`);
        }

        // stop_sequence = vị trí trong mảng order_ids (đã được tối ưu ở phía client nếu có)
        await client.query(
            `UPDATE orders o SET delivery_route = $1, assigned_truck = $2, status = 'SHIPPING', stop_sequence = s.seq
             FROM (SELECT id, ord AS seq FROM unnest($3::int[]) WITH ORDINALITY AS t(id, ord)) s
             WHERE o.id = s.id`, [route_name.trim(), license_plate, ids]);

        for (const o of found) {
            await log(client, o.id, o.status, 'SHIPPING', `TMS consolidated ${ids.length} order(s) into route "${route_name.trim()}". Truck: ${license_plate}`);
        }
        await client.query(`UPDATE trucks SET status = 'Đang đi giao hàng', updated_at = NOW() WHERE license_plate = $1`, [license_plate]);
        await client.query('COMMIT');
        res.json({ message: `Route created with ${ids.length} order(s)`, count: ids.length, total_qty: totalQty });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: e.message });
    } finally { client.release(); }
});

router.get('/tms/driver-trips/:plate', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, customer_name, product_name, quantity, status,
                    COALESCE(delivery_route,'') AS delivery_route, COALESCE(assigned_truck,'') AS assigned_truck,
                    COALESCE(bot_fee,0) AS bot_fee, COALESCE(fuel_fee,0) AS fuel_fee,
                    COALESCE(driver_notes,'') AS driver_notes, COALESCE(gps_coordinates,'') AS gps_coordinates,
                    COALESCE(pickup_address,'') AS pickup_address, COALESCE(delivery_address,'') AS delivery_address, receiver_name, receiver_phone, stop_sequence
             FROM orders
             WHERE assigned_truck = $1 AND UPPER(status) = 'SHIPPING'
             ORDER BY stop_sequence ASC NULLS LAST, id ASC`, [req.params.plate]);
        res.json(r.rows);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
