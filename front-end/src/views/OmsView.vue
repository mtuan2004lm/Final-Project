<template>
    <div class="dashboard-container">
      <div class="sidebar">
        <div class="brand">LOGISTICS PRO</div>
        <div class="user-info">
          <div class="avatar">{{ userRole.charAt(0) }}</div>
          <div>
             <h3>{{ userRole }}</h3>
             <small>Đang online</small>
          </div>
        </div>
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
      <div class="main-content">
        <header><h1>PHÒNG QUẢN LÝ ĐƠN HÀNG (OMS)</h1></header>
        <div class="content-body">
          <div class="card list-card">
              <h3>📋 Danh sách đơn hàng mới (Chờ duyệt)</h3>
              <table class="data-table">
                  <thead>
                      <tr><th>ID</th><th>Khách hàng</th><th>Hàng hóa</th><th>SL</th><th>Trạng thái</th><th>Hành động</th></tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td>#{{ order.id }}</td>
                          <td>{{ order.customer_name }}</td>
                          <td>{{ order.product_name }}</td>
                          <td>{{ order.quantity }}</td>
                          <td><span class="badge status-new">{{ order.status }}</span></td>
                          <td>
                            <button @click="approveOrder(order.id)" class="btn-action">Duyệt & Chuyển WMS</button>
                          </td>
                      </tr>
                      <tr v-if="orders.length === 0">
                          <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Không có đơn hàng nào chờ duyệt.</td>
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
  const userRole = ref('OMS');
  const orders = ref([]);
  
  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/orders/oms');
      orders.value = res.data;
    } catch (error) {
      console.error("Lỗi tải dữ liệu phòng OMS");
    }
  };
  
  const approveOrder = async (orderId) => {
    try {
      await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
        status: 'APPROVED',
        current_dept: 'WMS'
      });
      alert("Đã duyệt đơn và chuyển giao cho bộ phận Kho (WMS)!");
      fetchOrders();
    } catch (error) {
      alert("Duyệt đơn hàng thất bại!");
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
  .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid #34495e; margin-bottom: 20px; }
  .avatar { width: 40px; height: 40px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
  .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  .main-content { flex: 1; padding: 30px; overflow-y: auto; }
  .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
  .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  .data-table th, .data-table td { padding: 12px 15px; border-bottom: 1px solid #ecf0f1; text-align: left; }
  .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 13px; }
  .badge { padding: 5px 10px; background: #e8f5e9; color: #2e7d32; border-radius: 15px; font-size: 11px; font-weight: bold; }
  .btn-action { padding: 6px 12px; background: #2980b9; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
  .btn-action:hover { background: #2471a3; }
  </style>