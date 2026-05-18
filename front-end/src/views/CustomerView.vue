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
        <header><h1>QUẢN LÝ ĐƠN HÀNG - KHÁCH HÀNG (CUSTOMER)</h1></header>
        
        <div class="content-body">
          
          <div class="card form-card" style="margin-bottom: 25px;">
              <h3>➕ Tạo Đơn Hàng Mới</h3>
              <div class="form-row" style="display: flex; gap: 15px; margin-top: 15px; align-items: flex-end;">
                <div class="form-group" style="flex: 2; display: flex; flex-direction: column; gap: 5px;">
                  <label style="font-size: 13px; font-weight: bold; color: #7f8c8d;">Tên khách hàng / Công ty:</label>
                  <input v-model="customerName" type="text" placeholder="Nhập tên người gửi..." style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>
                
                <div class="form-group" style="flex: 2; display: flex; flex-direction: column; gap: 5px;">
                  <label style="font-size: 13px; font-weight: bold; color: #7f8c8d;">Tên sản phẩm hàng hóa:</label>
                  <input v-model="productName" type="text" placeholder="Ví dụ: Thùng Carton, Máy móc..." style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>
                
                <div class="form-group" style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                  <label style="font-size: 13px; font-weight: bold; color: #7f8c8d;">Số lượng:</label>
                  <input v-model.number="quantity" type="number" min="1" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
                </div>
  
                <button @click="handleCreateOrder" class="btn-submit">Gửi Tạo Đơn</button>
              </div>
          </div>
  
          <div class="card list-card">
              <h3>📋 Danh sách đơn hàng của bạn</h3>
              <table class="data-table">
                  <thead>
                      <tr><th>ID</th><th>Khách hàng</th><th>Hàng hóa</th><th>SL</th><th>Trạng thái</th><th>Nơi giữ</th></tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td>#{{ order.id }}</td>
                          <td>{{ order.customer_name }}</td>
                          <td>{{ order.product_name }}</td>
                          <td>{{ order.quantity }}</td>
                          <td><span class="badge" :style="order.status === 'NEW' ? 'background: #e8f5e9; color: #2e7d32; font-weight: bold;' : ''">{{ order.status }}</span></td>
                          <td style="font-weight: bold; color: #c0392b;">{{ order.current_dept }}</td>
                      </tr>
                      <tr v-if="orders.length === 0">
                          <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Chưa có đơn hàng nào được tạo.</td>
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
  const userRole = ref('CUSTOMER');
  const orders = ref([]);
  
  // Các biến phục vụ Form nhập liệu mới thêm vào
  const customerName = ref('');
  const productName = ref('');
  const quantity = ref(1);
  
  // Hàm lấy dữ liệu đơn hàng (Cập nhật endpoint trỏ đúng tới backend mvc mới)
  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/orders/customer');
      orders.value = res.data;
    } catch (error) {
      console.error("Lỗi tải data", error);
    }
  };
  
  // Hàm xử lý nút "Gửi Tạo Đơn" kết nối với Backend tạo đơn
  const handleCreateOrder = async () => {
    if (!customerName.value || !productName.value || !quantity.value) {
      alert("Vui lòng điền đầy đủ cả 3 thông tin đơn hàng!");
      return;
    }
  
    try {
      const res = await axios.post('http://localhost:3000/api/orders', {
        customer_name: customerName.value,
        product_name: productName.value,
        quantity: quantity.value
      });
  
      alert(res.data.message || "Tạo đơn hàng thành công!");
  
      // Reset sạch form sau khi tạo thành công để tiện tạo đơn tiếp theo
      productName.value = '';
      quantity.value = 1;
  
      // Tải lại bảng ngay lập tức để đơn mới xuất hiện lên top bảng
      fetchOrders();
  
    } catch (error) {
      console.error("Lỗi khi tạo đơn hàng:", error);
      alert("Không thể tạo đơn. Vui lòng kiểm tra lại kết nối Server Back-end!");
    }
  };
  
  onMounted(() => {
    // Tạm thời bỏ kiểm tra token nghiêm ngặt nếu bạn chỉ dùng phân quyền role, hoặc giữ lại tùy ý bạn
    const role = localStorage.getItem('role');
    if (!role) {
      router.push('/');
    } else {
      // Lấy tên username cũ điền sẵn vào ô tên khách hàng cho tiện tiện dụng
      customerName.value = localStorage.getItem('username') || '';
      fetchOrders();
    }
  });
  
  const logout = () => {
    localStorage.clear();
    router.push('/');
  };
  </script>
  
  <style scoped>
  /* TOÀN BỘ CSS GỐC CỦA BẠN ĐƯỢC GIỮ NGUYÊN */
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
  .badge { padding: 5px 10px; background: #ecf0f1; border-radius: 15px; font-size: 11px; }
  
  /* CHỈ THÊM DUY NHẤT CSS CHO NÚT BẤM FORM ĐỂ ĐỒNG BỘ STYLE */
  .btn-submit {
    padding: 10px 25px;
    background: #27ae60;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    height: 40px;
    transition: background 0.2s;
  }
  .btn-submit:hover {
    background: #219653;
  }
  </style>