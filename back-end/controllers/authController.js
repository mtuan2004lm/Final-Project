// File: controllers/authController.js
const pool = require('../config/db');
const jwt = require('jsonwebtoken');

// =========================================================================
// 1. XỬ LÝ ĐĂNG KÝ (Dành cho Web/Khách hàng)
// =========================================================================
exports.register = async (req, res) => {
    const { username, password, fullName } = req.body;

    if (!username || !password || !fullName) {
        return res.status(400).json({ message: "Please fill in all the information!" });
    }

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ message: "The account name already exists.!" });
        }

        const result = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role) 
             VALUES ($1, $2, $3, 'CUSTOMER') RETURNING *`,
            [username, password, fullName]
        );

        res.json({ 
            message: "Registration successful!", 
            user: result.rows[0] 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error Server when registering");
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
            return res.status(401).json({ message: "The account does not exist" });
        }

        const user = result.rows[0];

        if (password !== user.password_hash) {
            return res.status(401).json({ message: "Wrong password!" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.full_name }, 
            process.env.JWT_SECRET || 'default_secret', 
            { expiresIn: '2h' }
        );

        res.json({ 
            message: "Login successful",
            token, 
            user: { username: user.username, role: user.role } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error Server");
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
            return res.json({ success: false, message: "The account does not exist on the system!" });
        }

        const user = result.rows[0];

        if (password !== user.password_hash) {
            return res.json({ success: false, message: "The password is incorrect!" });
        }

        const userRole = user.role ? user.role.toLowerCase().trim() : '';

        if (userRole === 'wms' || userRole === 'tms') {
            return res.json({
                success: true,
                message: "Login application successful!",
                role: userRole
            });
        } else {
            return res.json({
                success: false,
                message: `Access to [${user.role}] was rejected on the mobile device!`
            });
        }

    } catch (err) {
        console.error("🔴 ERROR AT AUTH_CONTROLLER (mobileLogin):", err.message);
        return res.status(500).json({ success: false, message: "Error system server data!" });
    }
};