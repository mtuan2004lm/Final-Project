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
           <p v-if="latestNotification">{{ latestNotification }}</p>
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
            ⭐️ Đánh giá & Phản hồi
          </button>
        </div>
  
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
  
      <div class="main-content">
        
        <div v-if="currentTab === 'create'" class="tab-content-wrapper">
          <header><h1>➕ TẠO ĐƠN HÀNG MỚI & TÍNH PHÍ TỰ ĐỘNG</h1></header>
          <div class="card form-card-full">
            <h3>Thông tin yêu cầu vận chuyển</h3>
            <div class="form-body-vertical">
              <div class="form-group-vertical">
                <label>Tên sản phẩm hàng hóa:</label>
                <input v-model="productName" type="text" placeholder="Ví dụ: Thùng Carton, Linh kiện điện tử..." />
              </div>
              
              <div class="form-group-vertical">
                <label>Loại hàng hóa dịch vụ:</label>
                <select v-model="cargoType">
                   <option value="Standard">Hàng tiêu chuẩn ($50/CBM)</option>
                   <option value="Dangerous">Hàng hóa chất / Nguy hiểm ($120/CBM)</option>
                </select>
              </div>
  
              <div class="form-group-vertical">
                <label>Khối lượng ước tính (CBM / Tấn):</label>
                <input v-model.number="quantity" type="number" min="1" />
              </div>
  
              <div class="price-display-box">
                <span>Tổng chi phí ước tính hệ thống:</span>
                <span class="cost-value">${{ calculatedCost }}</span>
              </div>
  
              <button @click="handleCreateOrder" class="btn-submit-large">GỬI YÊU CẦU TẠO ĐƠN</button>
            </div>
          </div>
        </div>
  
        <div v-if="currentTab === 'current-orders'" class="tab-content-wrapper">
          <header><h1>⏳ THEO DÕI ĐƠN HÀNG ĐANG XỬ LÝ</h1></header>
          <div class="card list-card">
            <h3>📋 Danh sách tiến độ các đơn hàng hiện tại</h3>
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>Hàng hóa</th><th>SL</th><th>Chi phí</th><th>Trạng thái tiến độ</th><th>Vị trí hiện tại</th><th>Thao tác nhanh</th></tr>
                </thead>
                <tbody>
                    <tr v-for="order in currentProcessingOrders" :key="order.id">
                        <td>#{{ order.id }}</td>
                        <td>{{ order.product_name }}</td>
                        <td>{{ order.quantity }}</td>
                        <td class="txt-price">${{ order.total_cost }}</td>
                        <td><span class="badge" :class="order.status">{{ order.status }}</span></td>
                        <td class="txt-dept">{{ order.current_dept }}</td>
                        <td>
                           <button v-if="order.status === 'NEW'" @click="handleCancel(order.id)" class="btn-cancel">Hủy Đơn</button>
                           <span v-else style="color: #95a5a6; font-size: 13px;">Đang xử lý...</span>
                        </td>
                    </tr>
                    <tr v-if="currentProcessingOrders.length === 0">
                        <td colspan="7" class="txt-empty">Hiện không có đơn hàng nào đang trong quá trình vận chuyển.</td>
                    </tr>
                </tbody>
            </table>
          </div>
        </div>
  
        <div v-if="currentTab === 'history'" class="tab-content-wrapper">
          <header><h1>📜 LỊCH SỬ SỬ DỤNG DỊCH VỤ VẬN TẢI</h1></header>
          <div class="card list-card">
            <h3>📊 Tất cả lịch sử giao dịch dịch vụ hoàn công</h3>
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>Hàng hóa</th><th>SL</th><th>Tổng phí dịch vụ</th><th>Trạng thái cuối</th><th>Phương thức thanh toán</th></tr>
                </thead>
                <tbody>
                    <tr v-for="order in historicalOrders" :key="order.id">
                        <td>#{{ order.id }}</td>
                        <td>{{ order.product_name }}</td>
                        <td>{{ order.quantity }}</td>
                        <td class="txt-price">${{ order.total_cost }}</td>
                        <td><span class="badge" :class="order.status">{{ order.status }}</span></td>
                        <td>
                           <span v-if="order.payment_status === 'PENDING'" style="color: #f39c12; font-weight: bold;">⏳ Chờ duyệt tiền</span>
                           <span v-else-if="order.payment_method" class="txt-pay-done">✔️ ({{ order.payment_method }})</span>
                           <span v-else style="color: #e74c3c; font-weight: bold;">Chưa đóng tiền</span>
                        </td>
                    </tr>
                    <tr v-if="historicalOrders.length === 0">
                        <td colspan="6" class="txt-empty">Chưa có dữ liệu lịch sử hoàn thành.</td>
                    </tr>
                </tbody>
            </table>
          </div>
        </div>
  
        <div v-if="currentTab === 'payment'" class="tab-content-wrapper">
          <header><h1>💳 TRUNG TÂM THANH TOÁN ĐƠN HÀNG</h1></header>
          
          <div v-if="!activePaymentOrder" class="card list-card">
             <h3>Chưa chọn đơn hàng cụ thể. Vui lòng nhấn nút "Thanh toán" tại danh sách các đơn hàng cần hoàn tất bên dưới:</h3>
             <table class="data-table" style="margin-top: 20px;">
                <thead>
                    <tr><th>ID</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Cần thanh toán</th><th>Vị trí hiện tại</th><th>Thao tác xử lý</th></tr>
                </thead>
                <tbody>
                    <tr v-for="order in unpaidOrders" :key="order.id">
                        <td>#{{ order.id }}</td>
                        <td>{{ order.product_name }}</td>
                        <td>{{ order.quantity }}</td>
                        <td class="txt-price">${{ order.total_cost }}</td>
                        <td><b style="color: #d35400;">{{ order.current_dept }}</b></td>
                        <td>
                           <button v-if="order.current_dept !== 'ACC' && order.payment_status !== 'PENDING'" @click="openPaymentGateway(order)" class="btn-pay-action">Tiến hành thanh toán</button>
                           <span v-else style="color: #27ae60; font-weight: bold; font-size: 13px;">⏳ Chờ KT duyệt tiền...</span>
                        </td>
                    </tr>
                    <tr v-if="unpaidOrders.length === 0">
                        <td colspan="6" class="txt-empty">🎉 Tuyệt vời! Bạn không có đơn hàng nào cần chờ thanh toán.</td>
                    </tr>
                </tbody>
             </table>
          </div>
  
          <div v-else class="card payment-card-main">
              <div class="payment-header-flex">
                 <h2>Thanh toán cho Đơn hàng #{{ activePaymentOrder.id }}</h2>
                 <div class="price-badge-large">Số tiền: ${{ activePaymentOrder.total_cost }}</div>
              </div>
              
              <div class="payment-layout-split">
                 <div class="method-selector-tabs">
                    <button @click="selectedMethod = 'TT'" :class="{'active-p-tab': selectedMethod === 'TT'}">Chuyển tiền T/T (Tỉ lệ 30/70)</button>
                    <button @click="selectedMethod = 'LC'" :class="{'active-p-tab': selectedMethod === 'LC'}">Tín dụng chứng từ L/C</button>
                    <button @click="selectedMethod = 'OA'" :class="{'active-p-tab': selectedMethod === 'OA'}">Ghi sổ Open Account (O/A)</button>
                    <button @click="selectedMethod = 'CAD'" :class="{'active-p-tab': selectedMethod === 'CAD'}">Tiền trao chứng từ CAD</button>
                 </div>
  
                 <div class="method-detail-view">
                    <div v-if="selectedMethod === 'TT'">
                       <h4>🏦 Phương thức Chuyển tiền bằng điện T/T (Telegraphic Transfer)</h4>
                       <p class="desc-p">Vui lòng tiến hành chia nhỏ thanh toán theo cam kết hợp đồng dịch vụ:</p>
                       <ul>
                         <li><strong>Giai đoạn 1:</strong> Trả cọc trước 30% ứng với số tiền: <b style="color: #e67e22;">${{ (activePaymentOrder.total_cost * 0.3).toFixed(2) }}</b> để kích hoạt bốc xếp hàng.</li>
                         <li><strong>Giai đoạn 2:</strong> Thanh toán nốt 70% còn lại (${{ (activePaymentOrder.total_cost * 0.7).toFixed(2) }}) ngay khi chúng tôi gửi bản Scan bộ chứng từ vận đơn gốc (Bill of Lading).</li>
                       </ul>
                       <p class="bank-info"><b>Hệ thống SWIFT Ngân hàng thụ hưởng:</b> LOGIVCBVNVX</p>
                    </div>
  
                    <div v-if="selectedMethod === 'LC'">
                       <h4>📜 Phương thức Tín dụng chứng từ (L/C - Letter of Credit)</h4>
                       <p class="desc-p">Phương thức thanh toán đảm bảo an toàn tuyệt đối cho thương mại quốc tế rộng khắp:</p>
                       <p>Ngân hàng đại diện của quý khách phát hành thư cam kết thanh toán không hủy ngang cho công ty Logistics. Chúng tôi sẽ thu tiền từ ngân hàng bảo lãnh sau khi nộp đủ bộ chứng từ giao hàng chuẩn xác, không có bất kỳ sai lệch nào so với điều kiện ghi trong L/C.</p>
                    </div>
  
                    <div v-if="selectedMethod === 'OA'">
                       <h4>📅 Phương thức Ghi sổ doanh nghiệp (Open Account - O/A)</h4>
                       <p class="desc-p">Cơ chế ưu đãi công nợ linh hoạt dành cho các thành viên đối tác liên kết:</p>
                       <p>Công ty Logistics hoàn thành toàn bộ dịch vụ giao nhận và bàn giao chứng từ gốc trước cho khách hàng. Quý khách hàng được quyền thanh toán trả sau vào thời điểm cam kết thỏa thuận trong tương lai <b>(Kỳ hạn 30, 45 hoặc 60 ngày sau khi thông quan)</b>.</p>
                    </div>
  
                    <div v-if="selectedMethod === 'CAD'">
                       <h4>💵 Tiền trao đổi chứng từ biên nhận (CAD - Cash Against Documents)</h4>
                       <p class="desc-p">Giao dịch chứng từ an toàn thông qua định chế ngân hàng trung gian:</p>
                       <p>Hàng hóa sẽ được chuyển đi bình thường, nhưng quý khách hàng chỉ được ngân hàng chỉ định bàn giao lại toàn bộ bộ chứng từ gốc xác lập quyền sở hữu hàng hóa để ra cảng lấy hàng sau khi quý khách đã hoàn tất việc thanh toán đủ tiền vào tài khoản ký quỹ.</p>
                    </div>
  
                    <div class="action-pay-group">
                       <button @click="executePayment" class="btn-confirm-pay">XÁC NHẬN THANH TOÁN TRANG NÀY</button>
                       <button @click="activePaymentOrder = null" class="btn-cancel-pay">HỦY BỎ</button>
                    </div>
                 </div>
              </div>
          </div>
        </div>
  
        <div v-if="currentTab === 'feedback'" class="tab-content-wrapper">
          <header><h1>⭐️ ĐÁNH GIÁ VÀ PHẢN HỒI DỊCH VỤ</h1></header>
          <div class="card list-card">
            <h3>✍️ Nhận xét đánh giá các chuyến vận tải đã hoàn thành</h3>
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>Tên hàng hóa</th><th>Số lượng</th><th>Trạng thái đơn</th><th>Đánh giá chất lượng của bạn</th></tr>
                </thead>
                <tbody>
                    <tr v-for="order in completedOrders" :key="order.id">
                        <td>#{{ order.id }}</td>
                        <td>{{ order.product_name }}</td>
                        <td>{{ order.quantity }}</td>
                        <td><span class="badge DELIVERED">{{ order.status }}</span></td>
                        <td>
                            <div v-if="order.rating" class="stars-done">
                               <span style="color: #f1c40f; font-weight: bold;">⭐ {{ order.rating }} / 5 Sao</span>
                               <p class="feedback-txt-review" v-if="order.feedback">"{{ order.feedback }}"</p>
                            </div>
                            <button v-else @click="openFeedbackPrompt(order.id)" class="btn-feedback">⭐ Bấm đánh giá ngay</button>
                        </td>
                    </tr>
                    <tr v-if="completedOrders.length === 0">
                        <td colspan="5" class="txt-empty">Chưa có đơn hàng nào hoàn thành giao (DELIVERED) cần được đánh giá chất lượng.</td>
                    </tr>
                </tbody>
            </table>
          </div>
        </div>
  
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed, watch } from 'vue';
  import axios from 'axios';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const userRole = ref('CUSTOMER');
  const orders = ref([]);
  const currentTab = ref('create');
  
  const customerName = ref('');
  const productName = ref('');
  const cargoType = ref('Standard');
  const quantity = ref(1);
  
  const activePaymentOrder = ref(null);
  const selectedMethod = ref('TT');
  const latestNotification = ref('');
  
  const currentProcessingOrders = computed(() => {
     return orders.value.filter(o => o.status !== 'DELIVERED' && o.status !== 'DONE' && o.status !== 'CANCELLED');
  });
  
  const historicalOrders = computed(() => {
     return orders.value.filter(o => o.status === 'DELIVERED' || o.status === 'DONE' || o.status === 'CANCELLED');
  });
  
  const unpaidOrders = computed(() => {
     return orders.value.filter(o => (!o.payment_method || o.current_dept === 'ACC') && o.status !== 'CANCELLED');
  });
  
  const completedOrders = computed(() => {
     return orders.value.filter(o => o.status === 'DELIVERED' || o.status === 'DONE');
  });
  
  const calculatedCost = computed(() => {
      const rate = cargoType.value === 'Dangerous' ? 120 : 50;
      return quantity.value * rate;
  });
  
  watch(orders, (newOrders, oldOrders) => {
      if (oldOrders && oldOrders.length > 0 && newOrders.length === oldOrders.length) {
          for(let i=0; i < newOrders.length; i++) {
              if(newOrders[i].status !== oldOrders[i].status || newOrders[i].current_dept !== oldOrders[i].current_dept) {
                  latestNotification.value = `Đơn hàng #${newOrders[i].id} đang nằm tại bộ phận [${newOrders[i].current_dept}] với trạng thái [${newOrders[i].status}]`;
                  break;
              }
          }
      }
  }, { deep: true });
  
  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/orders/customer');
      orders.value = res.data;
    } catch (error) {
      console.error("Lỗi kết nối API danh sách");
    }
  };
  
  const handleCreateOrder = async () => {
    if (!productName.value || !quantity.value) {
      alert("Vui lòng điền tên hàng và số lượng trước khi gửi!");
      return;
    }
  
    try {
      await axios.post('http://localhost:3000/api/orders', {
          customer_name: customerName.value,
          product_name: productName.value,
          quantity: quantity.value,
          cargo_type: cargoType.value
      });
      alert("Yêu cầu tạo đơn vận chuyển mới thành công!");
      productName.value = '';
      quantity.value = 1;
      fetchOrders();
      currentTab.value = 'current-orders';
    } catch (error) {
      alert("Lỗi máy chủ khi tạo đơn hàng!");
    }
  };
  
  const handleCancel = async (orderId) => {
      const reason = prompt("Lý do hủy đơn hàng này của bạn là gì?");
      if (reason === null) return;
      if (!reason.trim()) { alert("Bắt buộc phải ghi rõ lý do hủy!"); return; }
  
      try {
          const res = await axios.put(`http://localhost:3000/api/orders/${orderId}/cancel`, { reason });
          alert(res.data.message);
          fetchOrders();
      } catch (error) {
          alert(error.response?.data?.message || "Không thể hủy đơn!");
      }
  };
  
  const openPaymentGateway = (order) => {
      activePaymentOrder.value = order;
      currentTab.value = 'payment';
  };
  
  // ĐÃ SỬA ĐỒNG BỘ: Chuyển từ axios.put sang axios.post để khớp nối với customerController.payOrder
  const executePayment = async () => {
      try {
          const res = await axios.post(`http://localhost:3000/api/orders/${activePaymentOrder.value.id}/pay`, {
              method: selectedMethod.value
          });
          alert(res.data.message);
          activePaymentOrder.value = null;
          fetchOrders();
          currentTab.value = 'current-orders';
      } catch (error) {
          alert("Lỗi kết nối cổng thanh toán!");
      }
  };
  
  const openFeedbackPrompt = async (orderId) => {
      const rating = prompt("Nhập mức điểm dịch vụ (Từ 1 đến 5 sao):");
      if (!rating || rating < 1 || rating > 5) { alert("Mức điểm phải từ 1-5 sao!"); return; }
      const fbText = prompt("Để lại ý kiến nhận xét của bạn về kho hoặc vận chuyển:");
  
      try {
          await axios.put(`http://localhost:3000/api/orders/${orderId}/feedback`, {
              rating: parseInt(rating),
              feedback: fbText
          });
          alert("Gửi nhận xét phản hồi dịch vụ thành công!");
          fetchOrders();
      } catch (error) {
          alert("Lỗi gửi phản hồi!");
      }
  };
  
  onMounted(() => {
    if (!localStorage.getItem('role')) {
      router.push('/');
    } else {
      customerName.value = localStorage.getItem('username') || 'Khách hàng';
      fetchOrders();
      setInterval(fetchOrders, 4000);
    }
  });
  
  const logout = () => { localStorage.clear(); router.push('/'); };
  </script>
  
  <style scoped>
  .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
  .sidebar { width: 250px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; box-sizing: border-box; }
  .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; letter-spacing: 1px; }
  .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 15px; border-bottom: 1px solid #34495e; margin-bottom: 15px; }
  .avatar { width: 40px; height: 40px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
  .btn-logout { margin-top: auto; padding: 12px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  .btn-logout:hover { background: #a93226; }
  .main-content { flex: 1; padding: 35px; overflow-y: auto; background: #ffffff; }
  .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #eef2f5; }
  
  .navigation-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 15px; }
  .navigation-menu button {
    width: 100%; text-align: left; padding: 12px 15px; background: none; border: none;
    color: #ecf0f1; font-weight: 600; font-size: 14px; cursor: pointer; border-radius: 5px;
    transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;
  }
  .navigation-menu button:hover { background: #34495e; padding-left: 20px; color: #f1c40f; }
  .navigation-menu button.active-nav { background: #1a252f; color: #f1c40f; border-left: 4px solid #f1c40f; font-weight: bold; }
  
  .notification-box { padding: 12px; background: #34495e; border-radius: 6px; font-size: 12px; margin-bottom: 15px; line-height: 1.4; }
  .notification-box h4 { margin: 0 0 5px 0; color: #f1c40f; }
  
  .tab-content-wrapper header h1 { font-size: 24px; color: #2c3e50; font-weight: 800; margin-bottom: 25px; text-transform: uppercase; border-bottom: 2px solid #34495e; padding-bottom: 10px; }
  .form-card-full { max-width: 650px; margin-top: 10px; }
  .form-body-vertical { display: flex; flex-direction: column; gap: 20px; margin-top: 20px; }
  .form-group-vertical { display: flex; flex-direction: column; gap: 6px; }
  .form-group-vertical label { font-size: 14px; font-weight: bold; color: #34495e; }
  .form-group-vertical input, .form-group-vertical select { padding: 12px; border: 1px solid #ced4da; border-radius: 5px; font-size: 15px; font-family: inherit; outline: none; }
  .price-display-box { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #e8f4fd; border-radius: 6px; border: 1px solid #d4e6f1; font-weight: bold; font-size: 16px; color: #2980b9; }
  .cost-value { font-size: 22px; color: #27ae60; font-weight: 800; }
  .btn-submit-large { padding: 15px; background: #27ae60; color: white; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; transition: background 0.2s; }
  .btn-submit-large:hover { background: #219653; }
  
  .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  .data-table th, .data-table td { padding: 14px 18px; border-bottom: 1px solid #ecf0f1; text-align: left; }
  .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 13px; font-weight: bold; text-transform: uppercase; }
  .txt-price { font-weight: bold; color: #27ae60; }
  .txt-dept { font-weight: bold; color: #c0392b; }
  .txt-empty { text-align: center; color: #7f8c8d; padding: 30px !important; font-style: italic; }
  
  .badge { padding: 5px 12px; border-radius: 15px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .badge.NEW { background: #e8f5e9; color: #2e7d32; }
  .badge.APPROVED { background: #fff3cd; color: #856404; }
  .badge.PACKED { background: #e2f0fd; color: #0066cc; }
  .badge.DELIVERED { background: #d4edda; color: #155724; }
  .badge.CANCELLED { background: #fce4e4; color: #c62828; }
  
  .btn-cancel { padding: 6px 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; }
  .btn-pay-action { padding: 6px 12px; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px; }
  .btn-feedback { padding: 6px 12px; background: #9b59b6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; }
  .txt-pay-done { color: #27ae60; font-weight: bold; font-size: 13px; }
  
  .payment-card-main { max-width: 900px; }
  .payment-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
  .price-badge-large { font-size: 20px; font-weight: 800; color: #f39c12; background: #fef5e7; padding: 10px 20px; border-radius: 5px; border: 1px solid #fdebd0; }
  .payment-layout-split { display: flex; gap: 25px; }
  .method-selector-tabs { width: 260px; display: flex; flex-direction: column; gap: 10px; }
  .method-selector-tabs button { padding: 12px; background: #f8f9fa; border: 1px solid #e2e8f0; text-align: left; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 13px; color: #4a5568; }
  .method-selector-tabs button.active-p-tab { background: #f39c12; color: white; border-color: #f39c12; }
  .method-detail-view { flex: 1; background: #fafafa; border: 1px dashed #cbd5e1; padding: 20px; border-radius: 6px; }
  .action-pay-group { margin-top: 25px; display: flex; gap: 10px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  .btn-confirm-pay { padding: 12px 20px; background: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
  .btn-cancel-pay { padding: 12px 20px; background: #cbd5e1; color: #4a5568; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
  </style>