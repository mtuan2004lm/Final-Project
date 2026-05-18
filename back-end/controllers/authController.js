// File: controllers/authController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

// 1. Xử lý Đăng ký
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

// 2. Xử lý Đăng nhập
exports.login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Tài khoản không tồn tại" });
        }

        const user = result.rows[0];

        // So sánh mật khẩu từ DB và mã hóa token bằng JWT_SECRET trong .env
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