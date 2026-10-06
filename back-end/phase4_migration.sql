-- ĐỢT 4: bảo hiểm + bồi thường, OTP quên mật khẩu, audit log. Chạy 1 lần (an toàn khi chạy lại).

-- 1. Bảo hiểm hàng hóa gắn vào đơn
ALTER TABLE orders ADD COLUMN IF NOT EXISTS insured BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS insured_value NUMERIC(12,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS insurance_fee NUMERIC(12,2) DEFAULT 0;

-- 2. Yêu cầu bồi thường
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    username VARCHAR(100) NOT NULL,
    reason VARCHAR(20) NOT NULL,                 -- Damaged | Lost | Delayed | Other
    description TEXT,
    claimed_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | REJECTED | PAID
    approved_amount NUMERIC(12,2),
    resolver_note TEXT,
    resolved_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    paid_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_claims_user ON claims (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_claims_order ON claims (order_id);

-- 3. OTP quên mật khẩu (lưu mã đã băm, hết hạn sau 10 phút)
CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    reset_token_hash VARCHAR(64),
    token_expires_at TIMESTAMP,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_resets (LOWER(username), created_at);

-- 4. Nhật ký hoạt động (audit log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(100),
    action VARCHAR(40) NOT NULL,                 -- ví dụ: POST /api/orders, LOGIN_FAILED, CLAIM_APPROVED
    entity VARCHAR(40),
    entity_id VARCHAR(40),
    status_code INTEGER,
    detail TEXT,
    ip VARCHAR(60),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (LOWER(actor));
