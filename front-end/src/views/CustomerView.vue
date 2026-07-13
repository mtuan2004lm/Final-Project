<template>
  <div class="dashboard-container">
    <div class="sidebar">
      <div class="brand">LOGISTICS PRO</div>
      <div class="user-info">
        <div class="avatar">{{ username.charAt(0) }}</div>
        <div>
           <h3>{{ username }}</h3>
           <small>Online</small>
        </div>
      </div>

      <div class="notification-box">
         <h4>🔔 System Notifications</h4>
         <div v-if="returnedOrderNotice">
            <p style="color: #ff7675; font-weight: bold; margin-bottom: 4px; font-size: 13px;">
               ⚠️ Order #{{ returnedOrderNotice.id }} has been returned!
            </p>
            <p style="color: #f1c40f; font-size: 12px; font-style: italic; margin-top: 0; line-height: 1.4; max-height: 60px; overflow-y: auto;">
               Reason: {{ returnedOrderNotice.driver_notes || 'No specific reason provided yet.' }}
            </p>
         </div>
         <p v-else-if="latestNotification">{{ latestNotification }}</p>
         <p v-else style="color: #bdc3c7;">No status changes yet.</p>
      </div>

      <div class="navigation-menu">
        <button :class="{'active-nav': currentTab === 'create'}" @click="currentTab = 'create'">
          ➕ Create New Order
        </button>
        <button :class="{'active-nav': currentTab === 'list'}" @click="currentTab = 'list'">
          📦 Current Orders
        </button>
        <button :class="{'active-nav': currentTab === 'history'}" @click="currentTab = 'history'">
          📜 Order History & Reviews
        </button>
        <button :class="{'active-nav': currentTab === 'payment'}" @click="currentTab = 'payment'">
          💳 Invoice Payment Gateway
        </button>
      </div>

      <button @click="logout" class="btn-logout">Log Out</button>
    </div>

    <div class="main-content">

      <div v-if="currentTab === 'create'">
        <header>
          <h1>CREATE CONSIGNMENT SHIPPING REQUEST</h1>
        </header>

        <div class="create-order-layout">
          <div class="price-table-card">
            <h3>📊 SHIPPING SERVICE PRICE LIST</h3>
            <p class="price-note">* Actual price = Unit price by cargo type × Number of packages</p>
            <table class="price-mini-table">
              <thead>
                <tr>
                  <th>Cargo Type</th>
                  <th>Unit Price / Package</th>
                </tr>
              </thead>
              <tbody>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa thông thường'}">
                  <td>📦 Regular Goods</td>
                  <td class="price-tag-green">$100</td>
                </tr>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa điện tử'}">
                  <td>⚡ Electronics</td>
                  <td class="price-tag-green">$250</td>
                </tr>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa nguy hiểm'}">
                  <td>☣️ Hazardous Goods</td>
                  <td class="price-tag-green">$180</td>
                </tr>
                <tr :class="{'highlight-row': newOrder.cargo_type === 'Hàng hóa nhanh'}">
                  <td>🚀 Express Goods</td>
                  <td class="price-tag-green">$400</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="form-card">
            <h3>📝 Cargo Declaration Information</h3>
            <form @submit.prevent="createOrder" class="grid-form">
              <div class="form-group">
                <label>Customer Name / Business Partner:</label>
                <input type="text" v-model="newOrder.customer_name" required placeholder="Enter company name..." />
              </div>

              <div class="form-group">
                <label>Product Name to Ship:</label>
                <input type="text" v-model="newOrder.product_name" required placeholder="E.g.: Wooden crate of components..." />
              </div>

              <div class="form-group">
                <label>Cargo Category:</label>
                <select v-model="newOrder.cargo_type" @change="calculateEstimatedPrice">
                  <option value="Hàng hóa thông thường">📦 Regular Goods</option>
                  <option value="Hàng hóa điện tử">⚡ Electronics</option>
                  <option value="Hàng hóa nguy hiểm">☣️ Hazardous Goods</option>
                  <option value="Hàng hóa nhanh">🚀 Express Goods</option>
                </select>
              </div>

              <div class="form-group">
                <label>Number of Packages (Pcs):</label>
                <input type="number" v-model.number="newOrder.quantity" min="1" required @input="calculateEstimatedPrice" />
              </div>

              <div class="form-group full-width">
                <label>Actual Cargo Image:</label>
                <input type="file" accept="image/*" required @change="onProductImageChange" class="file-input-styled" />
              </div>

              <div class="price-estimate-box full-width">
                <span>Estimated shipping cost: </span>
                <strong style="color: #e67e22; font-size: 18px;">{{ formatCurrency(estimatedPrice) }}</strong>
              </div>

              <button type="submit" class="btn-submit full-width">🚀 Submit Request</button>
            </form>
          </div>
        </div>
      </div>

      <div v-if="currentTab === 'list'">
        <header>
          <h1>CURRENT OPERATIONAL ORDER LIST</h1>
        </header>
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Image</th>
                <th>Product</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Vehicle Location (Real-Time)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in activeOrders" :key="order.id">
                <td><b class="order-tag">#{{ order.id }}</b></td>
                <td>
                  <img v-if="order.product_image" :src="'http://localhost:3000' + order.product_image" class="table-img-preview" alt="Cargo" />
                  <span v-else style="color: #95a5a6; font-style: italic; font-size: 12px;">No image</span>
                </td>
                <td><b>{{ order.product_name }}</b><br><small style="color: #7f8c8d;">Customer: {{ order.customer_name }}</small></td>
                <td><span class="type-badge">{{ order.cargo_type || 'Hàng hóa thông thường' }}</span></td>
                <td>{{ order.quantity }} pcs</td>
                <td><b style="color: #2c3e50;">{{ formatCurrency(getOrderPrice(order)) }}</b></td>
                <td>
                  <span :class="'status-badge ' + (order.status ? order.status.toLowerCase() : 'new')">
                    {{ translateStatus(order.status) }}
                  </span>
                </td>
                <!-- Vị trí xe: cố định theo toạ độ demo (Greenwich Việt Nam), không dùng GPS thật -->
                <td>
                  <div v-if="order.status === 'SHIPPING'" class="live-map-cell">
                    <iframe
                      :src="getMapEmbedUrl(DEMO_LAT, DEMO_LNG)"
                      class="mini-map-frame"
                      loading="lazy"
                      referrerpolicy="no-referrer-when-downgrade">
                    </iframe>
                    <a :href="getGoogleMapsUrl(DEMO_LAT, DEMO_LNG)" target="_blank" class="map-link-full">
                      🔗 Open Full Map
                    </a>
                    <small class="gps-updated-txt">📍 Greenwich Vietnam</small>
                  </div>
                  <span v-else style="color: #95a5a6; font-style: italic; font-size: 12px;">
                    Not yet shipped
                  </span>
                </td>
              </tr>
              <tr v-if="activeOrders.length === 0">
                <td colspan="8" style="text-align: center; color: #7f8c8d; padding: 20px;">There are no orders currently being processed.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="currentTab === 'history'">
        <header>
          <h1>HISTORY OF SUCCESSFULLY DELIVERED ORDERS</h1>
        </header>
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order Code</th>
                <th>Product</th>
                <th>Category</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Service Rating</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in completedOrders" :key="order.id">
                <td><b class="order-tag">#{{ order.id }}</b></td>
                <td><b>{{ order.product_name }}</b></td>
                <td><span class="type-badge">{{ order.cargo_type || 'Hàng hóa thông thường' }}</span></td>
                <td><b>{{ formatCurrency(getOrderPrice(order)) }}</b></td>
                <td><span class="status-badge done">🏁 COMPLETED</span></td>
                <td>
                  <div v-if="order.rating">
                    <span class="stars-display">{{ '⭐'.repeat(order.rating) }}</span>
                    <p class="feedback-txt-preview" v-if="order.feedback">💬 {{ order.feedback }}</p>
                  </div>
                  <button v-else @click="openFeedbackModal(order)" class="btn-review-trigger">
                    ⭐ Write a Review
                  </button>
                </td>
              </tr>
              <tr v-if="completedOrders.length === 0">
                <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">No orders have completed the logistics supply chain yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="currentTab === 'payment'">
        <header>
          <h1>TRANSPORT DISPATCH INVOICE PAYMENT GATEWAY</h1>
        </header>
        <div class="payment-layout">
          <div class="card payment-card-main">
            <h3>💳 Invoices Pending Freight Settlement</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Order Code</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Action</th>
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
                      💸 Select to Pay
                    </button>
                  </td>
                </tr>
                <tr v-if="unpaidOrders.length === 0">
                  <td colspan="5" style="text-align: center; color: #7f8c8d; padding: 20px;">No outstanding invoices.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="qr-payment-box" v-if="selectedOrderForPay && selectedOrderForPay.id">
            <h3>📥 QR CODE BANK TRANSFER INFORMATION</h3>
            <div class="qr-card-body">
              <p>Invoice Code: <b>#{{ selectedOrderForPay.id }}</b></p>
              <p>Cargo Type: <span class="type-badge">{{ selectedOrderForPay.cargo_type || 'Hàng hóa thông thường' }}</span></p>
              <p>Amount: <b style="color: #e74c3c; font-size: 16px;">{{ formatCurrency(getOrderPrice(selectedOrderForPay)) }}</b></p>

              <div class="qr-container">
                <img :src="generateQRUrl(selectedOrderForPay)" alt="QR Code" class="qr-image" />
                <div class="qr-scan-guide">Open your Banking app to scan and pay quickly</div>
              </div>

              <button @click="mockConfirmPayment(selectedOrderForPay.id)" class="btn-confirm-payment">
                ✓ I have completed the transfer
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div v-if="showReviewModal" class="review-modal-backdrop">
      <div class="review-modal-box">
        <div class="modal-header-review">
          <h3>✍️ REVIEW ORDER #{{ activeReviewOrder.id }}</h3>
          <button @click="closeFeedbackModal" class="close-review-btn">&times;</button>
        </div>
        <div class="modal-body-review">
          <label class="block-label">Your satisfaction level:</label>
          <div class="stars-selector-row">
            <span v-for="star in 5" :key="star" @click="feedbackRating = star" class="star-clickable">
              {{ star <= feedbackRating ? '★' : '☆' }}
            </span>
          </div>

          <label class="block-label">Feedback content:</label>
          <textarea v-model="feedbackText" placeholder="Please leave your feedback..." rows="4" class="review-textarea"></textarea>

          <button @click="submitOrderFeedback" class="btn-send-review">🚀 Submit Service Review</button>
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
const username = ref(localStorage.getItem('username') || 'Customer');
const currentTab = ref('create');

// MỚI: toạ độ GPS cố định hiển thị cho khách hàng (theo yêu cầu), thay vì lấy
// vị trí thật của xe (truck_lat/truck_lng) - dùng cho mục đích demo/thuyết trình.
// Toạ độ: Greenwich Việt Nam (https://maps.app.goo.gl/1mG1ag771B56wEsv8)
const DEMO_LAT = 10.8034069;
const DEMO_LNG = 106.6524529;

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

// ĐÃ SỬA: Sau khi tài xế nộp E-POD, backend (tmsController.submitDriverPod) chuyển
// đơn sang status = 'DELIVERED' (đồng thời current_dept = 'ACC' để phòng Kế toán
// đối soát chi phí nội bộ). Với khách hàng, hàng đã giao tới nơi tức là hoàn thành
// rồi, không cần đợi Kế toán duyệt xong mới hiện "hoàn thành" -> tính luôn
// 'DELIVERED' là completed để hiện đúng ở tab Lịch sử + cho phép đánh giá dịch vụ.
const activeOrders = computed(() => {
  return orders.value.filter(o => o.status !== 'DONE' && o.status !== 'DELIVERED');
});

const completedOrders = computed(() => {
  return orders.value.filter(o => o.status === 'DONE' || o.status === 'DELIVERED');
});

// ĐÃ SỬA LỖI: bản cũ lọc theo o.status === 'WMS' / 'TMS', nhưng 'WMS' và 'TMS'
// không bao giờ là giá trị thật của cột status (chỉ NEW/APPROVED/PACKED/SHIPPING/
// DELIVERED/DONE/RETURNED) - đó là giá trị của current_dept. Vì vậy đơn ở PACKED
// hoặc SHIPPING (chưa thanh toán) không bao giờ lọt vào đây. Đổi sang kiểm tra
// đúng cột payment_status (khớp với cách AccView/accController đang dùng).
const unpaidOrders = computed(() => {
  return orders.value.filter(o =>
    o.payment_status !== 'PAID' &&
    o.status !== 'RETURNED' &&
    o.status !== 'DONE'
  );
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
    console.error("Error fetching order list:", error);
  }
};

const createOrder = async () => {
  if (!productImageFile.value) {
    alert("⚠️ Please upload an actual image of the cargo to create the yard declaration!");
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
    alert("🚀 Consignment request created successfully!");

    newOrder.value = { customer_name: '', product_name: '', cargo_type: 'Hàng hóa thông thường', quantity: 1 };
    productImageFile.value = null;
    const fileInput = document.querySelector('.file-input-styled');
    if (fileInput) fileInput.value = '';

    calculateEstimatedPrice();
    fetchOrders();
    currentTab.value = 'list';
  } catch (err) {
    console.error("Error sending multipart data:", err);
    alert("Error submitting the order to the system!");
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
    alert("✓ Thank you for submitting your service feedback!");
    closeFeedbackModal();
    fetchOrders();
  } catch (err) {
    alert("Unable to submit the review, please try again later!");
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
  const accountNo = "0902510519"; // Đã cập nhật số tài khoản MB Bank thật
  const template = "qr_only";
  const amountUsd = getOrderPrice(order);
  const amountVnd = amountUsd * 25000;
  const description = `Payment for order ${order.id}`;
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amountVnd}&addInfo=${encodeURIComponent(description)}`;
};

const mockConfirmPayment = async (orderId) => {
  if (!orderId || isNaN(orderId)) return;
  try {
    await axios.put(`http://localhost:3000/api/orders/${orderId}/pay`);
    alert("✓ Payment confirmation request sent successfully!");
    selectedOrderForPay.value = null;
    fetchOrders();
  } catch (err) {
    alert("Operation failed!");
  }
};

// ĐÃ SỬA: Thêm nhãn cho 'SHIPPING' và 'DELIVERED' (trước đây thiếu, bị rơi vào
// nhãn mặc định "Đợi duyệt đơn" rất dễ gây hiểu lầm cho khách hàng).
const translateStatus = (status) => {
  const dict = {
    'NEW': '⏳ Awaiting Approval',
    'APPROVED': '✅ Dispatched for Processing',
    'WMS': '🏬 At Warehouse',
    'PACKED': '📦 Packed',
    'TMS': '🚛 In Transit',
    'SHIPPING': '🚛 In Transit',
    'DELIVERED': '🏁 Delivered Successfully',
    'DONE': '🏁 Completed',
    'RETURNED': '⚠️ Returned'
  };
  return dict[status] || '⏳ Awaiting Approval';
};

const formatCurrency = (val) => {
  if (!val) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
};

// MỚI: hiển thị bản đồ nhúng (OpenStreetMap, không cần API key) quanh vị trí xe hiện tại
const getMapEmbedUrl = (lat, lng) => {
  const delta = 0.01; // ~1km quanh xe, đủ để khách hàng thấy xe đang ở khu vực nào
  const minLng = Number(lng) - delta;
  const minLat = Number(lat) - delta;
  const maxLng = Number(lng) + delta;
  const maxLat = Number(lat) + delta;
  const bbox = `${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
};

// MỚI: link mở bản đồ lớn (Google Maps) ở tab mới để khách xem chi tiết hơn
const getGoogleMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

const formatDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—';

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

.live-map-cell { display: flex; flex-direction: column; gap: 4px; width: 190px; }
.mini-map-frame { width: 100%; height: 120px; border: 1px solid #e2e8f0; border-radius: 4px; }
.map-link-full { font-size: 11px; color: #2980b9; text-decoration: none; font-weight: bold; }
.map-link-full:hover { text-decoration: underline; }
.gps-updated-txt { font-size: 10px; color: #95a5a6; }

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