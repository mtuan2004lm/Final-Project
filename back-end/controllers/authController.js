// File: controllers/authController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

// =========================================================================
// 1. XỬ LÝ ĐĂNG KÝ (Dành cho Web/Khách hàng)
// =========================================================================
exports.register = async (req, res) => {
    const { username, password, fullName } = req.body;

    if (!username || !password || !fullName) {
        return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: "Tên tài khoản đã tồn tại!" });
        }

        const result = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) 
             VALUES ($1, $2, $3, 'CUSTOMER') RETURNING *`,
            [username, password, fullName]
        );

        res.json({ 
            message: "Đăng ký thành công!", 
            user: result.rows[0] 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi Server khi đăng ký");
    }
};

// =========================================================================
// 2. XỬ LÝ ĐĂNG NHẬP GỐC (Dành cho giao diện Web)
// =========================================================================
exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Tài khoản không tồn tại" });
        }

        const user = result.rows[0];

        if (password !== user.password_hash) {
            return res.status(401).json({ message: "Sai mật khẩu!" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name }, 
            process.env.JWT_SECRET || 'secret_mac_dinh', 
            { expiresIn: '2h' }
        );

        res.json({ 
            message: "Đăng nhập thành công",
            token, 
            user: { username: user.username, role: user.role } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Lỗi Server");
    }
};

// =========================================================================
// 3. XỬ LÝ ĐĂNG NHẬP & PHÂN QUYỀN RIÊNG CHO MOBILE APP (WMS & TMS)
// =========================================================================
exports.mobileLogin = async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Tài khoản không tồn tại trên hệ thống!" });
        }

        const user = result.rows[0];

        if (password !== user.password_hash) {
            return res.json({ success: false, message: "Mật khẩu không chính xác!" });
        }

        const userRole = user.role ? user.role.toLowerCase().trim() : '';

        if (userRole === 'wms' || userRole === 'tms') {
            return res.json({
                success: true,
                message: "Đăng nhập ứng dụng thành công!",
                role: userRole
            });
        } else {
            return res.json({
                success: false,
                message: `Quyền truy cập [${user.role}] bị từ chối trên thiết bị di động!`
            });
        }

    } catch (err) {
        console.error("🔴 LỖI TẠI AUTH_CONTROLLER (mobileLogin):", err.message);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống máy chủ dữ liệu!" });
    }
};