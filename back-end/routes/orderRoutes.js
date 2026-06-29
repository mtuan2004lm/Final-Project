const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // <-- THÊM THƯ VIỆN HỆ THỐNG FILE ĐỂ FIX LỖI 2

// <-- TỰ ĐỘNG KIỂM TRA VÀ TẠO THƯ MỤC UPLOADS NẾU CHƯA CÓ TRÊN MÁY
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// CẤU HÌNH MULTER ĐỂ XỬ LÝ UPLOAD ẢNH HÀNG HÓA
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// IMPORT CÁC CONTROLLERS PHÒNG BAN
const customerController = require('../controllers/customerController');
const omsController = require('../controllers/omsController');
const wmsController = require('../controllers/wmsController');
const tmsController = require('../controllers/tmsController');
const readOnlyDeptController = require('../controllers/readOnlyDeptController');
const accController = require('../controllers/accController'); 

// =========================================================================
// 1. LUỒNG KHÁCH HÀNG (CUSTOMER ACTIONS)
// =========================================================================
// ĐÃ TÍCH HỢP: upload.single('product_image') để giải mã ảnh tải lên từ form khách hàng
router.post('/', upload.single('product_image'), customerController.createOrder);
router.get('/customer', customerController.getCustomerOrders); 

// =========================================================================
// 2. LUỒNG THỐNG KÊ, PHÂN TÍCH & LOG SỔ CÁI (OMS & HISTORY)
// =========================================================================
router.get('/oms/analytics/revenue', omsController.getRevenueReport);
router.get('/oms/analytics/customers', omsController.getCustomerAnalytics);
router.get('/:id/history', omsController.getOrderHistory); 

// =========================================================================
// 3. ĐỊNH TUYẾN DÀNH RIÊNG CHO PHÒNG KHO (WMS ACTIONS)
// =========================================================================
router.get('/wms/all/logs', wmsController.getWarehouseGlobalLogs);

// =========================================================================
// 4. ĐỊNH TUYẾN DÀNH RIÊNG CHO PHÒNG VẬN TẢI ĐỘI XE (TMS ACTIONS)
// =========================================================================
router.get('/tms/fleet', tmsController.getTruckFleet);                      
router.put('/tms/:id/assign', tmsController.assignDeliveryRoute);            
router.put('/tms/:id/pod-submit', tmsController.submitDriverPod);            

// =========================================================================
// 5. ĐỊNH TUYẾN DÀNH RIÊNG CHO PHÒNG KHO & KẾ TOÁN (ACC & GLOBAL READ)
// =========================================================================
router.get('/acc/orders', accController.getAccOrders);           
router.put('/acc/:id/approve', accController.approvePayment);    

// =========================================================================
// 6. LẤY DANH SÁCH ĐƠN HÀNG HÀNG LOẠT THEO TỪNG PHÒNG BAN
// =========================================================================
router.get('/oms', omsController.getOmsOrders);           
router.get('/wms', wmsController.getWmsOrders);           
router.get('/tms', tmsController.getTmsOrders);           
router.get('/docs', readOnlyDeptController.getDocsOrders); 

// =========================================================================
// 7. CƠ CHẾ CẬP NHẬT TRẠNG THÁI CHUNG CHUNG (Xếp cuối cùng)
// =========================================================================
router.put('/:id', omsController.updateOrderStatus); 

module.exports = router;