const express = require('express');
const router = express.Router();

// Import tất cả controllers
const orderController = require('../controllers/orderController');
const customerController = require('../controllers/customerController');
const omsController = require('../controllers/omsController');
const wmsController = require('../controllers/wmsController');
const tmsController = require('../controllers/tmsController');
const readOnlyDeptController = require('../controllers/readOnlyDeptController');

// 1. Tuyến đường Khách hàng (Customer)
router.post('/', customerController.createOrder); 
router.get('/customer', customerController.getCustomerOrders);

// 2. Tuyến đường dùng chung cho việc Chuyển tiếp / Cập nhật trạng thái
router.put('/:id', orderController.updateOrderStatus);

// 3. Tuyến đường lấy danh sách riêng của từng phòng ban
router.get('/oms', omsController.getOmsOrders);
router.get('/wms', wmsController.getWmsOrders);
router.get('/tms', tmsController.getTmsOrders);
router.get('/readonly', readOnlyDeptController.getReadOnlyOrders);

module.exports = router;