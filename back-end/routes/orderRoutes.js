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

const customerController = require('../controllers/customerController');
const omsController = require('../controllers/omsController');
const wmsController = require('../controllers/wmsController');
const tmsController = require('../controllers/tmsController');
const readOnlyDeptController = require('../controllers/readOnlyDeptController');
const accController = require('../controllers/accController'); 

// THUẬT TOÁN BỌC THÉP: BẢO VỆ SERVER KHÔNG BAO GIỜ BỊ CRASH NẾU THIẾU HÀM
const safe = (fn) => {
    if (typeof fn === 'function') return fn;
    return (req, res) => res.status(500).json({ error: "API này đang được cập nhật hoặc khai báo thiếu trong Controller!" });
};

// 1. LUỒNG KHÁCH HÀNG
router.post('/', upload.single('product_image'), safe(customerController.createOrder));
router.get('/customer', safe(customerController.getCustomerOrders)); 

// 2. LUỒNG ĐIỀU PHỐI OMS (Đã thêm lại Analytics để tránh lỗi 404 mất biểu đồ)
router.get('/oms/analytics/revenue', safe(omsController.getRevenueReport));
router.get('/oms_analytics/revenue', safe(omsController.getRevenueReport));
router.get('/oms/analytics/customers', safe(omsController.getCustomerAnalytics));
router.get('/oms_analytics/customers', safe(omsController.getCustomerAnalytics));

router.put('/:id/return-order', safe(omsController.returnOrderToCustomer)); 
router.get('/history/:id', safe(omsController.getOrderHistory));

// 3. LUỒNG KHO BÃI WMS
router.put('/wms/:id/assign', safe(wmsController.assignWarehouseSlot));

// 4. LUỒNG VẬN TẢI TMS
router.get('/tms/fleet', safe(tmsController.getTruckFleet));                      
router.put('/tms/:id/assign', safe(tmsController.assignDeliveryRoute));            
router.put('/tms/:id/pod-submit', safe(tmsController.submitDriverPod));            

// 5. LUỒNG KẾ TOÁN ACC
router.get('/acc/orders', safe(accController.getAccOrders));           
router.put('/acc/:id/approve', safe(accController.approvePayment));    

// 6. LẤY DANH SÁCH THEO PHÒNG BAN
router.get('/oms', safe(omsController.getOmsOrders));           
router.get('/wms', safe(wmsController.getWmsOrders));           
router.get('/tms', safe(tmsController.getTmsOrders));           
router.get('/docs', safe(readOnlyDeptController.getDocsOrders)); 
router.put('/docs/:id/lock', safe(readOnlyDeptController.lockArchiveFile));

// 7. CẬP NHẬT CHUNG
router.put('/:id', safe(omsController.updateOrderStatus)); 

module.exports = router;