const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/'); },
  filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

// IMPORT CONTROLLERS
const customerController = require('../controllers/customerController');
const omsController = require('../controllers/omsController');
const wmsController = require('../controllers/wmsController');
const tmsController = require('../controllers/tmsController');
const readOnlyDeptController = require('../controllers/readOnlyDeptController');
const accController = require('../controllers/accController');
const adminController = require('../controllers/adminController');

// 1. ROUTE PHÒNG KHÁCH HÀNG (CUSTOMER)
router.post('/', upload.single('product_image'), customerController.createOrder);
router.get('/customer', customerController.getCustomerOrders);
router.put('/:id/pay', customerController.confirmPaymentSubmitted); // THIẾU TRƯỚC ĐÂY: nút "Tôi đã hoàn tất chuyển khoản" gọi route này
router.post('/:id/feedback', customerController.submitFeedback); // THIẾU TRƯỚC ĐÂY: nút "Submit Service Review" ở CustomerView.vue gọi route này (lỗi 404)

// 2. ROUTE PHÒNG ĐIỀU PHỐI (OMS)
router.get('/oms', omsController.getOmsOrders);
router.get('/oms/analytics/revenue', omsController.getRevenueReport);       // Đã sửa lại khớp Vue
router.get('/oms/analytics/customers', omsController.getCustomerAnalytics); // Đã sửa lại khớp Vue
router.put('/:id/return-order', omsController.returnOrderToCustomer);
router.get('/history/:id', omsController.getOrderHistory);

// 3. ROUTE PHÒNG KHO BÃI (WMS)
router.get('/wms/logs/:id', wmsController.getWarehouseLogsByOrder); // Tra cứu nhật ký theo mã đơn (đặt trước route /wms/:xxx nếu có)
router.get('/wms/logs', wmsController.getWarehouseGlobalLogs); // Đặt lên trước route động :id
router.get('/wms', wmsController.getWmsOrders);
router.put('/wms/:id/location', wmsController.updateOrderLocation);
router.put('/wms/:id/condition', upload.single('cargo_image'), wmsController.updateCargoCondition);
router.put('/wms/:id/release', wmsController.releaseToTms);
router.put('/wms/:id/scan-barcode', wmsController.scanBarcode);

// 4. ROUTE PHÒNG VẬN TẢI ĐỘI XE (TMS)
router.get('/tms/fleet', tmsController.getTruckFleet);
router.post('/tms/fleet', tmsController.createTruck);
router.put('/tms/fleet/gps', tmsController.updateTruckGps);         
router.put('/tms/fleet/:id', tmsController.updateTruck);            
router.put('/tms/fleet/:id/status', tmsController.updateTruckStatus); 
router.delete('/tms/fleet/:id', tmsController.deleteTruck);

router.get('/tms/driver/:license_plate', tmsController.getDriverTrips); // App tài xế lấy chuyến đang chạy

router.get('/tms', tmsController.getTmsOrders);
router.put('/tms/:id/assign', tmsController.assignDeliveryRoute);
router.put('/tms/:id/pod-submit', tmsController.submitDriverPod);

// 5. ROUTE PHÒNG KẾ TOÁN (ACC) & CHỨNG TỪ (DOCS)
router.get('/acc/orders', accController.getAccOrders);
router.put('/acc/:id/approve', accController.approvePayment);
router.get('/docs', readOnlyDeptController.getDocsOrders);
router.put('/docs/:id/lock', readOnlyDeptController.lockArchiveFile); // THIẾU TRƯỚC ĐÂY: nút "Niêm phong" ở DocsView.vue gọi route này
router.post('/docs/reports', readOnlyDeptController.submitOrderReportToAdmin); // Docs gửi báo cáo đơn hàng cho Admin

// 6. ROUTE PHÒNG QUẢN TRỊ (ADMIN) - Tổng quan toàn hệ thống
router.get('/admin/overview', adminController.getAllOrdersOverview);
router.get('/admin/reports', adminController.getReports);          // Danh sách báo cáo Docs đã gửi
router.get('/admin/reports/:id', adminController.getReportById);   // Mở xem chi tiết 1 báo cáo (không tải file)

// 7. ROUTE CẬP NHẬT TRẠNG THÁI CHUNG (Luôn xếp dưới cùng)
router.put('/:id', omsController.updateOrderStatus);

module.exports = router;