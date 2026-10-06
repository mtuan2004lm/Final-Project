-- ĐỢT 6: địa chỉ lấy hàng (pickup) tách riêng khỏi địa chỉ giao hàng. An toàn khi chạy lại.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_address TEXT;
