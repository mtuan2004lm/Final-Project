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
        
        <div class="notification-box">
           <h4>🔔 Thông báo hệ thống</h4>
           
           <div v-if="returnedOrderNotice">
              <p style="color: #ff7675; font-weight: bold; margin-bottom: 4px; font-size: 13px;">
                 ⚠️ Đơn hàng #{{ returnedOrderNotice.id }} bị hoàn trả!
              </p>
              <p style="color: #f1c40f; font-size: 12px; font-style: italic; margin-top: 0; line-height: 1.4; max-height: 60px; overflow-y: auto;">
                 Lý do: {{ returnedOrderNotice.notes || 'Chưa cập nhật lý do cụ thể.' }}
              </p>
           </div>
  
           <p v-else-if="latestNotification">{{ latestNotification }}</p>
           
           <p v-else style="color: #bdc3c7;">Chưa có biến động trạng thái.</p>
        </div>
  
        <div class="navigation-menu">
          <button :class="{'active-nav': currentTab === 'create'}" @click="currentTab = 'create'">
            ➕ Tạo đơn hàng mới
          </button>
          <button :class="{'active-nav': currentTab === 'current-orders'}" @click="currentTab = 'current-orders'">
            ⏳ Đơn hàng hiện tại
          </button>
          <button :class="{'active-nav': currentTab === 'history'}" @click="currentTab = 'history'">
            📜 Lịch sử dịch vụ (Giỏ hàng)
          </button>
          <button :class="{'active-nav': currentTab === 'payment'}" @click="currentTab = 'payment'">
            💳 Cổng thanh toán <span v-if="activePaymentOrder" class="dot-alert">!</span>
          </button>
          <button :class="{'active-nav': currentTab === 'feedback'}" @click="currentTab = 'feedback'">
            ⭐ Đánh giá dịch vụ
          </button>
        </div>
  
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
  
      <div class="main-content">
        <div v-if="currentTab === 'create'" class="card form-card">
          <h2>📝 Khởi Tạo Yêu Cầu Vận Chuyển Hàng Hóa</h2>
          <p style="color: #7f8c8d; font-size: 14px;">Hệ thống tự động liên kết dữ liệu liên phòng ban (OMS -> WMS -> TMS)</p>
          
          <div class="form-group">
            <label>Tên khách hàng / Đối tác doanh nghiệp:</label>
            <input type="text" v-model="newOrder.customer_name" placeholder="Nhập tên của bạn hoặc để trống dùng tài khoản mặc định" />
          </div>
  
          <div class="form-group">
            <label>Tên mặt hàng cần vận chuyển:</label>
            <input type="text" v-model="newOrder.product_name" placeholder="Ví dụ: Linh kiện điện tử, Hóa chất, Vải cuộn..." />
          </div>
  
          <div class="form-group-row">
            <div class="form-group">
              <label>Số lượng (Khối lượng / Thùng):</label>
              <input type="number" v-model.number="newOrder.quantity" min="1" />
            </div>
            <div class="form-group">
              <label>Phân loại tính chất hàng hóa:</label>
              <select v-model="newOrder.cargo_type">
                <option value="Standard">Standard (Hàng hóa thông thường - $50/đơn vị)</option>
                <option value="Dangerous">Dangerous (Hàng hóa nguy hiểm/Hóa chất - $120/đơn vị)</option>
              </select>
            </div>
          </div>
  
          <button @click="submitOrder" class="btn-submit">🚀 Gửi Yêu Cầu Duyệt Đơn Hệ Thống</button>
        </div>
  
        <div v-if="currentTab === 'current-orders'" class="card table-card">
          <h2>⏳ Tiến Độ Xử Lý Đơn Hàng Hiện Tại</h2>
          <p style="color: #7f8c8d; font-size: 14px; margin-bottom: 20px;">Đơn hàng luân chuyển qua các phòng ban theo thời gian thực (Realtime)</p>
          
          <table class="orders-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Mặt Hàng</th>
                <th>Số Lượng</th>
                <th>Phòng Ban Xử Lý</th>
                <th>Trạng Thái Luồng</th>
                <th>Tổng Chi Phí</th>
                <th>Thanh Toán</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in activeOrders" :key="order.id">
                <td><b>#{{ order.id }}</b></td>
                <td>{{ order.product_name }}</td>
                <td>{{ order.quantity }}</td>
                <td><span class="dept-tag">{{ order.current_dept }}</span></td>
                <td>
                  <span :class="'status-badge ' + order.status.toLowerCase()">
                    {{ order.status }}
                  </span>
                </td>
                <td class="price-txt">${{ order.total_cost }}</td>
                <td>
                  <span v-if="order.payment_status === 'PAID'" class="txt-pay-done">✅ Đã duyệt tiền</span>
                  <button v-else @click="goToPaymentTab(order)" class="btn-pay-action">💳 Trả tiền</button>
                </td>
              </tr>
              <tr v-if="activeOrders.length === 0">
                <td colspan="7" style="text-align:center; padding:30px; color:#95a5a6; font-style:italic;">
                  Bạn không có đơn hàng nào đang trong quá trình luân chuyển xử lý.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  
        <div v-if="currentTab === 'history'" class="card table-card">
          <h2>📜 Lịch Sử Giao Dịch & Lưu Trữ Đơn Hàng Hoàn Thành</h2>
          <table class="orders-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Mặt Hàng</th>
                <th>Số Lượng</th>
                <th>Trạng Thái Cuối</th>
                <th>Sổ Sách Kế Toán</th>
                <th>Ngày Hoàn Thành</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in historyOrders" :key="order.id">
                <td>#{{ order.id }}</td>
                <td>{{ order.product_name }}</td>
                <td>{{ order.quantity }}</td>
                <td><span class="status-badge done">{{ order.status }}</span></td>
                <td><span class="txt-pay-done">💰 {{ order.payment_status }}</span></td>
                <td>{{ new Date(order.created_at).toLocaleString() }}</td>
              </tr>
              <tr v-if="historyOrders.length === 0">
                <td colspan="6" style="text-align:center; padding:30px; color:#95a5a6; font-style:italic;">
                  Chưa có đơn hàng nào hoàn thành chuỗi logistics.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
  
        <div v-if="currentTab === 'payment'" class="card payment-card-main">
          <div class="payment-header-flex">
            <h2>💳 Trung Tâm Thanh Toán Trực Tuyến Đơn Hàng</h2>
            <div class="price-badge-large">
              Số tiền cần nộp: ${{ selectedPaymentOrder ? selectedPaymentOrder.total_cost : 0 }}
            </div>
          </div>
  
          <div v-if="selectedPaymentOrder" class="payment-layout-split">
            <div class="method-selector-tabs">
              <button class="active-p-tab">🏢 Chuyển khoản ngân hàng doanh nghiệp</button>
              <button style="opacity:0.5; cursor:not-allowed;">💳 Thẻ Visa/Mastercard (Bảo trì)</button>
              <button style="opacity:0.5; cursor:not-allowed;">📱 Ví điện tử E-Wallet (Bảo trì)</button>
            </div>
            
            <div style="flex:1; background:#fdfefe; border:1px solid #e2e8f0; padding:20px; border-radius:6px;">
               <h3>Thông tin đơn hàng thanh toán: #{{ selectedPaymentOrder.id }}</h3>
               <p><b>Sản phẩm vận chuyển:</b> {{ selectedPaymentOrder.product_name }}</p>
               <p><b>Tổng số lượng:</b> {{ selectedPaymentOrder.quantity }} kiện</p>
               <hr style="border:0; border-top:1px solid #eee; margin:15px 0;" />
               <p style="color:#e67e22; font-weight:bold;">📌 Ghi chú chuyển khoản:</p>
               <div style="background:#f8f9fa; padding:12px; border-left:4px solid #f39c12; font-family:monospace; font-size:14px;">
                  Nội dung: THANH TOAN DON HANG {{ selectedPaymentOrder.id }}
               </div>
               <button @click="processMockPayment" class="btn-submit" style="background:#27ae60; margin-top:20px;">
                  Xác nhận đã chuyển khoản (Gửi yêu cầu tới Kế toán ACC)
               </button>
            </div>
          </div>
          <div v-else style="text-align:center; padding:40px; color:#7f8c8d;">
             <p style="font-size:48px; margin:0;">📭</p>
             <p>Vui lòng chọn một đơn hàng cụ thể ở mục "Đơn hàng hiện tại" rồi nhấn nút "Trả tiền" để xử lý hóa đơn.</p>
          </div>
        </div>
  
        <div v-if="currentTab === 'feedback'" class="card form-card">
           <h2>⭐ Khảo Sát & Đánh Giá Chất Lượng Dịch Vụ Logistics</h2>
           <p style="color:#7f8c8d; font-size:14px; margin-bottom:20px;">Ý kiến đóng góp của bạn giúp chúng tôi tối ưu luồng chuyển tiếp liên phòng ban tốt hơn.</p>
           
           <div class="form-group">
              <label>Chọn mã đơn hàng bạn muốn đánh giá:</label>
              <select v-model="feedbackData.orderId">
                 <option v-for="o in orders" :key="o.id" :value="o.id">Đơn hàng #{{ o.id }} - {{ o.product_name }} ({{ o.status }})</option>
              </select>
           </div>
           <div class="form-group">
              <label>Mức độ hài lòng (1 - 5 Sao):</label>
              <select v-model.number="feedbackData.rating">
                 <option value="5">⭐⭐⭐⭐⭐ 5 Sao - Quá xuất sắc, luân chuyển cực nhanh</option>
                 <option value="4">⭐⭐⭐⭐ 4 Sao - Hài lòng, thủ tục tinh gọn</option>
                 <option value="3">⭐⭐⭐ 3 Sao - Bình thường, khâu xử lý chứng từ còn chậm</option>
                 <option value="2">⭐⭐ 2 Sao - Chưa tốt, hay bị trả đơn khâu OMS</option>
                 <option value="1">⭐ 1 Sao - Kém, cần cải tiến nhiều</option>
              </select>
           </div>
           <div class="form-group">
              <label>Nội dung phản hồi / Góp ý chi tiết:</label>
              <textarea v-model="feedbackData.comment" rows="4" placeholder="Nhập ý kiến đóng góp của bạn tại đây..."></textarea>
           </div>
           <button @click="submitFeedback" class="btn-submit" style="background:#9b59b6;">📤 Gửi Ý Kiến Phản Hồi</button>
        </div>
  
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed } from 'vue';
  import axios from 'axios';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const userRole = ref('CUSTOMER');
  const currentTab = ref('current-orders');
  
  // Quản lý trạng thái đơn hàng
  const orders = ref([]);
  const latestNotification = ref('');
  
  // Form tạo đơn hàng mới
  const newOrder = ref({
    customer_name: '',
    product_name: '',
    quantity: 1,
    cargo_type: 'Standard'
  });
  
  // Quản lý thanh toán
  const selectedPaymentOrder = ref(null);
  
  // Form đánh giá dịch vụ
  const feedbackData = ref({
     orderId: '',
     rating: 5,
     comment: ''
  });
  
  // TỰ ĐỘNG LỌC RA ĐƠN HÀNG BỊ PHÒNG OMS HOÀN TRẢ
  const returnedOrderNotice = computed(() => {
     if (!orders.value || orders.value.length === 0) return null;
     return orders.value.find(order => order.status === 'RETURNED');
  });
  
  // Tính toán phân tách mảng đơn hàng hiển thị theo từng Tab
  const activeOrders = computed(() => {
    return orders.value.filter(o => o.status !== 'DONE');
  });
  
  const historyOrders = computed(() => {
    return orders.value.filter(o => o.status === 'DONE');
  });
  
  const activePaymentOrder = computed(() => {
    return orders.value.find(o => o.payment_status === 'UNPAID' && o.status !== 'DONE');
  });
  
  // Hàm gọi API lấy danh sách đơn hàng từ Backend
  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/orders/customer');
      orders.value = res.data;
    } catch (error) {
      console.error("Lỗi lấy danh sách đơn hàng:", error);
    }
  };
  
  // Hàm gửi đơn hàng mới lên hệ thống
  const submitOrder = async () => {
    if (!newOrder.value.product_name || !newOrder.value.quantity) {
      alert("Vui lòng điền đầy đủ thông tin mặt hàng!");
      return;
    }
    try {
      await axios.post('http://localhost:3000/api/orders', newOrder.value);
      alert("Khởi tạo đơn hàng thành công! Đã gửi hồ sơ sang phòng OMS thẩm định luồng.");
      newOrder.value = { customer_name: '', product_name: '', quantity: 1, cargo_type: 'Standard' };
      fetchOrders();
      currentTab.value = 'current-orders';
    } catch (error) {
      alert("Khởi tạo yêu cầu đơn hàng thất bại!");
    }
  };
  
  // Chuyển nhanh sang tab thanh toán
  const goToPaymentTab = (order) => {
    selectedPaymentOrder.value = order;
    currentTab.value = 'payment';
  };
  
  // Khách hàng bấm gửi yêu cầu đã chuyển khoản thành công
  const processMockPayment = async () => {
     if (!selectedPaymentOrder.value) return;
     try {
        await axios.put(`http://localhost:3000/api/orders/acc/${selectedPaymentOrder.value.id}/approve`, {
           payment_status: 'PAID'
        });
        alert(`Yêu cầu thanh toán đơn #${selectedPaymentOrder.value.id} đã được gửi! Chờ Kế toán duyệt sổ.`);
        selectedPaymentOrder.value = null;
        fetchOrders();
        currentTab.value = 'current-orders';
     } catch (error) {
        alert("Cổng kết nối thanh toán gặp lỗi kỹ thuật!");
     }
  };
  
  // Khách hàng gửi form đánh giá dịch vụ
  const submitFeedback = async () => {
     if (!feedbackData.value.orderId) return alert("Vui lòng chọn một mã đơn hàng cụ thể!");
     try {
        await axios.put(`http://localhost:3000/api/orders/feedback/${feedbackData.value.orderId}`, {
           rating: feedbackData.value.rating,
           feedback: feedbackData.value.comment
        });
        alert("Cảm ơn bạn đã gửi đánh giá! Ý kiến của bạn đã được ghi nhận.");
        feedbackData.value = { orderId: '', rating: 5, comment: '' };
     } catch (error) {
        alert("Không thể gửi đánh giá lỗi hệ thống!");
     }
  };
  
  onMounted(() => {
    if (!localStorage.getItem('role')) {
      router.push('/');
    } else {
      fetchOrders();
      // Thiết lập cơ chế tự động đồng bộ hóa liên tục sau mỗi 5 giây
      setInterval(fetchOrders, 5000);
    }
  });
  
  const logout = () => {
    localStorage.clear();
    router.push('/');
  };
  </script>
  
  <style scoped>
  .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f4f6f9; }
  .sidebar { width: 260px; background: #2c3e50; color: white; padding: 25px 20px; display: flex; flex-direction: column; box-sizing: border-box; }
  .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; letter-spacing: 1px; color: #fff; }
  .user-info { display: flex; align-items: center; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid #34495e; }
  .avatar { width: 42px; height: 42px; background: #3498db; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 18px; }
  .user-info h3 { margin: 0; font-size: 15px; letter-spacing: 0.5px; }
  .user-info small { color: #2ecc71; font-weight: 600; }
  
  /* Hộp Thông báo Hệ thống bên Menu trái */
  .notification-box { background: #34495e; padding: 12px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #3498db; }
  .notification-box h4 { margin: 0 0 6px 0; font-size: 13px; color: #f1c40f; font-weight: bold; }
  .notification-box p { margin: 0; font-size: 12px; color: #ecf0f1; line-height: 1.3; }
  
  .navigation-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .navigation-menu button { padding: 12px 15px; background: none; border: none; color: #bdc3c7; text-align: left; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; transition: all 0.2s; position: relative; }
  .navigation-menu button:hover, .navigation-menu button.active-nav { background: #34495e; color: white; }
  .dot-alert { position: absolute; right: 15px; top: 12px; background: #e74c3c; color: white; border-radius: 50%; width: 16px; height: 16px; font-size: 10px; display: flex; justify-content: center; align-items: center; font-weight: bold; }
  
  .btn-logout { margin-top: auto; padding: 11px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 13px; transition: background 0.2s; }
  .btn-logout:hover { background: #c0392b; }
  
  .main-content { flex: 1; padding: 35px; overflow-y: auto; background: #ffffff; }
  .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); border: 1px solid #eef2f5; }
  .form-card { max-width: 700px; }
  h2 { margin-top: 0; color: #2c3e50; font-size: 22px; font-weight: 700; }
  
  .form-group { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
  .form-group-row { display: flex; gap: 20px; }
  .form-group-row .form-group { flex: 1; }
  label { font-size: 13px; font-weight: bold; color: #34495e; text-transform: uppercase; }
  input, select, textarea { padding: 12px; border: 1px solid #cbd5e1; border-radius: 5px; font-size: 14px; color: #334155; box-sizing: border-box; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 3px rgba(52,152,219,0.15); }
  
  .btn-submit { padding: 12px 20px; background: #3498db; color: white; border: none; border-radius: 5px; font-size: 14px; font-weight: bold; cursor: pointer; width: 100%; transition: background 0.2s; }
  .btn-submit:hover { background: #2980b9; }
  
  .orders-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  .orders-table th, .orders-table td { padding: 14px 16px; border-bottom: 1px solid #eef2f5; text-align: left; font-size: 14px; }
  .orders-table th { background: #f8f9fa; color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; }
  .dept-tag { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; }
  
  .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; display: inline-block; }
  .status-badge.new { background: #fef3c7; color: #d97706; }
  .status-badge.approved { background: #e0f2fe; color: #0369a1; }
  .status-badge.returned { background: #fee2e2; color: #dc2626; font-weight: 800; border: 1px dashed #ef4444; }
  .status-badge.done { background: #dcfce7; color: #15803d; }
  
  .price-txt { font-weight: bold; color: #2c3e50; }
  .btn-pay-action { padding: 5px 10px; background: #f39c12; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 11px; cursor: pointer; }
  .btn-pay-action:hover { background: #d35400; }
  .txt-pay-done { color: #27ae60; font-weight: bold; font-size: 13px; }
  
  .payment-card-main { max-width: 900px; }
  .payment-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
  .price-badge-large { font-size: 20px; font-weight: 800; color: #f39c12; background: #fef5e7; padding: 10px 20px; border-radius: 5px; border: 1px solid #fdebd0; }
  .payment-layout-split { display: flex; gap: 25px; }
  .method-selector-tabs { width: 260px; display: flex; flex-direction: column; gap: 10px; }
  .method-selector-tabs button { padding: 12px; background: #f8f9fa; border: 1px solid #e2e8f0; text-align: left; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 13px; color: #4a5568; }
  .method-selector-tabs button.active-p-tab { background: #f39c12; color: white; border-color: #d35400; }
  </style>