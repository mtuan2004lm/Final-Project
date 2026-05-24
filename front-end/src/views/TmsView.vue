<template>
  <div class="dashboard-container">
    <div class="sidebar">
      <div class="brand">LOGISTICS PRO</div>
      <div class="user-info">
        <div class="avatar">{{ userRole.charAt(0) }}</div>
        <div>
           <h3>PHÒNG XE ({{ userRole }})</h3>
           <small style="color: #2ecc71;">Trực tuyến điều độ</small>
        </div>
      </div>
      
      <div class="navigation-menu">
         <button @click="activeTab = 'planning'" :class="{ active: activeTab === 'planning' }" class="menu-btn">
            🗺️ Điều phối & Gom đơn
         </button>
         <button @click="activeTab = 'fleet'" :class="{ active: activeTab === 'fleet' }" class="menu-btn">
            🚚 Quản lý Đội Xe (Fleet)
         </button>
      </div>
 
      <button @click="logout" class="btn-logout">Đăng Xuất</button>
    </div>
 
    <div class="main-content">
      
       <div v-if="activeTab === 'planning'">
          <header><h1>HỆ THỐNG ĐIỀU PHỐI GOM ĐƠN THÔNG MINH (PLANNING)</h1></header>
          
          <div class="card list-card">
              <h3>🚚 Danh sách đơn hàng nhận từ Kho (Chờ chỉ định lộ trình & Tài xế)</h3>
              <table class="data-table">
                  <thead>
                      <tr>
                         <th>Mã Kiện</th><th>Khách hàng</th><th>Chi tiết Hàng Hóa</th><th>Lộ Trình Hiện Tại</th><th>Phương Tiện</th><th>Hành Động Nghiệp Vụ</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td><b class="barcode-tag">PKG-600{{ order.id }}</b></td>
                          <td><b>{{ order.customer_name }}</b></td>
                          <td>{{ order.product_name }} (SL: {{ order.quantity }})</td>
                          <td>
                             <span v-if="order.delivery_route" class="location-badge" style="background: #e8f5e9; color: #2e7d32;">
                                🛣️ {{ order.delivery_route }}
                             </span>
                             <span v-else style="color: #e74c3c; font-style: italic; font-weight: bold;">🚨 Chờ gom chuyến</span>
                          </td>
                          <td>
                             <span v-if="order.assigned_truck" class="location-badge" style="background: #fff3cd; color: #856404;">
                                🚛 {{ order.assigned_truck }}
                             </span>
                             <span v-else style="color: #95a5a6; font-style: italic;">Chưa gán xe</span>
                          </td>
                          <td>
                             <div style="display: flex; gap: 6px; align-items: center;">
                                <select :id="'select-route-' + order.id" class="form-select-custom" style="width: 140px;">
                                    <option value="Trục Bắc Nam - Quốc Lộ 1A">Tuyến QL1A (Bắc Nam)</option>
                                    <option value="Nội Thành Express - Giao Nhanh">Nội Thành (Giao Nhanh)</option>
                                    <option value="Tuyến Cao Tốc Trung Lương">Cao Tốc Trung Lương</option>
                                </select>
                                <select :id="'select-truck-' + order.id" class="form-select-custom" style="width: 120px;">
                                    <option value="Xe Tải Hino 29-H1-6009">Hino [29-H1-6009]</option>
                                    <option value="Xe Tải Isuzu 51-C2-8843">Isuzu [51-C2-8843]</option>
                                    <option value="Container Thaco 30-F5-1211">Thaco [30-F5-1211]</option>
                                </select>
                                <button @click="dispatchTruck(order.id)" class="btn-action" style="background: #e67e22; color: white;">
                                   🚀 Xuất Bến
                                </button>
                             </div>
                          </td>
                      </tr>
                  </tbody>
              </table>
          </div>

          <div class="card list-card" style="margin-top: 25px; border-top: 4px solid #2980b9;">
              <h3 style="color: #2980b9;">📱 GIAO DIỆN MÔ PHỎNG APP ĐIỆN THOẠI CỦA TÀI XẾ (DRIVER MOBILE POD)</h3>
              <p style="font-size: 13px; color: #7f8c8d; margin-bottom: 15px;">
                 Tài xế đi dọc đường phát sinh chi phí, khi tới kho khách hàng sẽ nhấn nút này để cập nhật định vị vệ tinh GPS, nộp biên bản ký nhận (POD) và đẩy đơn về phòng Kế Toán thanh quyết toán.
              </p>
              
              <table class="data-table">
                  <thead>
                      <tr>
                         <th>Đơn xe</th><th>Hành trình đang đi</th><th>Chi phí phát sinh</th><th>Nộp E-POD tài xế</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders.filter(o => o.status === 'SHIPPING')" :key="order.id">
                          <td><b class="barcode-tag">PKG-600{{ order.id }}</b><br/><small>{{ order.assigned_truck }}</small></td>
                          <td><span style="color: #2e7d32; font-weight: bold;">🚚 Đang trên đường:</span><br/><small>{{ order.delivery_route }}</small></td>
                          <td>
                             <div style="display: flex; flex-direction: column; gap: 4px;">
                                <input type="number" :id="'bot-' + order.id" placeholder="Vé trạm BOT (VNĐ)" class="form-input-custom-small" />
                                <input type="number" :id="'fuel-' + order.id" placeholder="Tiền dầu (VNĐ)" class="form-input-custom-small" />
                             </div>
                          </td>
                          <td>
                             <div style="display: flex; gap: 6px;">
                                <input type="text" :id="'notes-' + order.id" placeholder="Ghi chú tài xế..." class="form-input-custom-small" style="flex:1;" />
                                <button @click="submitDriverPod(order.id)" class="btn-action" style="background: #2ecc71; color: white;">
                                   📸 Ký nhận & Gửi To Kế Toán
                                </button>
                             </div>
                          </td>
                      </tr>
                      <tr v-if="orders.filter(o => o.status === 'SHIPPING').length === 0">
                          <td colspan="4" style="text-align: center; color: #95a5a6; padding: 20px; font-style: italic;">Hiện không có xe tải nào đang lăn bánh ngoài đường (SHIPPING). Hãy bấm nút "Xuất Bến" ở bảng trên để điều phối xe chạy.</td>
                      </tr>
                  </tbody>
              </table>
          </div>
       </div>

       <div v-if="activeTab === 'fleet'">
          <header><h1>QUẢN LÝ ĐỘI XE VẬN TẢI & NHẬT KÝ BẢO TRÌ ĐỊNH KỲ</h1></header>
          <div class="card list-card" style="margin-top: 25px;">
              <h3>🚚 Đội xe tải nội bộ (Số liệu thời gian thực từ Garage)</h3>
              <table class="data-table">
                  <thead>
                      <tr><th>Biển Kiểm Soát</th><th>Chủng loại tải trọng</th><th>Định mức dầu</th><th>Tài xế phụ trách</th><th>Trạng thái kỹ thuật</th></tr>
                  </thead>
                  <tbody>
                      <tr v-for="truck in fleet" :key="truck.plate">
                          <td><b style="color: #2c3e50; font-family: monospace; font-size: 15px;">{{ truck.plate }}</b></td>
                          <td>{{ truck.type }}</td>
                          <td>{{ truck.fuel_norm }}</td>
                          <td><b>{{ truck.driver }}</b></td>
                          <td>
                             <span :class="truck.status === 'Sẵn sàng vận hành' ? 'truck-status status-safe' : 'truck-status status-danger'">
                                ● {{ truck.status }}
                             </span>
                          </td>
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
const userRole = ref('TMS');
const activeTab = ref('planning');
  
const orders = ref([]);
const fleet = ref([]);
let tmsInterval = null;
  
const fetchTmsData = async () => {
  try {
    const resOrders = await axios.get('http://localhost:3000/api/orders/tms');
    orders.value = resOrders.data;
    
    const resFleet = await axios.get('http://localhost:3000/api/orders/tms/fleet');
    fleet.value = resFleet.data;
  } catch (error) {
     console.error("Lỗi tải thông tin phòng điều vận TMS:", error);
  }
};
  
// ĐIỀU PHỐI XE TẢI XUẤT BẾN
const dispatchTruck = async (orderId) => {
   const routeVal = document.getElementById(`select-route-${orderId}`).value;
   const truckVal = document.getElementById(`select-truck-${orderId}`).value;
   
   try {
       await axios.put(`http://localhost:3000/api/orders/tms/${orderId}/assign`, {
           route_name: routeVal,
           license_plate: truckVal
       });
       
       // Tạo vết lịch sử cho hành động điều xe
       await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
           status: 'SHIPPING',
           current_dept: 'TMS',
           from_dept: 'TMS',
           notes: `Điều phối chuyến đi thành công. Xe tải: ${truckVal}, tuyến đường di chuyển: ${routeVal}.`
       });

       alert("Lập tờ lệnh điều xe xuất bến thành công! Kiện hàng chuyển sang trạng thái SHIPPING.");
       fetchTmsData();
   } catch (err) {
       alert("Lỗi lệnh xuất bến xe tải!");
   }
};
  
// TÀI XẾ NỘP BIÊN BẢN GIAO HÀNG ĐIỆN TỬ E-POD
const submitDriverPod = async (orderId) => {
   const botFee = document.getElementById(`bot-${orderId}`).value || 0;
   const fuelFee = document.getElementById(`fuel-${orderId}`).value || 0;
   const driverNotes = document.getElementById(`notes-${orderId}`).value || '';
   
   try {
       await axios.put(`http://localhost:3000/api/orders/tms/${orderId}/pod-submit`, {
           bot_fee: botFee,
           fuel_fee: fuelFee,
           driver_notes: driverNotes,
           pod_image: 'https://cdn-storage.logistics.pro/pod_600' + orderId + '.jpg',
           gps_coordinates: '10.762622, 106.660172 (Kho khách hàng)'
       });
       
       // Đồng thời ghi nhận vào sổ cái lịch sử hành trình chung
       await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
           status: 'DELIVERED',
           current_dept: 'ACC',
           from_dept: 'TMS',
           notes: `Tài xế bàn giao hàng cho khách thành công tại tọa độ GPS vệ tinh. Nộp chi phí dọc đường (BOT: ${botFee}đ, Dầu: ${fuelFee}đ). Hồ sơ chuyển phòng Kế toán duyệt doanh thu.`
       });

       alert("Tài xế hoàn tất hành trình! Đơn hàng đã giao thành công và chuyển số liệu về phòng Kế Toán.");
       fetchTmsData();
   } catch (err) {
       alert("Lỗi nộp biên bản chặng đi!");
   }
};
  
onMounted(() => {
  if (!localStorage.getItem('role')) {
    router.push('/');
  } else {
    fetchTmsData();
    tmsInterval = setInterval(fetchTmsData, 5000);
  }
});
  
onUnmounted(() => { if (tmsInterval) clearInterval(tmsInterval); });
const logout = () => { localStorage.clear(); router.push('/'); };
</script>
 
<style scoped>
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
.data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 13px;}
.data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase;}
.barcode-tag { font-family: monospace; background: #2d3436; color: #fff; padding: 3px 6px; border-radius: 3px; font-size: 13px; }
.location-badge { font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: inline-block;}
.truck-status { padding: 4px 8px; border-radius: 20px; font-size: 12px; font-weight: bold; }
.status-safe { background: #e8f5e9; color: #2e7d32; }
.status-danger { background: #ffebee; color: #c62828; }
.form-select-custom { padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px; background: white;}
.form-input-custom-small { width: 100%; padding: 6px 10px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 12.5px; box-sizing: border-box;}
.btn-action { padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;}
</style>