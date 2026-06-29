<template>
  <div class="dashboard-container">
    <div class="sidebar">
      <div class="brand">LOGISTICS PRO</div>
      <div class="user-info">
        <div class="avatar">{{ username.charAt(0) }}</div>
        <div>
           <h3>{{ username }}</h3>
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
               Lý do: {{ returnedOrderNotice.driver_notes || 'Chưa cập nhật lý do cụ thể.' }}
            </p>
         </div>
         <p v-else-if="latestNotification">{{ latestNotification }}</p>
         <p v-else style="color: #bdc3c7;">Chưa có biến động trạng thái.</p>
      </div>

      <div class="navigation-menu">
        <button :class="{'active-nav': currentTab === 'create'}" @click="currentTab = 'create'">
          ➕ Tạo đơn hàng mới
        </button>
        <button :class="{'active-nav': currentTab === 'list'}" @click="currentTab = 'list'">
          📦 Đơn hàng hiện tại
        </button>
        <button :class="{'active-nav': currentTab === 'history'}" @click="currentTab = 'history'">
          📜 Lịch sử đơn hàng & Đánh giá
        </button>
        <button :class="{'active-nav': currentTab === 'payment'}" @click="currentTab = 'payment'">
          💳 Cổng thanh toán hóa đơn
        </button>
      </div>

      <button @click="logout" class="btn-logout">Đăng Xuất</button>
    </div>

    <div class="main-content">
      
      <div v-if="currentTab === 'create'">
        <header>
          <h1>KHỞI TẠO YÊU CẦU VẬN CHUYỂN HÀNG HÓA KÝ GỬI</h1>
        </header>

        <div class="create-order-layout">
          <div class="price-table-card">
            <h3>📊 BẢNG GIÁ DỊCH VỤ VẬN CHUYỂN</h3>
            <p class="price-note">* Giá thực tế = Đơn giá loại hàng × Số lượng kiện</p>
            <table class="price-mini-table">
              <thead>
                <tr>
                  <th>Loại Hàng Hóa</th>
                  <th>Đơn Giá / Kiện</th>
                </tr>
              </thead>
              <tbody>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa thông thường'}">
                  <td>📦 Hàng thông thường</td>
                  <td class="price-tag-green">$100</td>
                </tr>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa điện tử'}">
                  <td>⚡ Hàng điện tử</td>
                  <td class="price-tag-green">$250</td>
                </tr>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa nguy hiểm'}">
                  <td>☣️ Hàng nguy hiểm</td>
                  <td class="price-tag-green">$180</td>
                </tr>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa nhanh'}">
                  <td>🚀 Hàng hỏa tốc</td>
                  <td class="price-tag-green">$400</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="form-card">
            <h3>📝 Thông tin tờ khai hàng hóa</h3>
            <form @submit.prevent="createOrder" class="grid-form">
              <div class="form-group">
                <label>Tên khách hàng / Đối tác doanh nghiệp:</label>
                <input type="text" v-model="newOrder.customer_name" required placeholder="Nhập tên công ty..." />
              </div>

              <div class="form-group">
                <label>Tên mặt hàng cần vận chuyển:</label>
                <input type="text" v-model="newOrder.product_name" required placeholder="Ví dụ: Thùng gỗ linh kiện..." />
              </div>

              <div class="form-group">
                <label>Phân loại nhóm hàng hóa:</label>
                <select v-model="newOrder.cargo_type" @change="calculateEstimatedPrice">
                  <option value="Hàng hóa thông thường">📦 Hàng hóa thông thường</option>
                  <option value="Hàng hóa điện tử">⚡ Hàng hóa điện tử</option>
                  <option value="Hàng hóa nguy hiểm">☣️ Hàng hóa nguy hiểm</option>
                  <option value="Hàng hóa nhanh">🚀 Hàng hóa nhanh</option>
                </select>
              </div>

              <div class="form-group">
                <label>Số lượng kiện hàng (Pcs):</label>
                <input type="number" v-model.number="newOrder.quantity" min="1" required @input="calculateEstimatedPrice" />
              </div>

              <div class="form-group full-width">
                <label>Hình ảnh thực tế hàng hóa:</label>
                <input type="file" accept="image/*" required @change="onProductImageChange" class="file-input-styled" />
              </div>

              <div class="price-estimate-box full-width">
                <span>Ước tính chi phí vận chuyển: </span>
                <strong style="color: #e67e22; font-size: 18px;">{{ formatCurrency(estimatedPrice) }}</strong>
              </div>

              <button type="submit" class="btn-submit full-width">🚀 Gửi yêu cầu tiếp nhận</button>
            </form>
          </div>
        </div>
      </div>

      <div v-if="currentTab === 'list'">
        <header>
          <h1>DANH SÁCH ĐƠN HÀNG VẬN HÀNH HIỆN TẠI</h1>
        </header>
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Hình Ảnh</th>
                <th>Mặt Hàng</th>
                <th>Phân Loại</th>
                <th>Số Lượng</th>
                <th>Tổng Tiền</th>
                <th>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in activeOrders" :key="order.id">
                <td><b class="order-tag">#{{ order.id }}</b></td>
                <td>
                  <img v-if="order.product_image" :src="'http://localhost:3000' + order.product_image" class="table-img-preview" alt="Hàng hóa" />
                  <span v-else style="color: #95a5a6; font-style: italic; font-size: 12px;">Không có ảnh</span>
                </td>
                <td><b>{{ order.product_name }}</b><br><small style="color: #7f8c8d;">Khách: {{ order.customer_name }}</small></td>
                <td><span class="type-badge">{{ order.cargo_type || 'Hàng hóa thông thường' }}</span></td>
                <td>{{ order.quantity }} pcs</td>
                <td><b style="color: #2c3e50;">{{ formatCurrency(getOrderPrice(order)) }}</b></td>
                <td>
                  <span :class="'status-badge ' + (order.status ? order.status.toLowerCase() : 'new')">
                    {{ translateStatus(order.status) }}
                  </span>
                </td>
              </tr>
              <tr v-if="activeOrders.length === 0">
                <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 20px;">Không có đơn hàng nào đang trong quá trình xử lý.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="currentTab === 'history'">
        <header>
          <h1>LỊCH SỬ ĐƠN HÀNG ĐÃ GIAO NHẬN THÀNH CÔNG</h1>
        </header>
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Mặt Hàng</th>
                <th>Phân Loại</th>
                <th>Tổng Tiền</th>
                <th>Trạng Thái</th>
                <th>Đánh Giá Dịch Vụ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in completedOrders" :key="order.id">
                <td><b class="order-tag">#{{ order.id }}</b></td>
                <td><b>{{ order.product_name }}</b></td>
                <td><span class="type-badge">{{ order.cargo_type || 'Hàng hóa thông thường' }}</span></td>
                <td><b>{{ formatCurrency(getOrderPrice(order)) }}</b></td>
                <td><span class="status-badge done">🏁 HOÀN THÀNH</span></td>
                <td>
                  <div v-if="order.rating">
                    <span class="stars-display">{{ '⭐'.repeat(order.rating) }}</span>
                    <p class="feedback-txt-preview" v-if="order.feedback">💬 {{ order.feedback }}</p>
                  </div>
                  <button v-else @click="openFeedbackModal(order)" class="btn-review-trigger">
                    ⭐ Viết đánh giá
                  </button>
                </td>
              </tr>
              <tr v-if="completedOrders.length === 0">
                <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Chưa có đơn hàng nào hoàn thành chuỗi cung ứng logistics.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="currentTab === 'payment'">
        <header>
          <h1>CỔNG THANH TOÁN HÓA ĐƠN ĐIỀU PHỐI VẬN TẢI</h1>
        </header>
        <div class="payment-layout">
          <div class="card payment-card-main">
            <h3>💳 Các hóa đơn đang chờ quyết toán cước phí</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã Đơn</th>
                  <th>Mặt Hàng</th>
                  <th>Phân Loại</th>
                  <th>Thành Tiền</th>
                  <th>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in unpaidOrders" :key="order.id" :class="{'selected-payment-row': selectedOrderForPay && selectedOrderForPay.id === order.id}">
                  <td><b class="order-tag">#{{ order.id }}</b></td>
                  <td>{{ order.product_name }}</td>
                  <td><small class="type-badge">{{ order.cargo_type || 'Hàng hóa thông thường' }}</small></td>
                  <td><b class="price-txt">{{ formatCurrency(getOrderPrice(order)) }}</b></td>
                  <td>
                    <button @click="selectOrderToPay(order)" class="btn-pay-action">
                      💸 Chọn thanh toán
                    </button>
                  </td>
                </tr>
                <tr v-if="unpaidOrders.length === 0">
                  <td colspan="5" style="text-align: center; color: #7f8c8d; padding: 20px;">Không có hóa đơn tồn đọng.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="qr-payment-box" v-if="selectedOrderForPay && selectedOrderForPay.id">
            <h3>📥 THÔNG TIN CHUYỂN KHOẢN QUA QR CODE</h3>
            <div class="qr-card-body">
              <p>Mã hóa đơn: <b>#{{ selectedOrderForPay.id }}</b></p>
              <p>Loại hàng: <span class="type-badge">{{ selectedOrderForPay.cargo_type || 'Hàng hóa thông thường' }}</span></p>
              <p>Số tiền: <b style="color: #e74c3c; font-size: 16px;">{{ formatCurrency(getOrderPrice(selectedOrderForPay)) }}</b></p>
              
              <div class="qr-container">
                <img :src="generateQRUrl(selectedOrderForPay)" alt="Mã QR" class="qr-image" />
                <div class="qr-scan-guide">Mở ứng dụng Ngân hàng quét để thanh toán nhanh</div>
              </div>

              <button @click="mockConfirmPayment(selectedOrderForPay.id)" class="btn-confirm-payment">
                ✓ Tôi đã hoàn tất chuyển khoản
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div v-if="showReviewModal" class="review-modal-backdrop">
      <div class="review-modal-box">
        <div class="modal-header-review">
          <h3>✍️ ĐÁNH GIÁ ĐƠN HÀNG #{{ activeReviewOrder.id }}</h3>
          <button @click="closeFeedbackModal" class="close-review-btn">&times;</button>
        </div>
        <div class="modal-body-review">
          <label class="block-label">Mức độ hài lòng của bạn:</label>
          <div class="stars-selector-row">
            <span v-for="star in 5" :key="star" @click="feedbackRating = star" class="star-clickable">
              {{ star <= feedbackRating ? '★' : '☆' }}
            </span>
          </div>
          
          <label class="block-label">Nội dung phản hồi góp ý:</label>
          <textarea v-model="feedbackText" placeholder="Hãy để lại ý kiến..." rows="4" class="review-textarea"></textarea>
          
          <button @click="submitOrderFeedback" class="btn-send-review">🚀 Gửi đánh giá dịch vụ</button>
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
const username = ref(localStorage.getItem('username') || 'Khách hàng');
const currentTab = ref('create');

const orders = ref([]);
const estimatedPrice = ref(100); 
const selectedOrderForPay = ref(null);
const productImageFile = ref(null);

const showReviewModal = ref(false);
const activeReviewOrder = ref(null);
const feedbackRating = ref(5);
const feedbackText = ref('');

let customerInterval = null;
const returnedOrderNotice = ref(null);
const latestNotification = ref('');

const newOrder = ref({
  customer_name: '',
  product_name: '',
  cargo_type: 'Hàng hóa thông thường',
  quantity: 1
});

// Chuyển đổi toàn bộ bảng giá dịch vụ logistics sang USD ($)
const priceRates = {
  'Hàng hóa thông thường': 100,
  'Hàng hóa điện tử': 250,
  'Hàng hóa nguy hiểm': 180,
  'Hàng hóa nhanh': 400
};

// HÀM XỬ LÝ LỖI ĐƠN CŨ BỊ MẤT GIÁ TIỀN:
const getOrderPrice = (order) => {
  if (order.total_price && order.total_price > 0 && order.total_price < 100000) {
    return order.total_price;
  }
  const rate = priceRates[order.cargo_type] || 100;
  const qty = order.quantity || 1;
  return rate * qty;
};

const activeOrders = computed(() => {
  return orders.value.filter(o => o.status !== 'DONE');
});

const completedOrders = computed(() => {
  return orders.value.filter(o => o.status === 'DONE');
});

const unpaidOrders = computed(() => {
  return orders.value.filter(o => o.status === 'NEW' || o.status === 'APPROVED' || o.status === 'WMS' || o.status === 'TMS');
});

const calculateEstimatedPrice = () => {
  const rate = priceRates[newOrder.value.cargo_type] || 100;
  const qty = newOrder.value.quantity || 1;
  estimatedPrice.value = rate * qty;
};

const onProductImageChange = (e) => {
  if (e.target.files && e.target.files[0]) {
    productImageFile.value = e.target.files[0];
  }
};

const fetchOrders = async () => {
  try {
    const res = await axios.get(`http://localhost:3000/api/orders/customer?username=${username.value}`);
    orders.value = res.data;
    
    const returned = res.data.find(o => o.status === 'RETURNED');
    returnedOrderNotice.value = returned || null;
  } catch (error) {
    console.error("Lỗi lấy danh sách đơn hàng:", error);
  }
};

const createOrder = async () => {
  if (!productImageFile.value) {
    alert("⚠️ Vui lòng tải lên hình ảnh thực tế của hàng hóa để tạo tờ khai bến bãi!");
    return;
  }

  const formData = new FormData();
  formData.append('username', username.value);
  formData.append('customer_name', newOrder.value.customer_name);
  formData.append('product_name', newOrder.value.product_name);
  formData.append('cargo_type', newOrder.value.cargo_type);
  formData.append('quantity', newOrder.value.quantity);
  
  const rate = priceRates[newOrder.value.cargo_type] || 100;
  formData.append('total_price', rate * newOrder.value.quantity);
  formData.append('product_image', productImageFile.value); 

  try {
    await axios.post('http://localhost:3000/api/orders', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    alert("🚀 Khởi tạo yêu cầu ký gửi hàng hóa thành công!");
    
    newOrder.value = { customer_name: '', product_name: '', cargo_type: 'Hàng hóa thông thường', quantity: 1 };
    productImageFile.value = null;
    const fileInput = document.querySelector('.file-input-styled');
    if (fileInput) fileInput.value = ''; 
    
    calculateEstimatedPrice();
    fetchOrders();
    currentTab.value = 'list';
  } catch (err) {
    console.error("Lỗi gửi dữ liệu Multipart:", err);
    alert("Lỗi khi gửi đơn hàng lên hệ thống!");
  }
};

const openFeedbackModal = (order) => {
  activeReviewOrder.value = order;
  feedbackRating.value = 5;
  feedbackText.value = '';
  showReviewModal.value = true;
};

const closeFeedbackModal = () => {
  showReviewModal.value = false;
  activeReviewOrder.value = null;
};

const submitOrderFeedback = async () => {
  if (!activeReviewOrder.value) return;
  try {
    await axios.post(`http://localhost:3000/api/orders/${activeReviewOrder.value.id}/feedback`, {
      rating: feedbackRating.value,
      feedback: feedbackText.value
    });
    alert("✓ Cảm ơn bạn đã gửi phản hồi dịch vụ!");
    closeFeedbackModal();
    fetchOrders();
  } catch (err) {
    alert("Không thể gửi đánh giá, xin hãy thử lại sau!");
  }
};

const selectOrderToPay = (order) => {
  if (order && order.id) {
    selectedOrderForPay.value = order;
  }
};

const generateQRUrl = (order) => {
  if (!order || !order.id) return '';
  const bankId = "MB"; 
  const accountNo = "099999999999"; 
  const template = "qr_only";
  const amountUsd = getOrderPrice(order);
  const amountVnd = amountUsd * 25000; 
  const description = `Thanh toan don hang ${order.id}`;
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amountVnd}&addInfo=${encodeURIComponent(description)}`;
};

const mockConfirmPayment = async (orderId) => {
  if (!orderId || isNaN(orderId)) return;
  try {
    await axios.put(`http://localhost:3000/api/orders/${orderId}/pay`);
    alert("✓ Đã gửi yêu cầu xác nhận thanh toán thành công!");
    selectedOrderForPay.value = null;
    fetchOrders();
  } catch (err) {
    alert("Thao tác thất bại!");
  }
};

const translateStatus = (status) => {
  const dict = {
    'NEW': '⏳ Đợi duyệt đơn',
    'APPROVED': '✅ Điều độ tiếp nhận',
    'WMS': '🏬 Đang ở phòng Kho',
    'PACKED': '📦 Đã đóng gói',
    'TMS': '🚛 Đang vận chuyển',
    'DONE': '🏁 Hoàn thành',
    'RETURNED': '⚠️ Bị hoàn trả'
  };
  return dict[status] || '⏳ Đợi duyệt đơn';
};

const formatCurrency = (val) => {
  if (!val) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

const logout = () => {
  localStorage.clear();
  router.push('/');
};

onMounted(() => {
  if (!localStorage.getItem('role')) {
    router.push('/');
  } else {
    fetchOrders();
    customerInterval = setInterval(fetchOrders, 5000);
  }
});

onUnmounted(() => {
  if (customerInterval) clearInterval(customerInterval);
});
</script>

<style scoped>
.dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f4f6f9; }
.sidebar { width: 260px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; flex-shrink: 0; }
.brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; color: #ecf0f1; }
.user-info { display: flex; align-items: center; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid #34495e; margin-bottom: 15px; }
.avatar { width: 45px; height: 45px; background: #3498db; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
.notification-box { background: #34495e; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; border-left: 4px solid #f1c40f; }
.notification-box h4 { margin: 0 0 6px 0; color: #ecf0f1; }
.navigation-menu { display: flex; flex-direction: column; gap: 10px; }
.navigation-menu button { padding: 12px; text-align: left; background: none; border: none; color: #bdc3c7; font-weight: bold; cursor: pointer; border-radius: 4px; }
.navigation-menu button:hover, .navigation-menu button.active-nav { background: #1a252f; color: white; }
.btn-logout { margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

.main-content { flex: 1; padding: 30px; overflow-y: auto; }
header h1 { font-size: 24px; font-weight: 800; color: #2c3e50; margin-bottom: 25px; border-left: 5px solid #2980b9; padding-left: 10px; }
.card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }

.create-order-layout { display: flex; gap: 25px; align-items: flex-start; }
.price-table-card { width: 320px; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; flex-shrink: 0; }
.price-table-card h3 { margin-top: 0; color: #2c3e50; font-size: 15px; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; }
.price-note { font-size: 11px; color: #7f8c8d; font-style: italic; margin-bottom: 12px; }
.price-mini-table { width: 100%; border-collapse: collapse; }
.price-mini-table th, .price-mini-table td { padding: 10px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
.price-mini-table th { background: #f8fafc; color: #64748b; font-weight: bold; text-align: left; }
.price-tag-green { color: #27ae60; font-weight: bold; text-align: right; }
.highlight-row { background-color: #f0fdf4; font-weight: bold; border-left: 3px solid #22c55e; }

.form-card { flex: 1; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
.form-card h3 { margin-top: 0; color: #2c3e50; font-size: 15px; border-bottom: 2px solid #edf2f7; padding-bottom: 10px; }
.grid-form { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 13px; font-weight: 600; color: #4a5568; }
.form-group input, .form-group select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px; background: #fff; }
.file-input-styled { background: #f8fafc; padding: 8px; border: 1px dashed #cbd5e1; cursor: pointer; }
.full-width { grid-column: span 2; }
.price-estimate-box { background: #fff9db; padding: 12px; border-radius: 4px; border: 1px solid #ffe3e3; font-weight: bold; text-align: right; }
.btn-submit { background: #27ae60; color: white; border: none; padding: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
.data-table th { background: #f8fafc; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold; }
.order-tag { background: #e2e8f0; color: #4a5568; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
.type-badge { background: #eff6ff; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; }
.table-img-preview { width: 60px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0; }
.status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
.status-badge.new { background: #fef3c7; color: #d97706; }
.status-badge.approved { background: #e0f2fe; color: #0369a1; }
.status-badge.returned { background: #fee2e2; color: #dc2626; border: 1px dashed #ef4444; }
.status-badge.done { background: #dcfce7; color: #15803d; }

.btn-review-trigger { padding: 6px 12px; background: #e67e22; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer; }
.stars-display { color: #f1c40f; font-size: 16px; letter-spacing: 2px; font-weight: bold; }
.feedback-txt-preview { margin: 4px 0 0 0; font-size: 12px; color: #555; font-style: italic; }

.payment-layout { display: flex; gap: 20px; align-items: flex-start; }
.payment-card-main { flex: 1; }
.selected-payment-row { background-color: #f1f5f9; }
.btn-pay-action { background: #f39c12; color: white; border: none; padding: 6px 12px; font-size: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; }
.qr-payment-box { width: 360px; background: white; border-radius: 8px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); border: 1px solid #cbd5e1; text-align: center; }
.qr-payment-box h3 { margin-top: 0; color: #2c3e50; font-size: 14px; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; }
.qr-card-body p { margin: 6px 0; font-size: 13px; text-align: left; }
.qr-container { background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 6px; margin: 15px 0; }
.qr-image { width: 190px; height: 190px; object-fit: contain; margin: 0 auto; display: block; }
.qr-scan-guide { font-size: 11px; color: #7f8c8d; font-style: italic; margin-top: 10px; }
.btn-confirm-payment { width: 100%; background: #2980b9; color: white; border: none; padding: 10px; font-weight: bold; border-radius: 4px; cursor: pointer; }

.review-modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.review-modal-box { background: white; width: 420px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; animation: fadeIn 0.2s ease-out; }
.modal-header-review { background: #2c3e50; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; }
.modal-header-review h3 { margin: 0; font-size: 14px; letter-spacing: 0.5px; }
.close-review-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; line-height: 1; }
.modal-body-review { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.block-label { font-size: 13px; font-weight: bold; color: #34495e; }
.stars-selector-row { display: flex; gap: 8px; font-size: 30px; color: #f1c40f; justify-content: center; margin: 5px 0; }
.star-clickable { cursor: pointer; user-select: none; transition: transform 0.1s; }
.star-clickable:hover { transform: scale(1.2); }
.review-textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; resize: none; box-sizing: border-box; }
.btn-send-review { background: #27ae60; color: white; border: none; padding: 12px; font-weight: bold; border-radius: 4px; cursor: pointer; transition: 0.2s; font-size: 14px; }
.btn-send-review:hover { background: #219653; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
</style>