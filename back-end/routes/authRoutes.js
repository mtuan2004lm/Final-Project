const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Tuyến đường xử lý Đăng ký
router.post('/register', authController.register);

// Tuyến đường xử lý Đăng nhập (Hãy chắc chắn bạn đã viết hàm login trong authController)
router.post('/login', authController.login); 

// Tuyến đường xử lý kết nối đăng nhập cho Android Studio
router.post('/mobile-login', authController.mobileLogin);

module.exports = router;