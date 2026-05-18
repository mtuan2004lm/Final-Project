<template>
    <div class="dashboard-container">
      <div class="sidebar">
        <div class="brand">LOGISTICS PRO</div>
        <div class="user-info">
          <div class="avatar">D</div>
          <div>
             <h3>Phòng Tài Liệu</h3>
             <small>Docs (Read-Only)</small>
          </div>
        </div>
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
      <div class="main-content">
        <header><h1>🗄️ PHÒNG LƯU TRỮ HỒ SƠ & CHỨNG TỪ (DOCS)</h1></header>
        <div class="content-body">
          <div class="card list-card">
              <h3>✅ Danh sách đơn hàng đã hoàn tất vòng đời vận chuyển</h3>
              <table class="data-table">
                  <thead>
                      <tr><th>ID</th><th>Khách hàng</th><th>Hàng hóa</th><th>SL</th><th>Trạng thái hoàn công</th><th>Vị trí hiện tại</th></tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td>#{{ order.id }}</td>
                          <td>{{ order.customer_name }}</td>
                          <td>{{ order.product_name }}</td>
                          <td>{{ order.quantity }}</td>
                          <td><span class="badge status-delivered">{{ order.status }}</span></td>
                          <td style="color: #27ae60; font-weight: bold;">Lưu trữ thành công hồ sơ</td>
                      </tr>
                      <tr v-if="orders.length === 0">
                          <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Chưa có biên bản bàn giao hoàn tất nào được lưu ở đây.</td>
                      </tr>
                  </tbody>
              </table>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import axios from 'axios';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const orders = ref([]);
  
  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/orders/readonly');
      orders.value = res.data;
    } catch (error) {
      console.error("Lỗi lấy hồ sơ");
    }
  };
  
  onMounted(() => {
    if (!localStorage.getItem('role')) router.push('/');
    else fetchOrders();
  });
  
  const logout = () => { localStorage.clear(); router.push('/'); };
  </script>
  
  <style scoped>
  .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
  .sidebar { width: 240px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; }
  .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; }
  .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  .main-content { flex: 1; padding: 30px; overflow-y: auto; }
  .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  .data-table th, .data-table td { padding: 12px 15px; border-bottom: 1px solid #ecf0f1; text-align: left; }
  .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 13px; }
  .badge { padding: 5px 10px; background: #d4edda; color: #155724; border-radius: 15px; font-size: 11px; font-weight: bold; }
  </style>