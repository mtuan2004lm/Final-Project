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
                                     <option value="Tuyến Cao Tốc TPHCM - Đà Nẵng">Cao Tốc TPHCM - Đà Nẵng</option>
                                 </select>
                                 <!--
                                   ĐÃ SỬA: value giờ là license_plate THUẦN (khớp cột trucks.license_plate)
                                   thay vì chuỗi mô tả cũ ("Xe Tải Hino 29-H1-6009"), để app tài xế
                                   (getDriverTrips) và cập nhật GPS theo biển số hoạt động đúng.
                                   Danh sách xe lấy động từ bảng fleet thật, chỉ hiện xe "Sẵn sàng".
                                 -->
                                 <select :id="'select-truck-' + order.id" class="form-select-custom" style="width: 150px;">
                                     <option v-for="truck in availableTrucks" :key="truck.id" :value="truck.license_plate">
                                        {{ truck.type }} [{{ truck.license_plate }}]
                                     </option>
                                     <option v-if="availableTrucks.length === 0" disabled value="">Không có xe sẵn sàng</option>
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
                  Vị trí xe thời gian thực (do app tài xế bắn định kỳ) hiển thị ở tab "Quản lý Đội Xe".
               </p>

               <table class="data-table">
                   <thead>
                       <tr>
                          <th>Đơn xe</th><th>Hành trình đang đi</th><th>Chi phí phát sinh (USD)</th><th>Nộp E-POD tài xế</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders.filter(o => o.status === 'SHIPPING')" :key="order.id">
                           <td><b class="barcode-tag">PKG-600{{ order.id }}</b><br/><small>{{ order.assigned_truck }}</small></td>
                           <td><span style="color: #2e7d32; font-weight: bold;">🚚 Đang trên đường:</span><br/><small>{{ order.delivery_route }}</small></td>
                           <td>
                              <div style="display: flex; flex-direction: column; gap: 4px;">
                                 <input type="number" step="0.01" :id="'bot-' + order.id" placeholder="Phí trạm BOT (USD)" class="form-input-custom-small" />
                                 <input type="number" step="0.01" :id="'fuel-' + order.id" placeholder="Tiền dầu (USD)" class="form-input-custom-small" />
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

           <!-- FORM THÊM XE MỚI -->
           <div class="card list-card">
               <h3>➕ Thêm xe mới vào đội xe</h3>
               <div class="fleet-form-grid">
                   <input v-model="newTruck.license_plate" placeholder="Biển số (VD: 29C-123.45)" class="form-input-custom" />
                   <input v-model="newTruck.type" placeholder="Chủng loại tải trọng" class="form-input-custom" />
                   <input v-model="newTruck.driver_name" placeholder="Tài xế phụ trách" class="form-input-custom" />
                   <input v-model="newTruck.fuel_norm" placeholder="Định mức dầu (VD: 12L/100km)" class="form-input-custom" />
                   <input v-model="newTruck.maintenance_date" type="date" class="form-input-custom" />
                   <input v-model="newTruck.registry_expiry" type="date" class="form-input-custom" />
                   <button @click="createTruck" class="btn-action" style="background: #2980b9; color: white;">➕ Thêm xe</button>
               </div>
           </div>

           <div class="card list-card" style="margin-top: 25px;">
               <h3>🚚 Đội xe tải nội bộ (Số liệu thời gian thực từ Garage)</h3>
               <table class="data-table">
                   <thead>
                       <tr>
                          <th>Biển Kiểm Soát</th><th>Chủng loại tải trọng</th><th>Định mức dầu</th><th>Tài xế phụ trách</th>
                          <th>Lịch bảo trì / Đăng kiểm</th><th>Vị trí GPS thời gian thực</th><th>Tình trạng kỹ thuật</th><th>Hành động</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="truck in fleet" :key="truck.id">
                           <td><b style="color: #2c3e50; font-family: monospace; font-size: 15px;">{{ truck.license_plate }}</b></td>

                           <td>
                              <input v-if="editingId === truck.id" v-model="editDraft.type" class="form-input-custom-small" />
                              <span v-else>{{ truck.type }}</span>
                           </td>
                           <td>
                              <input v-if="editingId === truck.id" v-model="editDraft.fuel_norm" class="form-input-custom-small" />
                              <span v-else>{{ truck.fuel_norm }}</span>
                           </td>
                           <td>
                              <input v-if="editingId === truck.id" v-model="editDraft.driver_name" class="form-input-custom-small" />
                              <b v-else>{{ truck.driver_name }}</b>
                           </td>
                           <td>
                              <div v-if="editingId === truck.id" style="display:flex; flex-direction:column; gap:4px;">
                                 <input type="date" v-model="editDraft.maintenance_date" class="form-input-custom-small" />
                                 <input type="date" v-model="editDraft.registry_expiry" class="form-input-custom-small" />
                              </div>
                              <small v-else style="line-height: 1.6;">
                                 Bảo trì: {{ formatDate(truck.maintenance_date) }}<br/>
                                 Đăng kiểm: {{ formatDate(truck.registry_expiry) }}
                              </small>
                           </td>
                           <td>
                              <small v-if="truck.current_lat && truck.current_lng" style="line-height: 1.6;">
                                 📍 {{ Number(truck.current_lat).toFixed(5) }}, {{ Number(truck.current_lng).toFixed(5) }}<br/>
                                 <span style="color:#95a5a6;">Cập nhật: {{ formatDateTime(truck.gps_updated_at) }}</span>
                              </small>
                              <span v-else style="color:#95a5a6; font-style: italic;">Chưa có tín hiệu GPS</span>
                           </td>
                           <td>
                              <select class="form-select-custom" :value="truck.status" @change="updateTruckStatus(truck.id, $event.target.value)">
                                 <option value="Sẵn sàng">Sẵn sàng</option>
                                 <option value="Đang đi giao hàng">Đang đi giao hàng</option>
                                 <option value="Bảo trì">Bảo trì</option>
                                 <option value="⚠️ Quá hạn bảo trì">⚠️ Quá hạn bảo trì</option>
                                 <option value="Hỏng - Ngừng khai thác">Hỏng - Ngừng khai thác</option>
                              </select>
                           </td>
                           <td>
                              <div style="display:flex; gap:6px;">
                                 <template v-if="editingId === truck.id">
                                    <button @click="saveEdit(truck.id)" class="btn-action" style="background:#2ecc71; color:white;">💾 Lưu</button>
                                    <button @click="cancelEdit" class="btn-action" style="background:#95a5a6; color:white;">✖ Hủy</button>
                                 </template>
                                 <template v-else>
                                    <button @click="startEdit(truck)" class="btn-action" style="background:#3498db; color:white;">✏️ Sửa</button>
                                    <button @click="deleteTruck(truck.id)" class="btn-action" style="background:#e74c3c; color:white;">🗑️ Xóa</button>
                                 </template>
                              </div>
                           </td>
                       </tr>
                       <tr v-if="fleet.length === 0">
                           <td colspan="8" style="text-align:center; color:#95a5a6; padding:20px; font-style:italic;">Chưa có xe nào trong đội xe. Hãy thêm xe mới ở trên.</td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>

     </div>
   </div>
 </template>

 <script setup>
 import { ref, onMounted, onUnmounted, computed } from 'vue';
 import axios from 'axios';
 import { useRouter } from 'vue-router';

 const router = useRouter();
 const userRole = ref('TMS');
 const activeTab = ref('planning');

 const orders = ref([]);
 const fleet = ref([]);
 let tmsInterval = null;

 // Chỉ cho phép gán những xe đang "Sẵn sàng" vào chuyến mới
 const availableTrucks = computed(() => fleet.value.filter(t => t.status === 'Sẵn sàng'));

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

    if (!truckVal) {
       alert("Không có xe nào sẵn sàng để điều phối!");
       return;
    }

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
            notes: `Tài xế bàn giao hàng cho khách thành công tại tọa độ GPS vệ tinh. Nộp chi phí dọc đường (BOT: $${botFee}, Dầu: $${fuelFee}). Hồ sơ chuyển phòng Kế toán duyệt doanh thu.`
        });

        alert("Tài xế hoàn tất hành trình! Đơn hàng đã giao thành công và chuyển số liệu về phòng Kế Toán.");
        fetchTmsData();
    } catch (err) {
        alert("Lỗi nộp biên bản chặng đi!");
    }
 };

 // ================== QUẢN LÝ ĐỘI XE (FLEET) ==================
 const newTruck = ref({
    license_plate: '', type: '', driver_name: '', fuel_norm: '',
    maintenance_date: '', registry_expiry: ''
 });

 const createTruck = async () => {
    if (!newTruck.value.license_plate || !newTruck.value.type) {
       alert("Vui lòng nhập ít nhất Biển số và Chủng loại xe!");
       return;
    }
    try {
       await axios.post('http://localhost:3000/api/orders/tms/fleet', newTruck.value);
       alert("Đã thêm xe mới vào đội xe!");
       newTruck.value = { license_plate: '', type: '', driver_name: '', fuel_norm: '', maintenance_date: '', registry_expiry: '' };
       fetchTmsData();
    } catch (err) {
       alert(err.response?.data?.error || "Lỗi thêm xe mới!");
    }
 };

 const editingId = ref(null);
 const editDraft = ref({});

 const startEdit = (truck) => {
    editingId.value = truck.id;
    editDraft.value = {
       type: truck.type,
       driver_name: truck.driver_name,
       fuel_norm: truck.fuel_norm,
       maintenance_date: truck.maintenance_date ? truck.maintenance_date.substring(0, 10) : '',
       registry_expiry: truck.registry_expiry ? truck.registry_expiry.substring(0, 10) : ''
    };
 };

 const cancelEdit = () => { editingId.value = null; editDraft.value = {}; };

 const saveEdit = async (truckId) => {
    try {
       await axios.put(`http://localhost:3000/api/orders/tms/fleet/${truckId}`, editDraft.value);
       alert("Đã cập nhật thông tin xe!");
       cancelEdit();
       fetchTmsData();
    } catch (err) {
       alert("Lỗi cập nhật xe!");
    }
 };

 const updateTruckStatus = async (truckId, status) => {
    try {
       await axios.put(`http://localhost:3000/api/orders/tms/fleet/${truckId}/status`, { status });
       fetchTmsData();
    } catch (err) {
       alert("Lỗi cập nhật tình trạng xe!");
    }
 };

 const deleteTruck = async (truckId) => {
    if (!confirm("Xác nhận xóa xe này khỏi đội xe?")) return;
    try {
       await axios.delete(`http://localhost:3000/api/orders/tms/fleet/${truckId}`);
       fetchTmsData();
    } catch (err) {
       alert("Lỗi xóa xe!");
    }
 };

 const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
 const formatDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—';

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
 .form-input-custom { padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px; box-sizing: border-box;}
 .btn-action { padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;}
 .fleet-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: center; margin-top: 10px;}
 .fleet-form-grid button { grid-column: span 1; height: 38px; }
 </style>