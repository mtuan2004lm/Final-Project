<template>
   <div class="dashboard-container">
     <div class="sidebar">
       <div class="brand">LOGISTICS PRO</div>
       <div class="user-info">
         <div class="avatar">{{ userRole.charAt(0) }}</div>
         <div>
            <h3>PHÒNG KHO ({{ userRole }})</h3>
            <small style="color: #2ecc71;">Trực tuyến vận hành</small>
         </div>
       </div>
       
       <div class="navigation-menu">
          <button @click="activeTab = 'inbound'" :class="{ active: activeTab === 'inbound' }" class="menu-btn">
             📥 1. Nhập Kho & Đăng Ký Kiện
          </button>
          <button @click="activeTab = 'locations'" :class="{ active: activeTab === 'locations' }" class="menu-btn">
             📍 2. Quản lý Vị trí Ô / Kệ
          </button>
          <button @click="activeTab = 'cargo_condition'" :class="{ active: activeTab === 'cargo_condition' }" class="menu-btn">
             ⚠️ 3. Báo cáo Hư hại & Ảnh Chụp
          </button>
          <button @click="activeTab = 'outbound'" :class="{ active: activeTab === 'outbound' }" class="menu-btn">
             📤 4. Xuất Kho & Bàn giao TMS
          </button>
          <button @click="switchToHistoryTab" :class="{ active: activeTab === 'warehouse_history' }" class="menu-btn" style="color: #f39c12;">
             📜 5. Nhật ký Nhập & Xuất Kho
          </button>
       </div>
  
       <button @click="logout" class="btn-logout">Đăng Xuất</button>
     </div>
  
     <div class="main-content">
       
        <div v-if="activeTab === 'inbound'">
           <header><h1>QUẢN LÝ THỦ TỤC NHẬP KHO VÀ ĐĂNG KÝ KIỆN HÀNG</h1></header>
 
           <div class="barcode-scanner-box">
              <div class="scanner-title">
                 <b>🔍 HỆ THỐNG XÁC THỰC NHẬP MÃ KIỆN HÀNG VÀO BÃI</b>
              </div>
              <div class="scanner-input-row">
                 <input type="text" v-model="barcodeInput" placeholder="Nhập mã kiểm kho hoặc mã kiện hàng vào đây (VD: PKG-60093)..." class="scanner-input" @keyup.enter="handleBarcodeScan" />
                 <button @click="handleBarcodeScan" class="btn-scan-trigger">⚡ Xác nhận mã nhập kho (Enter)</button>
              </div>
           </div>
 
           <div class="card list-card" style="margin-top: 25px;">
               <h3>📥 Danh sách tiếp nhận đơn hàng ký gửi mới</h3>
               <table class="data-table">
                   <thead>
                       <tr>
                         <th>Mã Kiện Hàng</th><th>Tên Khách Hàng</th><th>Thông Tin Hàng Hóa</th><th>Trạng Thái Nhập Bãi</th><th>Nhật ký nhanh</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders" :key="order.id" :class="{'row-scanned-active': order.id == highlightedOrderId}">
                           <td><b class="barcode-tag">PKG-600{{ order.id }}</b></td>
                           <td><b>{{ order.customer_name }}</b></td>
                           <td>{{ order.product_name }} (Số lượng: {{ order.quantity }})</td>
                           <td>
                              <span v-if="order.is_scanned" class="badge-status status-scanned">✓ Đã xác nhận vào kho</span>
                              <span v-else class="badge-status status-wait">⏳ Chờ nhập mã kiểm kho</span>
                           </td>
                           <td>
                             <button @click="openHistoryModal(order.id)" class="btn-action btn-history">📜 Xem Log</button>
                           </td>
                       </tr>
                       <tr v-if="orders.length === 0">
                           <td colspan="5" style="text-align: center; color: #7f8c8d; padding: 30px; font-style: italic;">Hiện tại không có kiện hàng nào chờ xử lý nhập bãi.</td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>
 
        <div v-if="activeTab === 'locations'">
           <header><h1>QUẢN LÝ SƠ ĐỒ VỊ TRÍ LƯU TRỮ TRÊN Ô / KỆ (PUT-AWAY)</h1></header>
           <div class="card list-card" style="margin-top: 25px;">
               <h3>📍 Chỉ định khu vực lưu trữ hàng hóa tạm thời</h3>
               <table class="data-table">
                   <thead>
                       <tr><th>Mã Kiện</th><th>Khách hàng</th><th>Sản phẩm</th><th>Vị trí hiện tại</th><th>Cập nhật khu vực lưu trữ mới (Aisle/Shelf)</th></tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders" :key="order.id">
                           <td><b class="barcode-tag">PKG-600{{ order.id }}</b></td>
                           <td>{{ order.customer_name }}</td>
                           <td>{{ order.product_name }}</td>
                           <td>
                              <span v-if="order.warehouse_location" class="location-badge">📍 {{ order.warehouse_location }}</span>
                              <span v-else style="color: #e64c3c; font-weight: bold;">🚨 Chưa phân kho</span>
                           </td>
                           <td>
                              <div style="display: flex; gap: 8px;">
                                 <select :id="'select-loc-' + order.id" class="form-select-custom">
                                    <option value="Khu A - Kệ 01 - Tầng 2">Khu A - Kệ 01 - Tầng 2 (Hàng nhẹ)</option>
                                    <option value="Khu B - Kệ 05 - Tầng 1">Khu B - Kệ 05 - Tầng 1 (Hàng nặng/Pallet)</option>
                                    <option value="Khu C - Ô biệt trữ 12">Khu C - Ô biệt trữ 12 (Giá trị cao)</option>
                                    <option value="Khu VIP - Gần cửa xuất">Khu VIP - Gần cửa xuất (Đi nhanh)</option>
                                 </select>
                                 <button @click="updateLocation(order.id)" class="btn-action btn-ok">Gán vị trí</button>
                              </div>
                           </td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>
 
        <div v-if="activeTab === 'cargo_condition'">
           <header><h1>BIÊN BẢN KHẢO SÁT NGOẠI QUAN & BÁO CÁO HƯ HẠI (CARGO CONDITION)</h1></header>
           <div class="card list-card" style="margin-top: 25px;">
               <h3>⚠️ Ghi nhận tình trạng móp méo, rách bao bì và tải minh chứng thực tế</h3>
               <table class="data-table">
                   <thead>
                       <tr><th>Mã Kiện</th><th>Khách hàng</th><th>Tình trạng ngoại quan</th><th>Minh chứng hình ảnh</th><th>Thao tác lập biên bản</th></tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders" :key="order.id">
                           <td><b class="barcode-tag">PKG-600{{ order.id }}</b></td>
                           <td>{{ order.customer_name }}</td>
                           <td>
                              <span v-if="order.cargo_condition" class="condition-text-alert">⚠️ {{ order.cargo_condition }}</span>
                              <span v-else style="color: #27ae60; font-weight: bold;">✓ Nguyên đai nguyên kiện</span>
                           </td>
                           <td>
                              <div v-if="order.cargo_image">
                                 <img :src="'http://localhost:3000' + order.cargo_image" alt="Minh chứng lỗi" style="width: 100px; height: auto; border-radius: 4px; border: 1px solid #ddd; margin-top: 5px; display: block;" />
                                 <small style="color: #2980b9; font-weight: bold;">📸 Đã cập nhật ảnh</small>
                              </div>
                              <span v-else style="color: #95a5a6; font-style: italic;">Chưa có ảnh chụp</span>
                           </td>
                           <td>
                              <div style="display: flex; flex-direction: column; gap: 6px;">
                                 <textarea :id="'textarea-cond-' + order.id" class="form-textarea-custom" rows="2" placeholder="Nhập mô tả chi tiết hư hại ngoại quan..."></textarea>
                                 
                                 <input type="file" :id="'file-image-' + order.id" accept="image/*" style="font-size: 12px; margin-top: 4px;" />
                                 
                                 <button @click="submitConditionReport(order.id)" class="btn-action" style="background: #e74c3c; color: white; margin-top: 4px;">
                                    🚨 Xác nhận lỗi & Tải biên bản lên
                                 </button>
                              </div>
                           </td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>
 
        <div v-if="activeTab === 'outbound'">
           <header><h1>QUY TRÌNH XUẤT KHO VÀ ĐIỀU ĐỘ BÀN GIAO TIẾP TỤC CHO PHÒNG TMS</h1></header>
           
           <div class="card list-card" style="margin-top: 25px;">
               <h3>📤 Điều phối bàn giao hàng hóa hạ bãi sang đội xe vận tải</h3>
               <table class="data-table">
                   <thead>
                       <tr>
                         <th>Mã Kiện Hàng</th><th>Khách hàng</th><th>Sản phẩm tải trọng</th><th>Vị Trí Đang Lưu</th><th>Điều kiện bàn giao</th><th>Hành động xuất kho</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders" :key="order.id">
                           <td><b class="barcode-tag">PKG-600{{ order.id }}</b></td>
                           <td><b>{{ order.customer_name }}</b></td>
                           <td>{{ order.product_name }}</td>
                           <td>
                              <span v-if="order.warehouse_location" class="location-badge">📍 {{ order.warehouse_location }}</span>
                              <span style="color: #e64c3c; font-weight: bold;" v-else>🚨 Lỗi: Chưa phân kệ</span>
                           </td>
                           <td>
                              <span v-if="order.is_scanned" class="badge-status status-scanned">✓ Đủ điều kiện xuất bến</span>
                              <span v-else class="badge-status status-wait">❌ Chưa nhập mã kiểm kho</span>
                           </td>
                           <td>
                             <button @click="packOrder(order.id, order.is_scanned)" class="btn-action btn-ok" :disabled="!order.is_scanned" :style="{ opacity: order.is_scanned ? 1 : 0.5, cursor: order.is_scanned ? 'pointer' : 'not-allowed' }">
                                🚛 Bàn giao xe tải (TMS)
                             </button>
                           </td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>
 
        <div v-if="activeTab === 'warehouse_history'">
           <header><h1>📜 SỔ CÁI NHẬT KÝ LỊCH SỬ NHẬP KHO & XUẤT KHO (WMS LOGS)</h1></header>
           <div class="card list-card" style="margin-top: 25px;">
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                  <h3>Tổng hợp dòng thời gian vận hành điều độ tại Kho</h3>
                  <button @click="fetchGlobalWarehouseLogs" class="btn-action" style="background: #27ae60; color: white;">🔄 Làm mới nhật ký</button>
               </div>
               
               <div v-if="loadingHistory" class="loading-text">⏳ Đang truy xuất dữ liệu vận hành từ cơ sở dữ liệu...</div>
               
               <table v-else class="data-table">
                   <thead>
                       <tr>
                          <th style="width: 100px;">Mã Đơn</th>
                          <th style="width: 180px;">Mốc Thời Gian</th>
                          <th style="width: 150px;">Hành Trình Chuyển</th>
                          <th>Nội Dung Chi Tiết Sự Kiện Vận Hành Kho</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="(log, idx) in globalWarehouseLogs" :key="idx">
                           <td><b class="barcode-tag">PKG-600{{ log.order_id }}</b></td>
                           <td><small style="color: #7f8c8d; font-weight: bold;">⏰ {{ formatTime(log.changed_at) }}</small></td>
                           <td><span class="dept-tag">{{ log.old_status }} ➔ {{ log.new_status }}</span></td>
                           <td><div style="font-size: 13.5px; color: #2c3e50; line-height: 1.4;">{{ log.notes }}</div></td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>
 
     </div>
 
     <div v-if="showHistoryModal" class="modal-overlay" @click="showHistoryModal = false">
       <div class="modal-content-box" @click.stop>
          <div class="modal-header">
             <h2>📜 Nhật Ký Hành Trình Đơn Hàng #{{ selectedOrderId }}</h2>
             <button class="close-btn" @click="showHistoryModal = false">×</button>
          </div>
          <div class="modal-body">
             <div v-if="loadingHistory" class="loading-text">⏳ Đang lấy dữ liệu...</div>
             <div v-else class="timeline-wrapper">
                 <div class="timeline-item" v-for="(log, index) in orderHistory" :key="index">
                     <div class="timeline-badge-circle"></div>
                     <div class="timeline-content-card">
                         <div class="time-stamp">⏰ {{ formatTime(log.changed_at) }}</div>
                         <div class="log-status-row">Hành trình: <span class="dept-tag">{{ log.old_status }} ➔ {{ log.new_status }}</span></div>
                         <div class="log-notes" v-if="log.notes">📝 {{ log.notes }}</div>
                     </div>
                 </div>
             </div>
          </div>
       </div>
     </div>
 
   </div>
 </template>
  
 <script setup>
 import { ref, onMounted, onUnmounted } from 'vue';
 import axios from 'axios';
 import { useRouter } from 'vue-router';
   
 const router = useRouter();
 const userRole = ref('WMS');
 const activeTab = ref('inbound'); // Thay đổi tab mặc định ban đầu thành inbound
   
 const orders = ref([]);
 const barcodeInput = ref('');
 const highlightedOrderId = ref(null);
 let wmsInterval = null;
 
 const showHistoryModal = ref(false);
 const selectedOrderId = ref(null);
 const orderHistory = ref([]);
 const globalWarehouseLogs = ref([]); 
 const loadingHistory = ref(false);
   
 const fetchOrders = async () => {
   try {
     const res = await axios.get('http://localhost:3000/api/orders/wms');
     orders.value = res.data;
   } catch (error) {
     console.error("Lỗi đồng bộ dữ liệu phòng WMS:", error);
   }
 };
 
 const fetchGlobalWarehouseLogs = async () => {
    loadingHistory.value = true;
    try {
       const res = await axios.get('http://localhost:3000/api/orders/wms/all/logs');
       globalWarehouseLogs.value = res.data;
    } catch (err) {
       console.error("Lỗi truy xuất lịch sử tổng hợp kho:", err);
    } finally {
       loadingHistory.value = false;
    }
 };
 
 const switchToHistoryTab = () => {
    activeTab.value = 'warehouse_history';
    fetchGlobalWarehouseLogs();
 };
   
 const handleBarcodeScan = async () => {
    const input = barcodeInput.value.trim().toUpperCase();
    if (!input) return;
    
    let matchedId = null;
    if (input.startsWith('PKG-600')) { matchedId = input.replace('PKG-600', ''); } 
    else { matchedId = input; }
    
    const targetOrder = orders.value.find(o => o.id == matchedId);
    if (!targetOrder) {
        alert(`❌ Mã số "${input}" không trùng khớp với kiện hàng nào đang chờ tiếp nhận!`);
        barcodeInput.value = '';
        return;
    }
    
    try {
        await axios.put(`http://localhost:3000/api/orders/wms/${targetOrder.id}/scan-barcode`);
        highlightedOrderId.value = targetOrder.id;
        barcodeInput.value = '';
        fetchOrders();
        setTimeout(() => { highlightedOrderId.value = null; }, 4000);
    } catch (err) {
        alert("Lỗi đồng bộ dữ liệu kiểm tra mã!");
    }
 };
   
 // HÀM XUẤT KHO BÀN GIAO SANG ĐỘI XE TẢI (TMS)
 const packOrder = async (orderId, isScanned) => {
   if (!isScanned) return alert("Ngăn chặn nghiệp vụ: Kiện hàng này chưa được nhập mã đăng ký bãi đầu vào!");
   
   try {
     await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
       status: 'PACKED',
       current_dept: 'TMS',
       from_dept: 'WMS',
       notes: 'Hệ thống xác nhận: Đã hoàn tất đóng gói, làm thủ tục xuất bến hạ bãi và bàn giao trách nhiệm thành công sang phòng vận tải xe tải TMS.'
     });
     alert("🚀 Đã hoàn tất thủ tục xuất kho và điều phối bàn giao sang Đội xe vận tải (TMS) thành công!");
     fetchOrders();
   } catch (error) {
     alert("Thao tác điều phối xuất kho thất bại!");
   }
 };
   
 const updateLocation = async (orderId) => {
    const selectEl = document.getElementById(`select-loc-${orderId}`);
    const locationVal = selectEl ? selectEl.value : '';
    try {
        await axios.put(`http://localhost:3000/api/orders/${orderId}/location`, { location: locationVal });
        alert("Hệ thống đã lưu thông tin chỉ định ô kệ lưu trữ thành công!");
        fetchOrders();
    } catch (err) {
        alert("Không thể gán vị trí chứa hàng!");
    }
 };
   
 // CẬP NHẬT BÁO CÁO HƯ HẠI: CHUYỂN SANG DÙNG FORMDATA ĐỂ GỬI ĐƯỢC FILE ẢNH
 const submitConditionReport = async (orderId) => {
    const textareaEl = document.getElementById(`textarea-cond-${orderId}`);
    const fileInputEl = document.getElementById(`file-image-${orderId}`);
    
    const conditionVal = textareaEl ? textareaEl.value.trim() : '';
    if (!conditionVal) return alert("Vui lòng điền nội dung biên bản mô tả lỗi hư hại!");
    
    // Tạo đối tượng FormData để gói File ảnh và Text gửi đi cùng lúc
    const formData = new FormData();
    formData.append('condition', conditionVal);
    if (fileInputEl && fileInputEl.files[0]) {
        formData.append('cargo_image', fileInputEl.files[0]); // Trùng tên field cấu hình ở multer backend
    }
    
    try {
        await axios.put(`http://localhost:3000/api/orders/${orderId}/condition`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data' // Bắt buộc khi up file
            }
        });
        alert("Biên bản ghi nhận lỗi kèm ảnh chụp bằng chứng đã lập thành công!");
        if (textareaEl) textareaEl.value = '';
        if (fileInputEl) fileInputEl.value = ''; // Reset input file
        fetchOrders();
    } catch (err) {
        alert("Không thể lập báo cáo biên bản hư hại ngoại quan!");
    }
 };
 
 const openHistoryModal = async (orderId) => {
    selectedOrderId.value = orderId;
    showHistoryModal.value = true;
    loadingHistory.value = true;
    try {
       const res = await axios.get(`http://localhost:3000/api/orders/${orderId}/history`);
       orderHistory.value = res.data;
    } catch (err) {
       console.error(err);
    } finally {
       loadingHistory.value = false;
    }
 };
 
 const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const d = new Date(timeStr);
    return d.toLocaleString('vi-VN');
 };
   
 onMounted(() => {
   if (!localStorage.getItem('role')) {
     router.push('/');
   } else {
     fetchOrders();
     wmsInterval = setInterval(() => {
        fetchOrders();
        if (activeTab.value === 'warehouse_history') {
           axios.get('http://localhost:3000/api/orders/wms/all/logs').then(res => globalWarehouseLogs.value = res.data);
        }
     }, 5000);
   }
 });
   
 onUnmounted(() => { if (wmsInterval) clearInterval(wmsInterval); });
 const logout = () => { localStorage.clear(); router.push('/'); };
 </script>
  
 <style scoped>
 /* Toàn bộ CSS cũ của bạn được giữ nguyên vẹn nhằm giữ layout chuẩn */
 .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
 .sidebar { width: 240px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; box-sizing: border-box;}
 .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; }
 .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid #34495e; margin-bottom: 20px; }
 .avatar { width: 40px; height: 40px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
 .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
 .main-content { flex: 1; padding: 30px; overflow-y: auto; background: #fff;}
 .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f5;}
 .navigation-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 10px;}
 .menu-btn { padding: 12px 15px; background: none; border: none; color: #b2bec3; text-align: left; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; transition: all 0.2s;}
 .menu-btn:hover, .menu-btn.active { background: #34495e; color: #fff; }
 header h1 { font-size: 22px; font-weight: 800; color: #2c3e50; margin: 0 0 25px 0; }
 .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
 .data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 14px;}
 .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase;}
 .barcode-tag { font-family: monospace; background: #2d3436; color: #fff; padding: 3px 6px; border-radius: 3px; font-size: 13px; }
 .location-badge { background: #e3f2fd; color: #0d47a1; font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 12px;}
 .condition-text-alert { color: #c0392b; font-weight: 600; font-size: 13px; display: inline-block;}
 .badge-status { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; display: inline-block; }
 .status-wait { background: #ffeaa7; color: #d63031; }
 .status-scanned { background: #e8f5e9; color: #2e7d32; }
 .action-cell { display: flex; gap: 8px; }
 .btn-action { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;}
 .btn-ok { background: #2980b9; color: white; }
 .btn-history { background: #34495e; color: white; }
 .barcode-scanner-box { background: #f8f9fa; border: 2px dashed #bdc3c7; border-radius: 6px; padding: 15px 20px;}
 .scanner-title { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #2c3e50; margin-bottom: 10px;}
 .scanner-input-row { display: flex; gap: 10px;}
 .scanner-input { flex: 1; padding: 10px; border: 1px solid #bdc3c7; border-radius: 4px; font-family: monospace; font-size: 14px;}
 .btn-scan-trigger { background: #e67e22; color: white; border: none; padding: 0 15px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px;}
 .row-scanned-active { background-color: #f1f9f5 !important; animation: highlightFade 4s ease-out; }
 @keyframes highlightFade { from { background-color: #d4edda; } to { background-color: #fff; } }
 .form-select-custom, .form-textarea-custom { width: 100%; padding: 10px; border: 1px solid #bdc3c7; border-radius: 4px; box-sizing: border-box; font-size: 14px; margin-top: 5px;}
 .form-textarea-custom { font-family: sans-serif; resize: none;}
 .dept-tag { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #475569; }
 .log-notes { background: #fff5f5; color: #c0392b; padding: 10px; border-radius: 4px; font-size: 13px; border-left: 4px solid #e74c3c; margin-top: 8px; font-weight: 500; }
 .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
 .modal-content-box { background: white; width: 500px; max-height: 80vh; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }
 .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #2c3e50; color: white; }
 .modal-header h2 { font-size: 15px; margin: 0; font-weight: 700; letter-spacing: 0.5px; }
 .close-btn { background: none; border: none; color: white; font-size: 26px; cursor: pointer; line-height: 1; }
 .modal-body { padding: 25px; overflow-y: auto; background: #fdfefe; }
 .timeline-wrapper { position: relative; border-left: 2px solid #34495e; margin-left: 15px; padding-left: 25px; display: flex; flex-direction: column; gap: 20px; }
 .timeline-item { position: relative; }
 .timeline-badge-circle { position: absolute; left: -31px; top: 5px; width: 10px; height: 10px; background: #e67e22; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 2px #34495e; }
 .timeline-content-card { background: #f8f9fa; padding: 12px 16px; border-radius: 4px; border: 1px solid #e2e8f0; }
 .time-stamp { font-size: 11px; color: #7f8c8d; font-weight: bold; margin-bottom: 5px; }
 .log-status-row { font-size: 13px; color: #2c3e50; font-weight: bold; }
 .loading-text { text-align: center; color: #7f8c8d; font-style: italic; padding: 20px 0; }
 </style>