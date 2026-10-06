-- ĐỢT 5: quản lý người dùng, bảng giá cấu hình, hóa đơn VAT, tệp đính kèm Docs, lịch sử niêm phong.
-- Chạy 1 lần (an toàn khi chạy lại).

-- 1. Người dùng: khóa/mở tài khoản
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
UPDATE users SET active = TRUE WHERE active IS NULL;

-- 2. Bảng giá theo loại hàng (Admin sửa được)
CREATE TABLE IF NOT EXISTS price_rates (
    cargo_type VARCHAR(100) PRIMARY KEY,
    unit_price NUMERIC(12,2) NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO price_rates (cargo_type, unit_price) VALUES
    ('Hàng hóa thông thường', 100),
    ('Hàng hóa điện tử', 250),
    ('Hàng hóa nguy hiểm', 180),
    ('Hàng hóa nhanh', 400)
ON CONFLICT (cargo_type) DO NOTHING;

-- 3. Cài đặt chung (phí bảo hiểm, VAT, số ngày coi là quá hạn thanh toán...)
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(60) PRIMARY KEY,
    value VARCHAR(100) NOT NULL
);
INSERT INTO settings (key, value) VALUES
    ('insurance_rate', '0.015'),
    ('insurance_min_fee', '1'),
    ('vat_rate', '0.10'),
    ('overdue_days', '7'),
    ('stuck_hours', '24')
ON CONFLICT (key) DO NOTHING;

-- 4. Hóa đơn chính thức có số liên tục + VAT
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(30) UNIQUE,
    order_id INTEGER NOT NULL,
    username VARCHAR(100),
    customer_name VARCHAR(200),
    subtotal NUMERIC(12,2) NOT NULL,
    vat_rate NUMERIC(5,4) NOT NULL,
    vat_amount NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'ISSUED',     -- ISSUED | CANCELLED
    issued_by VARCHAR(100),
    issued_at TIMESTAMP DEFAULT NOW(),
    cancelled_at TIMESTAMP,
    cancel_reason TEXT
);
-- mỗi đơn chỉ có tối đa 1 hóa đơn đang hiệu lực
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_order_active ON invoices (order_id) WHERE status = 'ISSUED';

-- 5. Tệp đính kèm hồ sơ (hợp đồng, biên bản, chứng từ...)
CREATE TABLE IF NOT EXISTS order_documents (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    doc_type VARCHAR(40) DEFAULT 'Other',
    file_name VARCHAR(200) NOT NULL,        -- tên lưu trên đĩa
    original_name VARCHAR(255),
    mime VARCHAR(100),
    size_bytes INTEGER,
    uploaded_by VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orderdocs_order ON order_documents (order_id);

-- 6. Lịch sử niêm phong / mở lại hồ sơ
CREATE TABLE IF NOT EXISTS archive_events (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    action VARCHAR(10) NOT NULL,            -- SEALED | REOPENED
    actor VARCHAR(100),
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archive_order ON archive_events (order_id, id);
