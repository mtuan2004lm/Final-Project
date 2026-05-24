const express = require('express');
const router = express.Router();

const customerController = require('../controllers/customerController');
const omsController = require('../controllers/omsController');
const wmsController = require('../controllers/wmsController');
const tmsController = require('../controllers/tmsController');
const readOnlyDeptController = require('../controllers/readOnlyDeptController');
const accController = require('../controllers/accController'); 

// ==========================================
// 1. LUỒNG KHÁCH HÀNG (CUSTOMER)
// ==========================================
router.post('/', customerController.createOrder);
router.get('/customer', customerController.getCustomerOrders); 

// ==========================================
// 2. LUỒNG THỐNG KÊ & LOG CỦA PHÒNG OMS (Xếp lên trước :id)
// ==========================================
router.get('/oms/analytics/revenue', omsController.getRevenueReport);
router.get('/oms/analytics/customers', omsController.getCustomerAnalytics);
router.get('/:id/history', omsController.getOrderHistory); // Lấy lịch sử hành trình đơn

// ==========================================
// 3. CÁC ACTION CỤ THỂ THEO ID ĐƠN (Xếp lên TRƯỚC đường dẫn gốc /:id)
// ==========================================
router.put('/:id/return-order', omsController.returnOrder); // Hoàn trả đơn hàng về khách

// ⭐ BỔ SUNG CÁC ACTION CỦA PHÒNG KHO (WMS) VÀO ĐÂY ĐỂ TRÁNH TRÙNG ROUTE :id
router.put('/:id/location', wmsController.updateOrderLocation);   // Đổi vị trí ô kệ lưu trữ
router.put('/:id/condition', wmsController.updateCargoCondition); // Lập biên bản hư hại ngoại quan

// ==========================================
// 4. CÁC PHÒNG BAN LẤY DANH SÁCH ĐƠN HÀNG HÀNG LOẠT
// ==========================================
router.get('/oms', omsController.getOmsOrders);           
router.get('/wms', wmsController.getWmsOrders);           
router.get('/tms', tmsController.getTmsOrders);           
router.get('/docs', readOnlyDeptController.getDocsOrders); 

// ==========================================
// 5. CƠ CHẾ CẬP NHẬT TRẠNG THÁI CHUNG CHUNG (Xếp CUỐI cùng để không đè lên route khác)
// ==========================================
// Hàm này sẽ tự động tiếp nhận lệnh đóng gói 'PACKED' và chuyển sang 'TMS' từ WMSView.vue gửi lên
router.put('/:id', omsController.updateOrderStatus); // Duyệt đơn chuyển phòng ban

// ==========================================
// 6. ĐỊNH TUYẾN DÀNH RIÊNG CHO PHÒNG KẾ TOÁN (ACC)
// ==========================================
router.get('/acc/orders', accController.getAccOrders);           
router.put('/acc/:id/approve', accController.approvePayment);    

module.exports = router;