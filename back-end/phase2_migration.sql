-- ĐỢT 2: thông báo trong app + chat hỗ trợ. Chạy 1 lần trong psql (an toàn khi chạy lại).

-- 1. Bảng thông báo cho khách hàng
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    order_id INTEGER,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (LOWER(username), is_read);

-- 2. Bảng tin nhắn hỗ trợ giữa khách hàng và OMS (mỗi khách là 1 cuộc hội thoại)
CREATE TABLE IF NOT EXISTS support_messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,        -- tài khoản khách hàng (định danh cuộc hội thoại)
    order_id INTEGER,                      -- đơn liên quan (không bắt buộc)
    sender VARCHAR(20) NOT NULL,           -- 'CUSTOMER' hoặc 'OMS'
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_user ON support_messages (LOWER(username), id);

-- 3. TRIGGER: tự tạo thông báo cho khách mỗi khi đơn đổi trạng thái / thanh toán / trả hàng / hoàn tiền.
--    Dùng trigger nên KHÔNG cần sửa các controller hiện có (OMS, WMS, TMS, ACC...).
CREATE OR REPLACE FUNCTION notify_order_change() RETURNS trigger AS $$
BEGIN
    IF NEW.username IS NULL OR NEW.username = '' THEN
        RETURN NEW;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO notifications (username, order_id, title, message) VALUES (
            NEW.username, NEW.id,
            'Order #' || NEW.id || ' updated',
            CASE UPPER(COALESCE(NEW.status, ''))
                WHEN 'APPROVED'  THEN 'Your order has been approved and sent to the warehouse.'
                WHEN 'PACKED'    THEN 'Your order has been packed and is waiting for a truck.'
                WHEN 'SHIPPING'  THEN 'Your order is on the way to the delivery address.'
                WHEN 'DELIVERED' THEN 'Your order has been delivered successfully. You can now rate our service.'
                WHEN 'DONE'      THEN 'Your order has been completed.'
                WHEN 'RETURNED'  THEN 'Your order was returned by OMS. Please open the order to see the reason.'
                WHEN 'CANCELLED' THEN 'Your order has been cancelled.'
                ELSE 'Order status changed to ' || COALESCE(NEW.status, '-') || '.'
            END
        );
    END IF;

    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND UPPER(COALESCE(NEW.payment_status, '')) = 'PAID' THEN
        INSERT INTO notifications (username, order_id, title, message)
        VALUES (NEW.username, NEW.id, 'Payment confirmed', 'Accounting has confirmed your payment for order #' || NEW.id || '.');
    END IF;

    IF NEW.return_status IS DISTINCT FROM OLD.return_status THEN
        IF NEW.return_status = 'APPROVED' THEN
            INSERT INTO notifications (username, order_id, title, message)
            VALUES (NEW.username, NEW.id, 'Return approved', 'Your return request for order #' || NEW.id || ' was approved. A refund is being processed.');
        ELSIF NEW.return_status = 'REJECTED' THEN
            INSERT INTO notifications (username, order_id, title, message)
            VALUES (NEW.username, NEW.id, 'Return rejected', 'Your return request for order #' || NEW.id || ' was rejected.');
        END IF;
    END IF;

    IF NEW.refund_status IS DISTINCT FROM OLD.refund_status AND NEW.refund_status = 'REFUNDED' THEN
        INSERT INTO notifications (username, order_id, title, message)
        VALUES (NEW.username, NEW.id, 'Refund sent', 'We have transferred your refund for order #' || NEW.id || '.');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_order_change ON orders;
CREATE TRIGGER trg_notify_order_change
    AFTER UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION notify_order_change();
