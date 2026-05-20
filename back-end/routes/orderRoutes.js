const express = require('express');
const router = express.Router();

const customerController = require('../controllers/customerController');
const omsController = require('../controllers/omsController');
const wmsController = require('../controllers/wmsController');
const tmsController = require('../controllers/tmsController');
const readOnlyDeptController = require('../controllers/readOnlyDeptController');
const accController = require('../controllers/accController'); // 1. Nhúng Controller Kế toán vào đây

// 1. Khách hàng: Tạo đơn mới (POST /api/orders)
router.post('/', customerController.createOrder); //

// Khách hàng lấy danh sách đơn của chính mình (GET /api/orders/customer)
router.get('/customer', customerController.getCustomerOrders);  //

// 2. Các phòng ban lấy đơn theo luồng xử lý
router.get('/oms', omsController.getOmsOrders);            //
router.get('/wms', wmsController.getWmsOrders);            //
router.get('/tms', tmsController.getTmsOrders);            //
router.get('/docs', readOnlyDeptController.getDocsOrders);  //

// 3. ĐỊNH TUYẾN DÀNH RIÊNG CHO PHÒNG KẾ TOÁN (Đồng bộ khớp hoàn toàn với AccView.vue)
router.get('/acc/orders', accController.getAccOrders);            // Lấy danh sách đơn chờ duyệt tiền
router.put('/acc/:id/approve', accController.approvePayment);     // Kế toán bấm nút duyệt tiền

module.exports = router; //