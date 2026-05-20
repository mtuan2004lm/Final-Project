<template>
    <div class="dashboard-container">
      <div class="sidebar">
        <div class="brand">LOGISTICS PRO</div>
        <div class="user-info">
          <div class="avatar">A</div>
          <div>
             <h3>PHÒNG KẾ TOÁN</h3>
             <small style="color: #2ecc71;">Kiểm soát dòng tiền</small>
          </div>
        </div>
        <div style="padding: 15px; background: #34495e; border-radius: 6px; font-size: 13px; margin-top: 20px;">
           <p style="margin: 0; color: #f1c40f;">📌 Nhiệm vụ:</p>
           <small>Đối soát tài khoản ngân hàng, xác nhận các đơn hàng đã đóng tiền để cho phép xuất kho bãi.</small>
        </div>
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
  
      <div class="main-content">
         <header>
            <h1>💵 TRUNG TÂM PHÊ DUYỆT DOANH THU KẾ TOÁN (ACCOUNTING DEPT)</h1>
         </header>
  
         <div class="card" style="margin-top: 25px;">
            <h3>📥 Danh sách đơn hàng Khách hàng vừa Thanh toán cần đối soát (Chờ Duyệt Tiền)</h3>
            
            <table class="data-table">
               <thead>
                  <tr>
                     <th>ID Đơn</th>
                     <th>Khách hàng</th>
                     <th>Tên Hàng hóa</th>
                     <th>Ảnh đính kèm</th>
                     <th>Tổng số tiền thu</th>
                     <th>Hình thức thanh toán</th>
                     <th>Trạng thái tiền</th>
                     <th>Hành động kế toán</th>
                  </tr>
               </thead>
               <tbody>
                  <tr v-for="order in accOrders" :key="order.id">
                     <td><b>#{{ order.id }}</b></td>
                     <td>{{ order.customer_name || 'N/A' }}</td>
                     <td>{{ order.product_name }} (SL: {{ order.quantity }})</td>
                     <td>
                        <img v-if="order.image_url" :src="'http://localhost:3000' + order.image_url" class="order-img-preview" @click="zoomImage('http://localhost:3000' + order.image_url)" title="Bấm vào để phóng to ảnh" />
                        <span v-else style="color: #95a5a6; font-style: italic; font-size: 12px;">Không có ảnh</span>
                     </td>
                     <td style="color: #27ae60; font-weight: bold; font-size: 16px;">${{ order.total_cost }}</td>
                     <td><span class="pay-method-tag">{{ order.payment_method || 'Chuyển khoản' }}</span></td>
                     <td>
                        <span :class="order.payment_status === 'PAID' ? 'status-paid' : 'status-pending'">
                           {{ order.payment_status === 'PAID' ? '✔️ Đã thanh toán' : '⏳ Chờ kiểm tra tiền nổi' }}
                        </span>
                     </td>
                     <td>
                        <button @click="confirmMoneyReceived(order.id)" class="btn-approve-money">✔️ Đã nhận đủ tiền (Duyệt)</button>
                     </td>
                  </tr>
                  <tr v-if="accOrders.length === 0">
                     <td colspan="8" style="text-align: center; padding: 40px; color: #7f8c8d; font-style: italic;">
                        Hiện tại không có giao dịch dòng tiền nào cần phê duyệt.
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import axios from 'axios';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const accOrders = ref([]);
  
  // Tải dữ liệu các đơn đang nằm ở phòng ban Kế toán
  const fetchAccOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/orders/acc/orders');
      accOrders.value = res.data;
    } catch (error) {
      console.error("🔴 LỖI: Kết nối dữ liệu phòng kế toán thất bại!", error);
    }
  };
  
  // Kế toán bấm xác nhận tiền về tài khoản ngân hàng
  const confirmMoneyReceived = async (orderId) => {
     if(!confirm(`Xác nhận đơn hàng #${orderId} đã nổi tiền thành công tại tài khoản công ty?`)) return;
     try {
        const res = await axios.put(`http://localhost:3000/api/orders/acc/${orderId}/approve`);
        alert(res.data.message);
        fetchAccOrders(); // Làm mới lại danh sách ngay lập tức sau khi duyệt
     } catch (error) {
        console.error(error);
        alert("Lỗi hệ thống khi phê duyệt kế toán!");
     }
  };
  
  const zoomImage = (url) => { window.open(url, '_blank'); };
  const logout = () => { localStorage.clear(); router.push('/'); };
  
  onMounted(() => {
    if (localStorage.getItem('role') !== 'ACC') {
       router.push('/'); // Chặn quyền truy cập nếu không phải Kế toán
    } else {
       fetchAccOrders();
       // Tự động quét cập nhật dữ liệu liên tục sau mỗi 4 giây
       const interval = setInterval(fetchAccOrders, 4000);
    }
  });
  </script>
  
  <style scoped>
  /* Giao diện chuẩn phong cách vuông vắn thanh lịch */
  .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
  .sidebar { width: 250px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; box-sizing: border-box; }
  .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; letter-spacing: 1px; }
  .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 15px; border-bottom: 1px solid #34495e; margin-bottom: 15px; }
  .avatar { width: 40px; height: 40px; background: #9b59b6; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
  .btn-logout { margin-top: auto; padding: 12px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  .main-content { flex: 1; padding: 35px; overflow-y: auto; background: #ffffff; }
  .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #eef2f5; }
  
  .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  .data-table th, .data-table td { padding: 14px 18px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 14px;}
  .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 13px; font-weight: bold; text-transform: uppercase; }
  
  .order-img-preview { width: 60px; height: 60px; object-fit: cover; border-radius: 4px; cursor: pointer; border: 1px solid #ddd; transition: transform 0.2s; }
  .order-img-preview:hover { transform: scale(1.1); border-color: #2c3e50; }
  
  .pay-method-tag { padding: 4px 10px; background: #e1f5fe; color: #0288d1; border-radius: 4px; font-weight: bold; font-size: 12px;}
  .status-pending { color: #d35400; font-weight: bold; font-size: 13px; }
  .status-paid { color: #27ae60; font-weight: bold; font-size: 13px; }
  .btn-approve-money { padding: 8px 14px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; }
  .btn-approve-money:hover { background: #219653; }
  </style>