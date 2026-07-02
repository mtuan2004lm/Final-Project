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
             📜 5. Nhật ký xuất nhập kho
          </button>
       </div>
 
       <button @click="logout" class="btn-logout">Đăng Xuất</button>
     </div>
 
     <div class="main-content">
       <div v-if="activeTab === 'inbound'">
          <header>
             <h1>QUẢN LÝ TIẾP NHẬN HÀNG HÓA NHẬP BÃI TRUNG CHUYỂN</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Hình Ảnh Đơn Hàng</th>
                      <th>Tên Mặt Hàng</th>
                      <th>Số Lượng</th>
                      <th>Bộ Phận Hiện Tại</th>
                      <th>Trạng Thái Vận Hành</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <img :src="getImageUrl(order.cargo_image || order.product_image)" class="table-img-preview" alt="Ảnh hàng hóa" />
                      </td>
                      <td><b>{{ order.product_name }}</b><br><small style="color: #7f8c8d;">Chủ hàng: {{ order.customer_name }}</small></td>
                      <td>{{ order.quantity }} kiện</td>
                      <td><span class="dept-badge wms">{{ order.current_dept }}</span></td>
                      <td><span class="status-badge process">🏬 CHỜ XỬ LÝ KHO</span></td>
                   </tr>
                   <tr v-if="wmsOrders.length === 0">
                      <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Hiện tại không có kiện hàng nào đang đợi nhập bãi.</td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
 
       <div v-if="activeTab === 'locations'">
          <header>
             <h1>HỆ THỐNG SẮP XẾP ĐỊNH VỊ VỊ TRÍ Ô / KỆ LƯU KHO</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Ảnh Hiện Tại</th>
                      <th>Mặt Hàng</th>
                      <th>Vị Trí Hiện Tại</th>
                      <th>Tọa Độ Ô / Kệ Mới</th>
                      <th>Hành Động</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <img :src="getImageUrl(order.cargo_image || order.product_image)" class="table-img-preview" />
                      </td>
                      <td>{{ order.product_name }}</td>
                      <td>
                         <span v-if="order.warehouse_location" class="location-tag">📍 {{ order.warehouse_location }}</span>
                         <span v-else style="color: #e74c3c; font-style: italic;">⚠️ Chưa xếp kệ</span>
                      </td>
                      <td>
                        <select v-model="locationInputs[order.id]" class="table-input">
                            <option value="" disabled>-- Chọn Ô / Kệ lưu trữ --</option>
                            <option value="Khu A - Kệ 01 (Hàng Thường)">Khu A - Kệ 01 (Hàng Thường)</option>
                            <option value="Khu A - Kệ 02 (Hàng Thường)">Khu A - Kệ 02 (Hàng Thường)</option>
                            <option value="Khu B - Kệ 01 (Hàng Nặng/Cồng kềnh)">Khu B - Kệ 01 (Hàng Nặng/Cồng kềnh)</option>
                            <option value="Khu C - Kệ Lạnh (Nhiệt độ thấp)">Khu C - Kệ Lạnh (Nhiệt độ thấp)</option>
                            <option value="Khu D - Kệ Hàng Dễ Vỡ (VIP)">Khu D - Kệ Hàng Dễ Vỡ (VIP)</option>
                            <option value="Khu E - Kệ Hàng đi nhanh (VIP)">Khu E - Kệ Hàng giao gấp (VVIP)</option>
                        </select>
                      </td>
                      <td>
                         <button @click="updateLocation(order.id)" class="btn-action-cyan">🎯 Lưu vị trí</button>
                      </td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
 
       <div v-if="activeTab === 'cargo_condition'">
          <header>
             <h1>BÁO CÁO ĐÁNH GIÁ NGOẠI QUAN & HƯ HẠI KIỂM KHO</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Ảnh Gốc (OMS)</th>
                      <th>Ảnh Hư Hại (WMS)</th>
                      <th>Mặt Hàng</th>
                      <th>Biên Bản Tình Trạng Hiện Tại</th>
                      <th>Cập Nhật Tình Trạng & Tải Ảnh Mới Tại Kho</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      
                      <td>
                         <img :src="getImageUrl(order.product_image)" class="table-img-preview" alt="Ảnh gốc" />
                      </td>

                      <td>
                         <img v-if="order.damage_image" :src="getImageUrl(order.damage_image)" class="table-img-preview" style="border: 2px solid #e74c3c;" alt="Ảnh hư hại" />
                         <span v-else style="color: #95a5a6; font-size: 12px; font-style: italic;">Chưa ghi nhận</span>
                      </td>

                      <td>{{ order.product_name }}</td>
                      <td>
                         <p class="condition-text" v-if="order.cargo_condition">💬 {{ order.cargo_condition }}</p>
                         <span v-else style="color: #27ae60; font-weight: bold;">💚 Hàng nguyên đai nguyên kiện</span>
                      </td>
                      <td>
                         <div class="report-box-grid">
                            <input type="text" v-model="conditionInputs[order.id]" placeholder="Mô tả hư hại nếu có..." class="table-input" />
                            <input type="file" @change="onFileChange($event, order.id)" accept="image/*" class="mini-file-input" />
                            <button @click="submitConditionReport(order.id)" class="btn-action-orange">⚠️ Gửi biên bản</button>
                         </div>
                      </td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
 
       <div v-if="activeTab === 'outbound'">
          <header>
             <h1>PHÊ DUYỆT XUẤT KHO TRUNG CHUYỂN BÀN GIAO ĐỘI XE TMS</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Ảnh Bàn Giao</th>
                      <th>Mặt Hàng</th>
                      <th>Vị Trí Lưu Kho</th>
                      <th>Tình Trạng & Quét Mã</th>
                      <th>Lệnh Vận Hành</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <img :src="getImageUrl(order.cargo_image || order.product_image)" class="table-img-preview" />
                      </td>
                      <td><b>{{ order.product_name }}</b></td>
                      <td><span class="location-tag">📍 {{ order.warehouse_location || 'Kho chung' }}</span></td>
                      <td>
                         <div style="margin-bottom: 6px;">
                            <span v-if="order.cargo_condition" style="color: #e67e22; font-size: 13px;">⚠️ {{ order.cargo_condition }}</span>
                            <span v-else style="color: #27ae60; font-size: 13px;">💚 Bình thường</span>
                         </div>
                         <div>
                            <span v-if="order.is_scanned" style="color: #2ecc71; font-size: 12px; font-weight: bold;">✔️ Đã quét mã kiện</span>
                            <span v-else style="color: #e74c3c; font-size: 12px; font-weight: bold;">❌ Chưa quét mã kiện</span>
                         </div>
                      </td>
                      <td>
                         <div style="display: flex; flex-direction: column; gap: 6px;">
                            <button v-if="!order.is_scanned" @click="scanOrder(order.id)" class="btn-action-blue">🔍 Quét Xác Nhận Đơn</button>
                            
                            <button 
                               @click="releaseToTms(order.id)" 
                               :disabled="!order.is_scanned" 
                               :class="{ 'btn-disabled': !order.is_scanned }" 
                               class="btn-action-green"
                            >
                               📤 Xuất kho & Giao TMS
                            </button>
                         </div>
                      </td>
                   </tr>
                   <tr v-if="wmsOrders.length === 0">
                      <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Hiện tại không có kiện hàng nào.</td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
 
       <div v-if="activeTab === 'warehouse_history'">
          <header>
             <h1>📜 NHẬT KÝ BIẾN ĐỘNG XUẤT NHẬP KHO TOÀN CẦU</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Hành Trình Ghi Nhận</th>
                      <th>Trạng Thái Cũ</th>
                      <th>Trạng Thái Mới</th>
                      <th>Thời Gian Biến Động</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="(log, idx) in warehouseLogs" :key="idx">
                      <td><b class="order-id-tag">{{ formatOrderId(log.order_id) }}</b></td>
                      <td><span class="log-notes-txt">{{ log.notes }}</span></td>
                      <td><span class="status-badge-old">{{ log.old_status }}</span></td>
                      <td><span class="status-badge-new">{{ log.new_status }}</span></td>
                      <td style="color: #7f8c8d; font-size: 13px;">{{ formatDate(log.changed_at) }}</td>
                   </tr>
                   <tr v-if="warehouseLogs.length === 0">
                      <td colspan="5" style="text-align: center; color: #95a5a6; padding: 20px;">Chưa ghi nhận nhật ký xuất nhập kho nào trong ca làm việc.</td>
                   </tr>
                </tbody>
             </table>
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
const userRole = ref(localStorage.getItem('role') || 'WMS_STAFF');
const activeTab = ref('inbound');
 
const wmsOrders = ref([]);
const warehouseLogs = ref([]);
 
const locationInputs = ref({});
const conditionInputs = ref({});
const fileInputs = ref({}); 
 
let wmsInterval = null;

const formatOrderId = (id) => {
   if (!id) return '';
   return `PKG-${60000 + Number(id)}`;
};
 
const getImageUrl = (path) => {
   if (!path) return 'https://placehold.co/60x45?text=No+Image';
   return `http://localhost:3000${path}`;
};
 
const fetchWmsOrders = async () => {
   try {
      const res = await axios.get('http://localhost:3000/api/orders/wms');
      wmsOrders.value = res.data;
   } catch (err) {
      console.error("Lỗi đồng bộ dữ liệu WMS:", err);
   }
};
 
const fetchWarehouseLogs = async () => {
   try {
      const res = await axios.get('http://localhost:3000/api/orders/wms/logs');
      warehouseLogs.value = res.data;
   } catch (err) {
      console.error("Lỗi đồng bộ nhật ký kho:", err);
   }
};
 
const switchToHistoryTab = () => {
   activeTab.value = 'warehouse_history';
   fetchWarehouseLogs(); 
};

// ĐÃ SỬA CHUẨN: Đổi từ đuôi /scan thành /scan-barcode để gọi đúng API Node.js
const scanOrder = async (id) => {
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/scan-barcode`);
      alert("⚡ Xác nhận quét mã kiện hàng nhập bãi thành công!");
      fetchWmsOrders(); 
   } catch (err) {
      console.error(err);
      alert("Lỗi hệ thống khi quét mã kiện hàng!");
   }
};
 
const updateLocation = async (id) => {
   const loc = locationInputs.value[id];
   if (!loc || loc.trim() === '') {
      alert("⚠️ Vui lòng chọn vị trí Ô / Kệ trước khi xác nhận lưu vị trí!");
      return;
   }
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/location`, { warehouse_location: loc });
      alert("🎯 Xác nhận định vị sắp xếp kiện hàng vào vị trí thành công!");
      fetchWmsOrders();
   } catch (err) {
      alert("Lỗi cập nhật vị trí kho bãi!");
   }
};
 
const onFileChange = (event, id) => {
   if (event.target.files && event.target.files[0]) {
      fileInputs.value[id] = event.target.files[0];
   }
};
 
const submitConditionReport = async (id) => {
   const txt = conditionInputs.value[id] || 'Bình thường';
   const file = fileInputs.value[id];
 
   const formData = new FormData();
   formData.append('cargo_condition', txt);
   if (file) {
      formData.append('cargo_image', file);
   }
 
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/condition`, formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert("⚠️ Gửi biên bản giám định bất thường ngoại quan thành công!");
      conditionInputs.value[id] = '';
      delete fileInputs.value[id];
      fetchWmsOrders();
   } catch (err) {
      alert("Lỗi gửi biên bản kiểm định hàng hóa hư hại!");
   }
};
 
const releaseToTms = async (id) => {
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/release`);
      alert("📤 Đã phê duyệt lệnh xuất bãi, ký gửi hồ sơ bàn giao phòng Đội Xe TMS!");
      fetchWmsOrders();
   } catch (err) {
      alert("Thao tác xuất kho thất bại!");
   }
};
 
const formatDate = (dateStr) => {
   if (!dateStr) return '';
   const d = new Date(dateStr);
   return d.toLocaleString('vi-VN');
};
 
const logout = () => {
   localStorage.clear();
   router.push('/');
};
 
onMounted(() => {
   if (localStorage.getItem('role') !== 'WMS') {
      router.push('/');
   } else {
      fetchWmsOrders();
      wmsInterval = setInterval(() => {
         fetchWmsOrders();
         if (activeTab.value === 'warehouse_history') {
            fetchWarehouseLogs();
         }
      }, 5000);
   }
});
 
onUnmounted(() => {
   if (wmsInterval) clearInterval(wmsInterval);
});
</script>
 
<style scoped>
.dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f4f6f9; }
.sidebar { width: 260px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; flex-shrink: 0; }
.brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; color: #ecf0f1; letter-spacing: 0.5px; }
.user-info { display: flex; align-items: center; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid #34495e; margin-bottom: 25px; }
.avatar { width: 45px; height: 45px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 16px; }
.navigation-menu { display: flex; flex-direction: column; gap: 10px; }
.menu-btn { padding: 12px 15px; text-align: left; background: none; border: none; color: #bdc3c7; font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 13px; transition: 0.2s; }
.menu-btn:hover, .menu-btn.active { background: #1a252f; color: white; border-left: 4px solid #e67e22; padding-left: 11px; }
.btn-logout { margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
 
.main-content { flex: 1; padding: 30px; overflow-y: auto; }
header h1 { font-size: 22px; font-weight: 800; color: #2c3e50; margin-bottom: 25px; border-left: 5px solid #e67e22; padding-left: 12px; text-transform: uppercase; }
.card { background: white; padding: 25px; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
 
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
.data-table th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
.order-id-tag { background: #e2e8f0; color: #4a5568; padding: 3px 6px; border-radius: 4px; font-family: monospace; }
.table-img-preview { width: 75px; height: 55px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; background-color: #f8fafc; }
.dept-badge { font-size: 11px; font-weight: bold; padding: 3px 6px; border-radius: 4px; }
.dept-badge.wms { background: #fef3c7; color: #d97706; }
.status-badge { font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
.status-badge.process { background: #e0f2fe; color: #0369a1; }
 
.location-tag { background: #ecfdf5; color: #065f46; font-weight: bold; padding: 4px 8px; border-radius: 4px; border: 1px solid #a7f3d0; font-size: 13px; }
.table-input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; width: 160px; }
.mini-file-input { font-size: 11px; color: #7f8c8d; max-width: 150px; }
.report-box-grid { display: flex; flex-direction: column; gap: 6px; max-width: 220px; }
.condition-text { margin: 0; font-size: 13px; color: #d35400; font-style: italic; font-weight: 500; }
 
.btn-action-cyan { background: #16a085; color: white; border: none; padding: 8px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; }
.btn-action-orange { background: #e67e22; color: white; border: none; padding: 8px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; }
.btn-action-green { background: #27ae60; color: white; border: none; padding: 10px 16px; font-weight: bold; font-size: 13px; border-radius: 4px; cursor: pointer; width: 100%; }
 
.btn-action-blue { background: #3498db; color: white; border: none; padding: 8px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; width: 100%; text-align: center; }
.btn-action-blue:hover { background: #2980b9; }
.btn-disabled { background: #cbd5e1 !important; color: #94a3b8 !important; cursor: not-allowed !important; }
 
.log-notes-txt { color: #2c3e50; font-weight: 500; font-size: 13px; display: block; max-width: 400px; line-height: 1.4; }
.status-badge-old { background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace; }
.status-badge-new { background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace; font-weight: bold; }
</style>

