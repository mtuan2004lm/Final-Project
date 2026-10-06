// Tối ưu thứ tự điểm giao: gần nhất trước (nearest neighbor) rồi tinh chỉnh bằng 2-opt.
// Điểm xuất phát (kho) cố định, điểm cuối tự do. Khoảng cách theo đường chim bay (haversine) - ước lượng,
// không phải quãng đường thực tế trên đường bộ.

const toRad = (d) => (d * Math.PI) / 180;

function haversineKm(a, b) {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}

// depot: {lat,lng}; stops: [{id,lat,lng}]  ->  { order: [id...], legs: [km...], totalKm }
function optimizeStops(depot, stops) {
    if (stops.length === 0) return { order: [], legs: [], totalKm: 0 };

    // 1. Nearest neighbor
    const remaining = stops.slice();
    const path = [depot];
    while (remaining.length) {
        const last = path[path.length - 1];
        let bi = 0, bd = Infinity;
        remaining.forEach((s, i) => {
            const d = haversineKm(last, s);
            if (d < bd) { bd = d; bi = i; }
        });
        path.push(remaining.splice(bi, 1)[0]);
    }

    // 2. 2-opt cho đường đi mở (path[0] = kho cố định)
    const n = path.length - 1;
    let improved = true, guard = 0;
    while (improved && guard++ < 200) {
        improved = false;
        for (let i = 1; i < n; i++) {
            for (let k = i + 1; k <= n; k++) {
                const before = haversineKm(path[i - 1], path[i]) + (k < n ? haversineKm(path[k], path[k + 1]) : 0);
                const after = haversineKm(path[i - 1], path[k]) + (k < n ? haversineKm(path[i], path[k + 1]) : 0);
                if (after < before - 1e-9) {
                    const seg = path.slice(i, k + 1).reverse();
                    path.splice(i, k - i + 1, ...seg);
                    improved = true;
                }
            }
        }
    }

    const legs = [];
    for (let i = 1; i < path.length; i++) legs.push(haversineKm(path[i - 1], path[i]));
    return {
        order: path.slice(1).map(p => p.id),
        legs,
        totalKm: legs.reduce((s, x) => s + x, 0)
    };
}

module.exports = { haversineKm, optimizeStops };
