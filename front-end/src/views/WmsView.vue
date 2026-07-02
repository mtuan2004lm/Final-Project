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
          <header><h1>QUẢN LÝ TIẾP NHẬN HÀNG HÓA NHẬP BÃI</h1></header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Ảnh Gốc</th>
                      <th>Tên Mặt Hàng</th>
                      <th>Số Lượng</th>
                      <th>Trạng Thái</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td><img :src="getImageUrl(order.product_image)" class="table-img-preview" /></td>
                      <td><b>{{ order.product_name }}</b><br><small>KH: {{ order.customer_name }}</small></td>
                      <td>{{ order.quantity }} kiện</td>
                      <td><span class="status-badge process">🏬 CHỜ XỬ LÝ KHO</span></td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
 
       <div v-if="activeTab === 'locations'">
          <header><h1>ĐỊNH VỊ VỊ TRÍ LƯU KHO</h1></header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Vị Trí Hiện Tại</th>
                      <th>Chọn Ô / Kệ Mới</th>
                      <th>Hành Động</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <span v-if="order.warehouse_location" class="location-tag">📍 {{ order.warehouse_location }}</span>
                         <span v-else style="color: #e74c3c;">⚠️ Chưa xếp kệ</span>
                      </td>
                      <td>
                        <select v-model="locationInputs[order.id]" class="table-input">
                            <option value="" disabled>-- Chọn kệ --</option>
                            <option value="Khu A - Kệ 01">Khu A - Kệ 01</option>
                            <option value="Khu B - Kệ 02">Khu B - Kệ 02</option>
                            <option value="Khu VIP - Giao gấp">Khu VIP - Giao gấp</option>
                        </select>
                      </td>
                      <td><button @click="updateLocation(order.id)" class="btn-action-cyan">🎯 Lưu vị trí</button></td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>
 
       <div v-if="activeTab === 'cargo_condition'">
          <header><h1>BÁO CÁO ĐÁNH GIÁ NGOẠI QUAN & HƯ HẠI</h1></header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Ảnh Gốc (OMS)</th>
                      <th>Ảnh Hư Hại (WMS)</th>
                      <th>Biên Bản Hiện Tại</th>
                      <th>Cập Nhật Tình Trạng & Tải Ảnh</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td><img :src="getImageUrl(order.product_image)" class="table-img-preview" /></td>
                      <td>
                         <img v-if="order.damage_image" :src="getImageUrl(order.damage_image)" class="table-img-preview damage-border" />
                         <span v-else class="no-damage-txt">Chưa ghi nhận ảnh</span>
                      </td>
                      <td>
                         <p class="condition-text" v-if="order.cargo_condition">💬 {{ order.cargo_condition }}</p>
                         <span v-else style="color: #27ae60;">💚 Bình thường</span>
                      </td>
                      <td>
                         <div class="report-box-grid">
                            <input type="text" v-model="conditionInputs[order.id]" placeholder="Mô tả hư hại..." class="table-input" />
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
          <header><h1>PHÊ DUYỆT XUẤT KHO BÀN GIAO TMS</h1></header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Vị Trí</th>
                      <th>Quét Mã</th>
                      <th>Lệnh Vận Hành</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td><span class="location-tag">📍 {{ order.warehouse_location || 'Kho chung' }}</span></td>
                      <td>
                         <span v-if="order.is_scanned" style="color: #2ecc71;">✔️ Đã quét</span>
                         <span v-else style="color: #e74c3c;">❌ Chưa quét</span>
                      </td>
                      <td>
                         <div style="display: flex; flex-direction: column; gap: 6px;">
                            <button v-if="!order.is_scanned" @click="scanOrder(order.id)" class="btn-action-blue">🔍 Quét PDA</button>
                            <button @click="releaseToTms(order.id)" :disabled="!order.is_scanned" :class="{ 'btn-disabled': !order.is_scanned }" class="btn-action-green">📤 Giao TMS</button>
                         </div>
                      </td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>

       <div v-if="activeTab === 'warehouse_history'">
          <header><h1>📜 NHẬT KÝ BIẾN ĐỘNG KHO</h1></header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Mã Đơn</th>
                      <th>Nội Dung</th>
                      <th>Thời Gian</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="(log, idx) in warehouseLogs" :key="idx">
                      <td><b class="order-id-tag">{{ formatOrderId(log.order_id) }}</b></td>
                      <td>{{ log.notes }}</td>
                      <td>{{ formatDate(log.changed_at) }}</td>
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

const formatOrderId = (id) => `PKG-${60000 + Number(id)}`;
 
const getImageUrl = (path) => {
   if (!path) return 'https://placehold.co/60x45?text=No+Image';
   return `http://localhost:3000${path}`;
};
 
const fetchWmsOrders = async () => {
   const res = await axios.get('http://localhost:3000/api/orders/wms');
   wmsOrders.value = res.data;
};
 
const fetchWarehouseLogs = async () => {
   const res = await axios.get('http://localhost:3000/api/orders/wms/logs');
   warehouseLogs.value = res.data;
};
 
const switchToHistoryTab = () => {
   activeTab.value = 'warehouse_history';
   fetchWarehouseLogs(); 
};

const scanOrder = async (id) => {
   await axios.put(`http://localhost:3000/api/orders/wms/${id}/scan-barcode`);
   fetchWmsOrders(); 
};
 
const updateLocation = async (id) => {
   const loc = locationInputs.value[id];
   if (!loc) return alert("Chọn vị trí!");
   await axios.put(`http://localhost:3000/api/orders/wms/${id}/location`, { warehouse_location: loc });
   fetchWmsOrders();
};
 
const onFileChange = (event, id) => {
   if (event.target.files[0]) fileInputs.value[id] = event.target.files[0];
};
 
const submitConditionReport = async (id) => {
   const txt = conditionInputs.value[id] || 'Bình thường';
   const file = fileInputs.value[id];
   const formData = new FormData();
   formData.append('cargo_condition', txt);
   if (file) formData.append('cargo_image', file);
 
   await axios.put(`http://localhost:3000/api/orders/wms/${id}/condition`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
   });
   alert("Đã gửi biên bản!");
   conditionInputs.value[id] = '';
   delete fileInputs.value[id];
   fetchWmsOrders();
};
 
const releaseToTms = async (id) => {
   await axios.put(`http://localhost:3000/api/orders/wms/${id}/release`);
   fetchWmsOrders();
};
 
const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleString('vi-VN') : '';
 
const logout = () => { localStorage.clear(); router.push('/'); };
 
onMounted(() => {
   fetchWmsOrders();
   wmsInterval = setInterval(fetchWmsOrders, 5000);
});
 
onUnmounted(() => { if (wmsInterval) clearInterval(wmsInterval); });
</script>
 
<style scoped>
.dashboard-container { display: flex; height: 100vh; background: #f4f6f9; }
.sidebar { width: 260px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; }
.brand { font-size: 22px; font-weight: 800; margin-bottom: 25px; text-align: center; }
.user-info { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid #34495e; padding-bottom: 15px; }
.avatar { width: 45px; height: 45px; background: #e67e22; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.navigation-menu { display: flex; flex-direction: column; gap: 8px; }
.menu-btn { padding: 12px; text-align: left; background: none; border: none; color: #bdc3c7; cursor: pointer; border-radius: 4px; font-size: 13px; }
.menu-btn.active { background: #1a252f; color: white; border-left: 4px solid #e67e22; }
.btn-logout { margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; }
.main-content { flex: 1; padding: 30px; overflow-y: auto; }
header h1 { font-size: 20px; color: #2c3e50; margin-bottom: 20px; border-left: 5px solid #e67e22; padding-left: 10px; }
.card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
.table-img-preview { width: 60px; height: 45px; object-fit: cover; border-radius: 4px; background: #f9f9f9; }
.damage-border { border: 2px solid #e74c3c; }
.no-damage-txt { font-size: 11px; color: #95a5a6; font-style: italic; }
.order-id-tag { background: #eee; padding: 3px 6px; border-radius: 4px; font-family: monospace; }
.location-tag { background: #e8f8f5; color: #16a085; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
.table-input { padding: 6px; border: 1px solid #ddd; border-radius: 4px; width: 100%; margin-bottom: 5px; }
.btn-action-cyan { background: #16a085; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-action-orange { background: #e67e22; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-action-blue { background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-action-green { background: #27ae60; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
.btn-disabled { background: #ccc !important; cursor: not-allowed; }
</style>
