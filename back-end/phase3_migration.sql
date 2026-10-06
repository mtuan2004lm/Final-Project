-- ĐỢT 3: gom đơn/xe/lộ trình + quản lý đội xe. Chạy bằng:
--   "/Applications/Postgres.app/Contents/Versions/18/bin/psql" -p5432 logistics_db -f phase3_migration.sql
-- An toàn khi chạy lại (IF NOT EXISTS).

-- 1. Xe: tải trọng (số kiện), hạn bảo hiểm, số km đồng hồ
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS capacity_pcs INTEGER DEFAULT 100;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS odometer_km INTEGER DEFAULT 0;

-- 2. Đơn: thứ tự điểm giao trong tuyến + tọa độ điểm giao (cache sau khi tìm bản đồ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stop_sequence INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dest_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dest_lng DOUBLE PRECISION;

-- 3. Cache tọa độ theo địa chỉ (tránh gọi dịch vụ bản đồ lặp lại)
CREATE TABLE IF NOT EXISTS geocode_cache (
    address TEXT PRIMARY KEY,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    precise BOOLEAN DEFAULT TRUE,     -- FALSE = chỉ tìm được khu vực (bỏ số nhà), vị trí gần đúng
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Nhật ký bảo dưỡng / sửa chữa / đăng kiểm
CREATE TABLE IF NOT EXISTS truck_maintenance_logs (
    id SERIAL PRIMARY KEY,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    kind VARCHAR(30) NOT NULL,           -- Maintenance | Repair | Inspection
    cost NUMERIC(12,2) DEFAULT 0,
    odometer_km INTEGER,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Nhật ký đổ nhiên liệu
CREATE TABLE IF NOT EXISTS truck_fuel_logs (
    id SERIAL PRIMARY KEY,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    liters NUMERIC(10,2) NOT NULL,
    cost NUMERIC(12,2) DEFAULT 0,
    odometer_km INTEGER,
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Hồ sơ tài xế
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    license_no VARCHAR(50),
    license_class VARCHAR(10),
    license_expiry DATE,
    status VARCHAR(20) DEFAULT 'Active', -- Active | Off
    truck_license_plate VARCHAR(30),
    note TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
