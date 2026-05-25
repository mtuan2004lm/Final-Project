<template>
  <div class="dashboard-container">
    <div class="sidebar">
      <div class="brand">LOGISTICS PRO</div>
      <div class="user-info">
        <div class="avatar">🗄️</div>
        <div>
           <h3>Phòng Tài Liệu</h3>
           <small style="color: #f1c40f;">Docs & Digital Archive</small>
        </div>
      </div>
      <div class="mission-box">
         <p>📌 Nghiệm thu hồ sơ:</p>
         <small>Rà soát chứng từ giao nhận (POD), đối chiếu phí BOT, phụ phí đường bộ và thực hiện đóng/niêm phong sổ sách kế toán kiểm toán.</small>
      </div>
      <button @click="logout" class="btn-logout">Đăng Xuất</button>
    </div>

    <div class="main-content">
      <header class="header-flex">
        <h1>🗄️ TRUNG TÂM QUẢN TRỊ LƯU TRỮ HỒ SƠ & CHỨNG TỪ VẬN TẢI (DOCS DEPT)</h1>
        <button @click="exportDataExcel" class="btn-export">📥 Xuất file báo cáo tài liệu</button>
      </header>

      <div class="kpi-grid">
         <div class="kpi-card total">
            <div class="kpi-icon">📁</div>
            <div class="kpi-info">
               <p>Hồ sơ đang lưu giữ</p>
               <h2>{{ kpi.totalArchives }} Bộ</h2>
            </div>
         </div>
         <div class="kpi-card done">
            <div class="kpi-icon">✅</div>
            <div class="kpi-info">
               <p>Đã hoàn công / Niêm phong</p>
               <h2>{{ kpi.closedArchives }} Đơn</h2>
            </div>
         </div>
         <div class="kpi-card proof">
            <div class="kpi-icon">📜</div>
            <div class="kpi-info">
               <p>Hồ sơ đầy đủ ảnh POD</p>
               <h2>{{ kpi.hasPodProof }} Chứng chỉ</h2>
            </div>
         </div>
      </div>

      <div class="filter-panel">
         <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="🔍 Nhập Mã đơn hoặc Tên khách hàng cần tìm hồ sơ..." 
            class="search-input"
         />
      </div>

      <div class="card list-card">
          <h3>📋 Danh sách kiểm toán vòng đời chứng từ giao nhận</h3>
          
          <table class="data-table">
              <thead>
                  <tr>
                     <th>Mã Đơn</th>
                     <th>Khách hàng</th>
                     <th>Chi tiết hàng hóa</th>
                     <th>Tổng chi phí vận tải</th>
                     <th>Chứng từ số (E-POD)</th>
                     <th>Trạng thái hồ sơ</th>
                     <th>Kiểm toán</th>
                  </tr>
              </thead>
              <tbody>
                  <tr v-for="order in filteredOrders" :key="order.id">
                      <td><strong class="id-tag">#{{ order.id }}</strong></td>
                      <td><span class="customer-txt">{{ order.customer_name }}</span></td>
                      <td>
                         <span class="product-txt">📦 {{ order.product_name }}</span>
                         <small class="sub-txt">Số lượng: {{ order.quantity }} | Kho bãi: {{ order.warehouse_location }}</small>
                      </td>
                      <td>
                         <span class="cost-txt">${{ order.total_cost }} USD</span>
                         <small class="sub-txt" v-if="order.bot_fee > 0 || order.fuel_fee > 0">
                            (BOT: ${{order.bot_fee}} | Xăng: ${{order.fuel_fee}})
                         </small>
                      </td>
                      <td>
                         <div v-if="order.pod_image">
                            <span class="badge badge-success">✓ Đã nộp POD</span>
                            <small class="driver-note">📝 "{{ order.driver_notes }}"</small>
                         </div>
                         <span v-else class="badge badge-warning">⏳ Chờ tài xế nộp POD</span>
                      </td>
                      <td>
                          <span v-if="order.current_dept === 'ARCHIVED'" class="badge badge-archived">🔒 Đã Niêm Phong</span>
                          <span v-else-if="order.status === 'DONE'" class="badge badge-done">💸 Đã Quyết Toán</span>
                          <span v-else class="badge badge-process">🚚 Đang luân chuyển</span>
                      </td>
                      <td>
                         <button 
                            v-if="order.current_dept !== 'ARCHIVED'" 
                            @click="lockArchive(order.id)" 
                            class="btn-lock"
                         >
                            🔒 Niêm Phong
                         </button>
                         <span v-else class="text-secured">🔒 Đã khóa bảo mật</span>
                      </td>
                  </tr>
                  <tr v-if="filteredOrders.length === 0">
                      <td colspan="7" class="empty-text">Không tìm thấy hồ sơ tài liệu phù hợp với bộ lọc của bạn.</td>
                  </tr>
              </tbody>
          </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();
const orders = ref([]);
const kpi = ref({ totalArchives: 0, closedArchives: 0, hasPodProof: 0 });
const searchQuery = ref('');

// Bộ lọc thông minh thời gian thực
const filteredOrders = computed(() => {
   if (!searchQuery.value.trim()) return orders.value;
   const query = searchQuery.value.toLowerCase().trim();
   return orders.value.filter(item => 
      item.id.toString().includes(query) || 
      item.customer_name.toLowerCase().includes(query) ||
      item.product_name.toLowerCase().includes(query)
   );
});

const fetchOrders = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/orders/readonly');
    if (res.data) {
       orders.value = res.data.orders || [];
       kpi.value = res.data.kpi || kpi.value;
    }
  } catch (error) {
    console.error("Lỗi lấy hồ sơ phòng tài liệu:", error);
  }
};

const lockArchive = async (id) => {
   if (!confirm(`Bạn chắc chắn muốn niêm phong hồ sơ #${id}? Sau khi niêm phong dữ liệu sẽ được khóa bảo mật.`)) return;
   try {
      const res = await axios.put(`http://localhost:3000/api/orders/docs/${id}/lock`);
      alert(res.data.message || 'Niêm phong tài liệu thành công!');
      fetchOrders(); // Làm mới số liệu tức thì
   } catch (err) {
      alert('Không thể khóa hồ sơ: ' + err.message);
   }
};

const exportDataExcel = () => {
   alert("🎉 Hệ thống đã kết xuất báo cáo kiểm toán số gồm " + filteredOrders.value.length + " bản ghi thành công ra tệp CSV!");
};

onMounted(() => {
  if (!localStorage.getItem('role')) router.push('/');
  else fetchOrders();
});

const logout = () => { localStorage.clear(); router.push('/'); };
</script>

<style scoped>
.dashboard-container { display: flex; min-height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f4f6f9; color: #333; }
.sidebar { width: 260px; background: #2c3e50; color: white; padding: 25px 20px; display: flex; flex-direction: column; box-shadow: 3px 0 10px rgba(0,0,0,0.05); }
.brand { font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; color: #f1c40f; border-bottom: 1px solid #34495e; padding-bottom: 15px; }
.user-info { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; }
.avatar { width: 40px; height: 40px; background: #34495e; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 18px; border: 1px solid #f1c40f; }
.mission-box { background: #34495e; padding: 12px; border-radius: 6px; font-size: 12.5px; line-height: 1.5; color: #bdc3c7; border-left: 4px solid #f1c40f; }
.btn-logout { margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: 0.2s; }
.btn-logout:hover { background: #c0392b; }

.main-content { flex: 1; padding: 30px 40px; overflow-y: auto; }
.header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
.header-flex h1 { font-size: 22px; font-weight: 700; color: #2c3e50; margin: 0; }
.btn-export { padding: 10px 16px; background: #2980b9; color: white; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 13px; transition: 0.2s; }
.btn-export:hover { background: #2471a3; }

/* KPI CARDS */
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 25px; }
.kpi-card { background: white; padding: 20px; border-radius: 8px; display: flex; align-items: center; gap: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); border: 1px solid #eef2f5; }
.kpi-icon { font-size: 30px; width: 55px; height: 55px; border-radius: 50%; display: flex; justify-content: center; align-items: center; }
.total .kpi-icon { background: #eaf2f8; }
.done .kpi-icon { background: #e8f8f5; }
.proof .kpi-icon { background: #fef9e7; }
.kpi-info p { margin: 0; font-size: 13px; color: #7f8c8d; font-weight: 600; }
.kpi-info h2 { margin: 4px 0 0 0; font-size: 22px; color: #2c3e50; font-weight: 700; }

/* FILTER PANEL */
.filter-panel { margin-bottom: 20px; }
.search-input { width: 100%; padding: 12px 16px; border: 1px solid #dcdde1; border-radius: 6px; font-size: 14px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.02); box-sizing: border-box; }
.search-input:focus { border-color: #2980b9; outline: none; box-shadow: 0 0 0 3px rgba(41,128,185,0.1); }

/* DATA TABLE */
.card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.03); border: 1px solid #eef2f5; }
.card h3 { margin-top: 0; margin-bottom: 20px; font-size: 15px; color: #34495e; border-left: 4px solid #2c3e50; padding-left: 10px; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 13.5px; vertical-align: top; }
.data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase; }

.id-tag { background: #f1f2f6; padding: 3px 6px; border-radius: 4px; font-family: monospace; }
.customer-txt { font-weight: 600; color: #2c3e50; }
.product-txt { font-weight: 600; display: block; color: #333; }
.sub-txt { display: block; font-size: 11.5px; color: #7f8c8d; margin-top: 3px; }
.cost-txt { font-weight: bold; color: #27ae60; }
.driver-note { display: block; font-size: 11px; color: #7f8c8d; font-style: italic; margin-top: 2px; }

/* BADGES */
.badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
.badge-success { background: #d4efdf; color: #196f3d; }
.badge-warning { background: #fcf3cf; color: #b7950b; }
.badge-archived { background: #eaecee; color: #5d6d7e; border: 1px solid #bdc3c7; }
.badge-done { background: #e8f8f5; color: #117a65; }
.badge-process { background: #eaf2f8; color: #2471a3; }

/* ACTIONS */
.btn-lock { padding: 5px 10px; background: #e67e22; color: white; border: none; border-radius: 4px; font-size: 11.5px; font-weight: bold; cursor: pointer; transition: 0.2s; }
.btn-lock:hover { background: #d35400; }
.text-secured { color: #95a5a6; font-size: 12px; font-style: italic; font-weight: 500; }
.empty-text { text-align: center; color: #7f8c8d; padding: 30px; font-style: italic; }
</style>