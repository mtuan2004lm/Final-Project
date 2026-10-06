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
          ➕ {{ $t('cust.create') }}
        </button>
        <button :class="{'active-nav': currentTab === 'list'}" @click="currentTab = 'list'">
          📦 {{ $t('cust.list') }}
        </button>
        <button :class="{'active-nav': currentTab === 'history'}" @click="currentTab = 'history'">
          📜 {{ $t('cust.history') }}
        </button>
        <button :class="{'active-nav': currentTab === 'payment'}" @click="currentTab = 'payment'">
          💳 {{ $t('cust.payment') }}
        </button>
        <button :class="{'active-nav': currentTab === 'addresses'}" @click="currentTab = 'addresses'">
          📍 {{ $t('cust.addresses') }}
        </button>
        <button :class="{'active-nav': currentTab === 'notifications'}" @click="openNotifications">
          🔔 {{ $t('cust.notifications') }}
          <span v-if="unreadNotifications > 0" class="nav-badge">{{ unreadNotifications }}</span>
        </button>
        <button :class="{'active-nav': currentTab === 'chat'}" @click="openChat">
          💬 {{ $t('cust.chat') }}
          <span v-if="unreadChat > 0" class="nav-badge">{{ unreadChat }}</span>
        </button>
        <button :class="{'active-nav': currentTab === 'dashboard'}" @click="openDashboard">
          📊 {{ $t('cust.dashboard') }}
        </button>
        <button :class="{'active-nav': currentTab === 'bulk'}" @click="currentTab = 'bulk'">
          📑 {{ $t('cust.bulk') }}
        </button>
        <button :class="{'active-nav': currentTab === 'claims'}" @click="currentTab = 'claims'">
          🛡️ {{ $t('cust.claims') }}
        </button>
      </div>

      <button @click="logout" class="btn-logout">{{ $t('common.logout') }}</button>
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
                <label>Delivery Address:</label>
                <select v-model="selectedAddressId" @change="applySavedAddress" v-if="addresses.length">
                  <option :value="null">-- Select a saved address --</option>
                  <option v-for="a in addresses" :key="a.id" :value="a.id">{{ a.label }} - {{ a.address }}</option>
                </select>
                <input type="text" v-model="newOrder.delivery_address" required placeholder="Enter delivery address..." style="margin-top: 6px;" />
              </div>

              <div class="form-group">
                <label>Receiver Name:</label>
                <input type="text" v-model="newOrder.receiver_name" placeholder="Receiver full name" />
              </div>

              <div class="form-group">
                <label>Receiver Phone:</label>
                <input type="tel" v-model="newOrder.receiver_phone" placeholder="Receiver phone" />
              </div>

              <div class="form-group">
                <label>Pickup Schedule (optional):</label>
                <input type="datetime-local" v-model="newOrder.pickup_date" />
              </div>

              <div class="form-group">
                <label>Pickup Note:</label>
                <input type="text" v-model="newOrder.pickup_note" placeholder="E.g.: call before arriving" />
              </div>

              <div class="form-group full-width">
                <label>Actual Cargo Image:</label>
                <input type="file" accept="image/*" required @change="onProductImageChange" class="file-input-styled" />
              </div>

              <!-- ĐỢT 5: mua bảo hiểm ngay khi tạo đơn -->
              <div class="form-group full-width insurance-box">
                <label class="insurance-toggle">
                  <input type="checkbox" v-model="insuranceOn" />
                  🛡️ Insure this shipment (compensation if it is lost or damaged)
                </label>
                <div v-if="insuranceOn" class="insurance-fields">
                  <input type="number" v-model.number="insuredValue" min="1" max="100000" step="1" placeholder="Declared value of the goods (USD)" />
                  <small v-if="insuredValue > 0">Insurance fee: <b>{{ formatCurrency(insuranceFee) }}</b> ({{ (insuranceRate * 100).toFixed(1) }}% of the declared value, minimum {{ insuranceMinFee }} USD). You can claim up to {{ formatCurrency(insuredValue) }}.</small>
                </div>
              </div>

              <div class="price-estimate-box full-width">
                <span>Estimated shipping cost: </span>
                <strong style="color: #e67e22; font-size: 18px;">{{ formatCurrency(estimatedPrice) }}</strong>
                <span v-if="insuranceOn && insuredValue > 0"> + insurance <strong>{{ formatCurrency(insuranceFee) }}</strong> = <strong style="color: #e67e22; font-size: 18px;">{{ formatCurrency(estimatedPrice + insuranceFee) }}</strong></span>
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
                <th>Package QR</th>
                <th>Delivery / Pickup</th>
                <th>Actions</th>
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
                <!-- MỚI: mã QR của kiện hàng (PKG-xxxxx), WMS sẽ quét mã này bằng camera
                     để xác nhận nhận hàng - xem thêm openQrModal() bên dưới. -->
                <td>
                  <button @click="openQrModal(order.id)" class="btn-qr-view">🔳 View QR</button>
                  <button @click="openDocument('waybill', order.id)" class="btn-qr-view" style="margin-top:4px; background:#8e44ad;">📄 Waybill</button>
                </td>
                <td style="font-size: 12px;">
                  <div v-if="order.delivery_address">📍 {{ order.delivery_address }}</div>
                  <div v-if="order.receiver_name">👤 {{ order.receiver_name }} {{ order.receiver_phone }}</div>
                  <div v-if="order.pickup_date">🕒 Pickup: {{ formatDateTime(order.pickup_date) }}</div>
                  <span v-if="!order.delivery_address && !order.pickup_date" style="color:#95a5a6;">-</span>
                </td>
                <td>
                  <button v-if="order.status === 'NEW' || order.status === 'RETURNED'" @click="cancelOrder(order)" class="btn-qr-view" style="background:#e74c3c;color:#fff;">✖ Cancel</button>
                  <div v-if="order.status === 'CANCELLED'" style="font-size:12px;color:#c0392b;">Cancelled<span v-if="order.refund_status === 'PENDING'"> - refund pending</span><span v-else-if="order.refund_status === 'REFUNDED'"> - refunded</span></div>
                </td>
                <!-- MỚI: Vị trí xe lấy từ GPS thật (truck_lat/truck_lng), được app tài xế
                     (Android/iOS) bắn định kỳ lên server qua PUT /api/orders/tms/fleet/gps,
                     backend JOIN sẵn vào bảng trucks (xem customerController.getCustomerOrders) -->
                <td>
                  <div v-if="order.status === 'SHIPPING' && order.truck_lat && order.truck_lng" class="live-map-cell">
                    <iframe
                      :src="getMapEmbedUrl(order.truck_lat, order.truck_lng)"
                      class="mini-map-frame"
                      loading="lazy"
                      referrerpolicy="no-referrer-when-downgrade">
                    </iframe>
                    <a :href="getGoogleMapsUrl(order.truck_lat, order.truck_lng)" target="_blank" class="map-link-full">
                      🔗 Open Full Map
                    </a>
                    <small class="gps-updated-txt">📍 Updated: {{ formatDateTime(order.truck_gps_updated_at) }}</small>
                  </div>
                  <span v-else-if="order.status === 'SHIPPING'" style="color: #95a5a6; font-style: italic; font-size: 12px;">
                    ⏳ Waiting for GPS signal from the vehicle...
                  </span>
                  <span v-else style="color: #95a5a6; font-style: italic; font-size: 12px;">
                    Not yet shipped
                  </span>
                </td>
              </tr>
              <tr v-if="activeOrders.length === 0">
                <td colspan="11" style="text-align: center; color: #7f8c8d; padding: 20px;">There are no orders currently being processed.</td>
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
                <th>Delivery Proof / Return</th>
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
                <td style="font-size: 12px;">
                  <button @click="openDocument('invoice', order.id)" class="btn-qr-view" style="background:#8e44ad; margin-bottom:4px;">🧾 Invoice</button>
                  <button @click="openDocument('waybill', order.id)" class="btn-qr-view" style="background:#8e44ad; margin-bottom:4px;">📄 Waybill</button>
                  <button @click="podOrder = order" class="btn-qr-view">📸 View POD</button>
                  <div v-if="order.return_status === 'REQUESTED'" style="color:#e67e22;">↩ Return requested</div>
                  <div v-else-if="order.return_status === 'APPROVED'" style="color:#27ae60;">↩ Return approved<span v-if="order.refund_status === 'REFUNDED'"> - refunded</span><span v-else> - refund pending</span></div>
                  <div v-else-if="order.return_status === 'REJECTED'" style="color:#c0392b;">↩ Return rejected: {{ order.return_reject_note }}</div>
                  <button v-else @click="requestReturn(order)" class="btn-qr-view" style="margin-top:4px;">↩ Request Return</button>
                </td>
              </tr>
              <tr v-if="completedOrders.length === 0">
                <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 20px;">No orders have completed the logistics supply chain yet.</td>
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

      <div v-if="currentTab === 'addresses'">
        <header><h1>SAVED DELIVERY ADDRESSES</h1></header>
        <div class="card">
          <form @submit.prevent="addAddress" class="grid-form">
            <div class="form-group"><label>Label:</label><input v-model="addrForm.label" required placeholder="Warehouse, Shop, Home..." /></div>
            <div class="form-group"><label>Address:</label><input v-model="addrForm.address" required placeholder="Full address" /></div>
            <div class="form-group"><label>Receiver Name:</label><input v-model="addrForm.receiver_name" /></div>
            <div class="form-group"><label>Receiver Phone:</label><input v-model="addrForm.receiver_phone" /></div>
            <div class="form-group"><label><input type="checkbox" v-model="addrForm.is_default" /> Set as default</label></div>
            <button type="submit" class="btn-submit full-width">➕ Save Address</button>
          </form>
          <table class="data-table" style="margin-top: 20px;">
            <thead><tr><th>Label</th><th>Address</th><th>Receiver</th><th></th></tr></thead>
            <tbody>
              <tr v-for="a in addresses" :key="a.id">
                <td><b>{{ a.label }}</b> <span v-if="a.is_default">⭐</span></td>
                <td>{{ a.address }}</td>
                <td>{{ a.receiver_name }} {{ a.receiver_phone }}</td>
                <td><button @click="deleteAddress(a.id)" class="btn-qr-view" style="background:#e74c3c;color:#fff;">🗑 Delete</button></td>
              </tr>
              <tr v-if="!addresses.length"><td colspan="4" style="text-align:center;color:#7f8c8d;padding:20px;">No saved addresses.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ĐỢT 2: Trung tâm thông báo -->
      <div v-if="currentTab === 'notifications'">
        <header><h1>🔔 NOTIFICATION CENTER</h1></header>
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="color:#7f8c8d; font-size:13px;">{{ unreadNotifications }} unread</span>
            <button @click="markAllNotificationsRead" class="btn-qr-view" :disabled="unreadNotifications === 0">✓ Mark all as read</button>
          </div>
          <div v-for="n in notifications" :key="n.id" class="notif-item" :class="{ unread: !n.is_read }" @click="markNotificationRead(n)">
            <div class="notif-title">{{ n.title }}<span v-if="!n.is_read" class="notif-dot"></span></div>
            <div class="notif-msg">{{ n.message }}</div>
            <small class="notif-time">{{ formatDateTime(n.created_at) }}</small>
          </div>
          <p v-if="notifications.length === 0" style="text-align:center; color:#7f8c8d; padding:20px;">No notifications yet. They appear here when your orders change status.</p>
        </div>
      </div>

      <!-- ĐỢT 2: Chat hỗ trợ với OMS -->
      <div v-if="currentTab === 'chat'">
        <header><h1>💬 SUPPORT CHAT (OMS)</h1></header>
        <div class="card">
          <div class="chat-box" ref="chatBox">
            <div v-for="m in chatMessages" :key="m.id" class="chat-row" :class="m.sender === 'CUSTOMER' ? 'mine' : 'theirs'">
              <div class="chat-bubble">
                <div v-if="m.order_id" class="chat-order-ref">Order #{{ m.order_id }}</div>
                {{ m.message }}
                <small class="chat-time">{{ formatDateTime(m.created_at) }}</small>
              </div>
            </div>
            <p v-if="chatMessages.length === 0" style="text-align:center; color:#7f8c8d; margin-top:60px;">No messages yet. Ask our support team anything about your orders.</p>
          </div>
          <form @submit.prevent="sendChat" class="chat-form">
            <select v-model="chatOrderId" class="chat-order-select">
              <option :value="null">General question</option>
              <option v-for="o in orders" :key="o.id" :value="o.id">Order #{{ o.id }} - {{ o.product_name }}</option>
            </select>
            <input v-model="chatInput" placeholder="Type your message..." class="chat-input" />
            <button type="submit" class="btn-submit" style="width:auto; padding:10px 20px;" :disabled="!chatInput.trim()">Send</button>
          </form>
        </div>
      </div>

      <!-- ĐỢT 3: Tạo nhiều đơn cùng lúc bằng file CSV -->
      <!-- ĐỢT 4: bảo hiểm + bồi thường -->
      <div v-if="currentTab === 'claims'">
        <CustomerClaims :username="username" />
      </div>

      <div v-if="currentTab === 'bulk'">
        <header><h1>📑 BULK ORDER UPLOAD (CSV)</h1></header>
        <div class="card">
          <p style="margin-top:0; color:#7f8c8d; font-size:13px; line-height:1.6;">
            Create up to 200 orders at once. Required columns: <b>product_name</b>, <b>quantity</b>.
            Optional: <b>cargo_type</b> (regular / electronics / hazardous / express), <b>customer_name</b>,
            <b>delivery_address</b>, <b>receiver_name</b>, <b>receiver_phone</b>.
            Using Excel? Choose <i>Save As &rarr; CSV UTF-8</i>. Prices are calculated by the system from the price list.
            Orders imported this way have no cargo photo.
          </p>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button @click="downloadCsvTemplate" class="btn-qr-view" style="background:#8e44ad;">⬇️ Download template</button>
            <input type="file" accept=".csv,text/csv,text/plain" @change="onCsvFile" />
          </div>

          <div v-if="bulkRows.length" style="margin-top:18px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
              <span><b>{{ bulkFileName }}</b> - {{ bulkRows.length }} row(s),
                <span :style="{ color: bulkInvalidCount ? '#c0392b' : '#27ae60', fontWeight: 'bold' }">
                  {{ bulkInvalidCount ? bulkInvalidCount + ' invalid' : 'all valid' }}
                </span>
                · Estimated total <b>{{ formatCurrency(bulkTotal) }}</b>
              </span>
              <button @click="submitBulk" class="btn-submit" style="width:auto; padding:10px 22px;" :disabled="bulkInvalidCount > 0 || bulkSubmitting">
                {{ bulkSubmitting ? 'Creating...' : '🚀 Create ' + bulkRows.length + ' order(s)' }}
              </button>
            </div>
            <table class="data-table">
              <thead><tr><th>#</th><th>Product</th><th>Category</th><th>Qty</th><th>Delivery address</th><th>Receiver</th><th>Est. price</th><th>Check</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in bulkRows" :key="i" :style="{ background: r.error ? '#fff5f5' : '' }">
                  <td>{{ i + 1 }}</td>
                  <td>{{ r.product_name }}</td>
                  <td>{{ r.cargoLabel || r.cargo_type }}</td>
                  <td>{{ r.quantity }}</td>
                  <td>{{ r.delivery_address }}</td>
                  <td>{{ r.receiver_name }} {{ r.receiver_phone }}</td>
                  <td>{{ r.error ? '-' : formatCurrency(r.price) }}</td>
                  <td><span v-if="r.error" style="color:#c0392b; font-size:12px;">{{ r.error }}</span><span v-else style="color:#27ae60;">✓</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ĐỢT 2: Dashboard khách hàng -->
      <div v-if="currentTab === 'dashboard'">
        <header><h1>📊 MY SHIPPING DASHBOARD</h1></header>
        <div v-if="stats">
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">Total orders</div><div class="stat-value">{{ stats.total_orders }}</div></div>
            <div class="stat-card"><div class="stat-label">In progress</div><div class="stat-value" style="color:#e67e22;">{{ stats.active_orders }}</div></div>
            <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value" style="color:#27ae60;">{{ stats.delivered_orders }}</div></div>
            <div class="stat-card"><div class="stat-label">Delivery success rate</div><div class="stat-value">{{ stats.success_rate === null ? '-' : stats.success_rate + '%' }}</div></div>
            <div class="stat-card"><div class="stat-label">Total shipping cost</div><div class="stat-value" style="color:#2980b9;">{{ formatCurrency(stats.total_spent) }}</div></div>
            <div class="stat-card"><div class="stat-label">Paid / Refunded</div><div class="stat-value" style="font-size:18px;">{{ formatCurrency(stats.total_paid) }} / {{ formatCurrency(stats.total_refunded) }}</div></div>
          </div>

          <div class="card" style="margin-top:20px;">
            <h3>Spending in the last 6 months</h3>
            <div class="bar-chart">
              <div v-for="m in stats.monthly" :key="m.month" class="bar-col">
                <div class="bar-value">{{ formatCurrency(m.spent) }}</div>
                <div class="bar" :style="{ height: barHeight(m.spent) + 'px' }"></div>
                <div class="bar-label">{{ m.month }}<br><small>{{ m.orders }} order(s)</small></div>
              </div>
              <p v-if="stats.monthly.length === 0" style="color:#7f8c8d; margin:auto;">No data yet.</p>
            </div>
          </div>

          <div class="card" style="margin-top:20px;">
            <h3>Spending by cargo category</h3>
            <div v-for="c in stats.by_cargo" :key="c.cargo_type" class="cargo-row">
              <span class="cargo-name">{{ c.cargo_type }}</span>
              <div class="cargo-track"><div class="cargo-fill" :style="{ width: cargoPercent(c.spent) + '%' }"></div></div>
              <span class="cargo-amount">{{ formatCurrency(c.spent) }} · {{ c.orders }}</span>
            </div>
            <p v-if="stats.by_cargo.length === 0" style="color:#7f8c8d;">No data yet.</p>
          </div>
        </div>
        <p v-else style="color:#7f8c8d;">Loading...</p>
      </div>

    </div>

    <!-- Popup Proof of Delivery -->
    <div v-if="podOrder" class="qr-modal-backdrop" @click.self="podOrder = null">
      <div class="qr-modal-box">
        <div class="modal-header-review">
          <h3>📸 Proof of Delivery - Order #{{ podOrder.id }}</h3>
          <button @click="podOrder = null" class="close-review-btn">&times;</button>
        </div>
        <div class="qr-modal-body">
          <img v-if="podReal(podOrder.pod_image)" :src="podReal(podOrder.pod_image)" style="max-width:100%;border-radius:6px;" />
          <p v-if="podOrder.pod_received_by">Received by: <b>{{ podOrder.pod_received_by }}</b></p>
          <p v-if="podOrder.pod_at" style="font-size:12px;color:#7f8c8d;">Delivered at: {{ formatDateTime(podOrder.pod_at) }}</p>
          <p v-if="podOrder.assigned_truck">🚛 Vehicle: <b>{{ podOrder.assigned_truck }}</b><span v-if="podOrder.driver_name"> · Driver: <b>{{ podOrder.driver_name }}</b></span></p>
          <p v-if="podOrder.gps_coordinates && podOrder.gps_coordinates !== 'Unknown'">📍 GPS: {{ podOrder.gps_coordinates }}
            <a :href="'https://www.google.com/maps?q=' + encodeURIComponent(podOrder.gps_coordinates.replace(/[^0-9.,\-]/g, ''))" target="_blank">Open in Maps</a></p>
          <p v-if="podOrder.driver_notes">📝 Driver notes: {{ podOrder.driver_notes }}</p>
          <p>💰 Order total: <b>${{ Number(podOrder.total_price || 0).toLocaleString() }}</b><span v-if="Number(podOrder.insurance_fee) > 0"> · 🛡️ Insurance fee: ${{ Number(podOrder.insurance_fee).toFixed(2) }}</span></p>
          <p>🛣️ BOT fee: ${{ Number(podOrder.bot_fee || 0).toFixed(2) }} · ⛽ Fuel fee: ${{ Number(podOrder.fuel_fee || 0).toFixed(2) }}</p>
          <img v-if="podOrder.pod_signature" :src="podOrder.pod_signature" style="max-width:100%;background:#fff;border:1px solid #ddd;border-radius:6px;" />
          <p v-if="!podReal(podOrder.pod_image) && !podOrder.pod_signature" style="color:#7f8c8d;">
            No photo or signature was recorded for this delivery{{ podOrder.pod_at ? '' : ' (the driver has not submitted an e-POD yet)' }}.
          </p>
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

    <!-- MỚI: Popup hiện mã QR kiện hàng - dùng chung cho 2 trường hợp:
         1. Tự động mở ngay sau khi tạo đơn thành công (xem createOrder()).
         2. Mở thủ công bằng nút "View QR" ở tab Current Orders (xem openQrModal()).
         WMS sẽ quét đúng chuỗi text PKG-xxxxx này bằng camera (app WMS iOS/Android)
         để xác nhận nhận hàng - không cần gọi thêm API nào vì mã được tính trực tiếp
         từ order id (giống hệt công thức "PKG-" + (60000 + id) đã dùng trong app WMS). -->
    <div v-if="showQrModal" class="qr-modal-backdrop" @click.self="showQrModal = false">
      <div class="qr-modal-box">
        <div class="modal-header-review">
          <h3>🔳 Package QR Code</h3>
          <button @click="showQrModal = false" class="close-review-btn">&times;</button>
        </div>
        <div class="qr-modal-body">
          <p v-if="qrOrderId === lastCreatedOrderId" class="qr-success-text">
            🚀 Order created successfully! Print or screenshot this QR code and attach it to your package.
          </p>
          <img :src="getQrImageUrl(qrOrderId)" alt="Package QR Code" class="qr-image" />
          <p class="qr-code-text">{{ getPackageCode(qrOrderId) }}</p>
          <p class="qr-hint-text">The warehouse (WMS) will scan this code on arrival to confirm receipt.</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import CustomerClaims from '../components/CustomerClaims.vue';

const router = useRouter();
const username = ref(localStorage.getItem('username') || 'Customer');
const currentTab = ref('create');

// ================== ĐỢT 2: THÔNG BÁO / CHAT / DASHBOARD / CHỨNG TỪ ==================
const API_EXT2 = 'http://localhost:3000/api/ext';

// --- Thông báo ---
const notifications = ref([]);
const unreadNotifications = ref(0);
const fetchNotifications = async () => {
  try {
    const res = await axios.get(`${API_EXT2}/notifications`, { params: { username: username.value } });
    notifications.value = res.data.notifications;
    unreadNotifications.value = res.data.unread;
  } catch (e) { console.error('Error loading notifications', e); }
};
const openNotifications = () => { currentTab.value = 'notifications'; fetchNotifications(); };
const markNotificationRead = async (n) => {
  if (n.is_read) return;
  try {
    await axios.put(`${API_EXT2}/notifications/read`, { username: username.value, id: n.id });
    fetchNotifications();
  } catch (e) { /* bỏ qua */ }
};
const markAllNotificationsRead = async () => {
  try {
    await axios.put(`${API_EXT2}/notifications/read`, { username: username.value });
    fetchNotifications();
  } catch (e) { /* bỏ qua */ }
};

// --- Chat hỗ trợ ---
const chatMessages = ref([]);
const chatInput = ref('');
const chatOrderId = ref(null);
const unreadChat = ref(0);
const chatBox = ref(null);
const scrollChatToEnd = () => nextTick(() => { if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight; });

const fetchChat = async () => {
  try {
    const lastId = chatMessages.value.length ? chatMessages.value[chatMessages.value.length - 1].id : 0;
    const res = await axios.get(`${API_EXT2}/support/messages`, { params: { username: username.value, after: lastId } });
    if (res.data.length) {
      chatMessages.value.push(...res.data);
      scrollChatToEnd();
      if (currentTab.value === 'chat') await axios.put(`${API_EXT2}/support/read`, { username: username.value, reader: 'CUSTOMER' });
    }
  } catch (e) { console.error('Error loading chat', e); }
};
const fetchUnreadChat = async () => {
  try {
    const res = await axios.get(`${API_EXT2}/support/unread`, { params: { username: username.value } });
    unreadChat.value = res.data.unread;
  } catch (e) { /* bỏ qua */ }
};
const openChat = async () => {
  currentTab.value = 'chat';
  await fetchChat();
  try { await axios.put(`${API_EXT2}/support/read`, { username: username.value, reader: 'CUSTOMER' }); } catch (e) { /* bỏ qua */ }
  unreadChat.value = 0;
  scrollChatToEnd();
};
const sendChat = async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  try {
    await axios.post(`${API_EXT2}/support/messages`, {
      username: username.value, sender: 'CUSTOMER', message: text, order_id: chatOrderId.value
    });
    chatInput.value = '';
    await fetchChat();
  } catch (e) { alert('Unable to send the message!'); }
};

// --- Dashboard ---
const stats = ref(null);
const fetchStats = async () => {
  try {
    const res = await axios.get(`${API_EXT2}/customer/stats`, { params: { username: username.value } });
    stats.value = res.data;
  } catch (e) { console.error('Error loading dashboard', e); }
};
const openDashboard = () => { currentTab.value = 'dashboard'; fetchStats(); };
const barHeight = (v) => {
  const max = Math.max(...(stats.value?.monthly || []).map(m => m.spent), 1);
  return Math.max(6, Math.round((v / max) * 140));
};
const cargoPercent = (v) => {
  const max = Math.max(...(stats.value?.by_cargo || []).map(c => c.spent), 1);
  return Math.round((v / max) * 100);
};

// --- Chứng từ: mở vận đơn / hóa đơn ở tab mới (có nút Print / Save as PDF) ---
const openDocument = (type, orderId) => {
  window.open(`${API_EXT2}/documents/${type}/${orderId}`, '_blank');
};

// ================== ĐỢT 3: TẠO ĐƠN HÀNG LOẠT BẰNG CSV ==================
const bulkRows = ref([]);
const bulkFileName = ref('');
const bulkSubmitting = ref(false);
const bulkInvalidCount = computed(() => bulkRows.value.filter(r => r.error).length);
const bulkTotal = computed(() => bulkRows.value.filter(r => !r.error).reduce((s, r) => s + r.price, 0));

// Đọc CSV: hỗ trợ dấu ngoặc kép, dấu phẩy trong ô, xuống dòng trong ô, BOM, phân tách bằng , hoặc ;
const parseCsv = (text) => {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
};

const CSV_ALIASES = {
  product_name: ['product_name', 'product', 'tên hàng', 'ten hang', 'sản phẩm', 'san pham'],
  quantity: ['quantity', 'qty', 'số lượng', 'so luong'],
  cargo_type: ['cargo_type', 'cargo', 'type', 'loại hàng', 'loai hang'],
  customer_name: ['customer_name', 'customer', 'company', 'khách hàng', 'khach hang'],
  delivery_address: ['delivery_address', 'address', 'địa chỉ', 'dia chi'],
  receiver_name: ['receiver_name', 'receiver', 'người nhận', 'nguoi nhan'],
  receiver_phone: ['receiver_phone', 'phone', 'sđt', 'sdt', 'điện thoại', 'dien thoai']
};

// Cùng quy tắc nhận diện loại hàng với server (server vẫn là nơi quyết định cuối cùng)
const CARGO_LABELS = {
  'Hàng hóa thông thường': 'Regular Goods', 'Hàng hóa điện tử': 'Electronics',
  'Hàng hóa nguy hiểm': 'Hazardous Goods', 'Hàng hóa nhanh': 'Express Goods'
};
const normalizeCargo = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'Hàng hóa thông thường';
  if (/(thông thường|thuong|thường|regular|normal|standard)/.test(s)) return 'Hàng hóa thông thường';
  if (/(điện tử|dien tu|electronic)/.test(s)) return 'Hàng hóa điện tử';
  if (/(nguy hiểm|nguy hiem|hazard|danger)/.test(s)) return 'Hàng hóa nguy hiểm';
  if (/(nhanh|express|fast)/.test(s)) return 'Hàng hóa nhanh';
  return null;
};

const onCsvFile = async (e) => {
  const file = e.target.files && e.target.files[0];
  bulkRows.value = [];
  if (!file) return;
  bulkFileName.value = file.name;
  const rows = parseCsv(await file.text());
  if (rows.length < 2) { alert('The file needs a header row and at least one data row.'); return; }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const col = {};
  Object.entries(CSV_ALIASES).forEach(([key, names]) => { col[key] = header.findIndex(h => names.includes(h)); });
  if (col.product_name < 0 || col.quantity < 0) {
    alert('Missing required column(s). The header must contain product_name and quantity.');
    return;
  }
  if (rows.length - 1 > 200) { alert('Maximum 200 orders per upload.'); return; }

  const get = (r, k) => (col[k] >= 0 ? (r[col[k]] || '').trim() : '');
  bulkRows.value = rows.slice(1).map(r => {
    const qty = parseInt(get(r, 'quantity'), 10);
    const cargo = normalizeCargo(get(r, 'cargo_type'));
    const o = {
      product_name: get(r, 'product_name'), quantity: get(r, 'quantity'), cargo_type: get(r, 'cargo_type'),
      customer_name: get(r, 'customer_name'), delivery_address: get(r, 'delivery_address'),
      receiver_name: get(r, 'receiver_name'), receiver_phone: get(r, 'receiver_phone'),
      cargoLabel: cargo ? CARGO_LABELS[cargo] : '', price: 0, error: ''
    };
    if (!o.product_name) o.error = 'Missing product_name';
    else if (!Number.isInteger(qty) || qty < 1 || qty > 9999) o.error = 'Invalid quantity (1-9999)';
    else if (!cargo) o.error = 'Unknown cargo_type';
    else o.price = priceRates[cargo] * qty;
    return o;
  });
};

const submitBulk = async () => {
  if (bulkInvalidCount.value > 0 || !bulkRows.value.length) return;
  bulkSubmitting.value = true;
  try {
    const res = await axios.post(`${API_EXT2}/orders/bulk`, {
      username: username.value,
      orders: bulkRows.value.map(r => ({
        product_name: r.product_name, quantity: r.quantity, cargo_type: r.cargo_type,
        customer_name: r.customer_name, delivery_address: r.delivery_address,
        receiver_name: r.receiver_name, receiver_phone: r.receiver_phone
      }))
    });
    alert(`✅ ${res.data.message}`);
    bulkRows.value = []; bulkFileName.value = '';
    fetchOrders();
    currentTab.value = 'list';
  } catch (err) {
    const d = err.response?.data;
    const detail = d?.rowErrors ? '\n' + d.rowErrors.map(x => `Row ${x.row}: ${x.error}`).join('\n') : '';
    alert((d?.error || 'Bulk upload failed!') + detail);
  } finally { bulkSubmitting.value = false; }
};

const downloadCsvTemplate = () => {
  const csv = '﻿product_name,quantity,cargo_type,customer_name,delivery_address,receiver_name,receiver_phone\n' +
    'Wooden crate of components,10,regular,My Company,"12 Le Van Viet, Quan 9, TP.HCM",Nguyen Van A,0901234567\n' +
    'Laptops,5,electronics,My Company,"5 Nguyen Van Linh, Quan 7, TP.HCM",Tran Thi B,0907654321\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'bulk_orders_template.csv'; a.click();
  URL.revokeObjectURL(url);
};

// Poll nhẹ mỗi 5 giây cùng nhịp với fetchOrders
const pollExtras = () => {
  fetchNotifications();
  if (currentTab.value === 'chat') fetchChat(); else fetchUnreadChat();
  if (currentTab.value === 'dashboard') fetchStats();
};

const orders = ref([]);
const estimatedPrice = ref(100);
const selectedOrderForPay = ref(null);
const productImageFile = ref(null);

const showReviewModal = ref(false);
const activeReviewOrder = ref(null);
const feedbackRating = ref(5);
const feedbackText = ref('');

// MỚI: state cho popup mã QR kiện hàng
const showQrModal = ref(false);
const qrOrderId = ref(null);
const lastCreatedOrderId = ref(null); // phân biệt "vừa tạo xong" với "xem lại QR cũ" để đổi câu chữ trong popup

let customerInterval = null;
const returnedOrderNotice = ref(null);
const latestNotification = ref('');

const emptyOrder = () => ({
  customer_name: '',
  product_name: '',
  cargo_type: 'Hàng hóa thông thường',
  quantity: 1,
  delivery_address: '',
  receiver_name: '',
  receiver_phone: '',
  pickup_date: '',
  pickup_note: ''
});
const newOrder = ref(emptyOrder());

// ĐỢT 1: địa chỉ đã lưu, POD, trả hàng
const API_EXT = 'http://localhost:3000/api/ext';
const addresses = ref([]);
const selectedAddressId = ref(null);
const addrForm = ref({ label: '', address: '', receiver_name: '', receiver_phone: '', is_default: false });
const podOrder = ref(null);
// Bỏ qua đường dẫn mô phỏng (cdn-storage...) do pod-submit ghi tạm; chỉ dùng ảnh thật trong /uploads
const podReal = (p) => {
  if (!p || p.includes('cdn-storage.logistics.pro')) return '';
  return p.startsWith('http') ? p : 'http://localhost:3000' + p;
};

const fetchAddresses = async () => {
  try {
    const res = await axios.get(`${API_EXT}/addresses?username=${username.value}`);
    addresses.value = res.data;
  } catch (e) { console.error('Error loading addresses', e); }
};
const applySavedAddress = () => {
  const a = addresses.value.find(x => x.id === selectedAddressId.value);
  if (!a) return;
  newOrder.value.delivery_address = a.address;
  newOrder.value.receiver_name = a.receiver_name || '';
  newOrder.value.receiver_phone = a.receiver_phone || '';
};
const addAddress = async () => {
  try {
    await axios.post(`${API_EXT}/addresses`, { ...addrForm.value, username: username.value });
    addrForm.value = { label: '', address: '', receiver_name: '', receiver_phone: '', is_default: false };
    fetchAddresses();
  } catch (e) { alert('Unable to save the address!'); }
};
const deleteAddress = async (id) => {
  if (!confirm('Delete this address?')) return;
  await axios.delete(`${API_EXT}/addresses/${id}`);
  fetchAddresses();
};
const cancelOrder = async (order) => {
  const reason = prompt('Reason for cancelling this order:');
  if (reason === null) return;
  try {
    const res = await axios.put(`${API_EXT}/orders/${order.id}/cancel`, { reason });
    alert(res.data.message);
    fetchOrders();
  } catch (e) { alert(e.response?.data?.error || 'Unable to cancel the order!'); }
};
const requestReturn = async (order) => {
  const reason = prompt('Reason for returning this order:');
  if (reason === null) return;
  try {
    const res = await axios.post(`${API_EXT}/orders/${order.id}/return-request`, { reason });
    alert(res.data.message);
    fetchOrders();
  } catch (e) { alert(e.response?.data?.error || 'Unable to send the return request!'); }
};

// Chuyển đổi toàn bộ bảng giá dịch vụ logistics sang USD ($)
// ĐỢT 5: giá mặc định, được thay bằng bảng giá Admin cấu hình khi tải trang (GET /api/ext/pricing)
const priceRates = reactive({
  'Hàng hóa thông thường': 100,
  'Hàng hóa điện tử': 250,
  'Hàng hóa nguy hiểm': 180,
  'Hàng hóa nhanh': 400
});
// ĐỢT 5: bảo hiểm khi tạo đơn
const insuranceOn = ref(false);
const insuredValue = ref(null);
const insuranceRate = ref(0.015);
const insuranceMinFee = ref(1);
const insuranceFee = computed(() => {
  const v = Number(insuredValue.value) || 0;
  return v > 0 ? Math.round(Math.max(insuranceMinFee.value, v * insuranceRate.value) * 100) / 100 : 0;
});
const loadPricing = async () => {
  try {
    const r = await axios.get('http://localhost:3000/api/ext/pricing');
    Object.assign(priceRates, r.data.rates);
    insuranceRate.value = r.data.insurance_rate;
    insuranceMinFee.value = r.data.insurance_min_fee;
  } catch (e) { /* giữ giá mặc định */ }
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
    o.status !== 'CANCELLED' &&
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

// MỚI: mã kiện hàng (PKG-xxxxx) - CÙNG CÔNG THỨC với app WMS (iOS/Android) đang
// dùng để đối chiếu khi quét/nhập tay xác nhận nhận hàng. Không cần backend sinh
// hay lưu gì thêm, vì công thức này là 1-1 suy ra được từ order id.
const getPackageCode = (orderId) => `PKG-${60000 + Number(orderId)}`;

// MỚI: ảnh QR code sinh bằng dịch vụ miễn phí api.qrserver.com (không cần cài thêm
// thư viện JS nào, giống cách VietQR đang được dùng ở cổng thanh toán bên dưới).
const getQrImageUrl = (orderId) => {
  const code = getPackageCode(orderId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(code)}`;
};

const openQrModal = (orderId) => {
  qrOrderId.value = orderId;
  showQrModal.value = true;
};

const createOrder = async () => {
  if (!productImageFile.value) {
    alert("⚠️ Please upload an actual image of the cargo to create the yard declaration!");
    return;
  }
  if (insuranceOn.value && !(Number(insuredValue.value) > 0)) {
    alert("Please enter the declared value of the goods, or untick the insurance option.");
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
    const res = await axios.post('http://localhost:3000/api/orders', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    // ĐỢT 1: lưu địa chỉ giao + lịch lấy hàng vào đơn vừa tạo
    const createdId = res.data && res.data.order ? res.data.order.id : null;
    if (createdId) {
      try {
        await axios.put(`${API_EXT}/orders/${createdId}/delivery-info`, {
          delivery_address: newOrder.value.delivery_address,
          receiver_name: newOrder.value.receiver_name,
          receiver_phone: newOrder.value.receiver_phone,
          pickup_date: newOrder.value.pickup_date || null,
          pickup_note: newOrder.value.pickup_note
        });
      } catch (e) { console.error('Delivery info not saved', e); }

      // ĐỢT 5: mua bảo hiểm cho đơn vừa tạo
      if (insuranceOn.value) {
        try {
          await axios.post(`${API_EXT}/orders/${createdId}/insurance`, { username: username.value, declared_value: insuredValue.value });
        } catch (e) {
          alert((e.response?.data?.error || 'Insurance could not be added') + ' - the order was created without insurance. You can buy insurance later in "Insurance & Claims".');
        }
      }
    }
    insuranceOn.value = false;
    insuredValue.value = null;

    newOrder.value = emptyOrder();
    selectedAddressId.value = null;
    productImageFile.value = null;
    const fileInput = document.querySelector('.file-input-styled');
    if (fileInput) fileInput.value = '';

    calculateEstimatedPrice();
    fetchOrders();
    currentTab.value = 'list';

    // MỚI: mở popup QR ngay nếu lấy được id đơn vừa tạo; nếu vì lý do gì đó server
    // không trả về order.id, fallback về alert cũ để không chặn luồng tạo đơn.
    const newId = res.data && res.data.order ? res.data.order.id : null;
    if (newId) {
      lastCreatedOrderId.value = newId;
      openQrModal(newId);
    } else {
      alert("🚀 Consignment request created successfully!");
    }
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
    'CANCELLED': '✖ Cancelled',
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
  loadPricing();   // ĐỢT 5: bảng giá do Admin cấu hình
  if (!localStorage.getItem('role')) {
    router.push('/');
  } else {
    fetchOrders();
    fetchAddresses();
    pollExtras();
    customerInterval = setInterval(() => { fetchOrders(); pollExtras(); }, 5000);
  }
});

onUnmounted(() => {
  if (customerInterval) clearInterval(customerInterval);
});
</script>

<style scoped>
/* ===== ĐỢT 2: thông báo / chat / dashboard ===== */
.nav-badge { background: #e74c3c; color: #fff; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: bold; margin-left: 6px; }
.notif-item { padding: 12px 14px; border-bottom: 1px solid #ecf0f1; cursor: pointer; }
.notif-item.unread { background: #fff8ee; border-left: 4px solid #e67e22; }
.notif-title { font-weight: 700; color: #2c3e50; font-size: 14px; display: flex; align-items: center; gap: 8px; }
.notif-dot { width: 8px; height: 8px; background: #e74c3c; border-radius: 50%; display: inline-block; }
.notif-msg { font-size: 13px; color: #34495e; margin: 3px 0; }
.notif-time { color: #95a5a6; font-size: 11px; }
.chat-box { height: 380px; overflow-y: auto; background: #f4f6f9; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
.chat-row { display: flex; }
.chat-row.mine { justify-content: flex-end; }
.chat-bubble { max-width: 70%; padding: 9px 13px; border-radius: 14px; font-size: 14px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
.chat-row.mine .chat-bubble { background: #3498db; color: #fff; border-bottom-right-radius: 4px; }
.chat-row.theirs .chat-bubble { background: #fff; color: #2c3e50; border: 1px solid #dfe6e9; border-bottom-left-radius: 4px; }
.chat-order-ref { font-size: 11px; font-weight: bold; opacity: .8; margin-bottom: 2px; }
.chat-time { display: block; font-size: 10px; opacity: .7; margin-top: 3px; }
.chat-form { display: flex; gap: 8px; margin-top: 12px; }
.chat-input { flex: 1; padding: 10px 12px; border: 1px solid #bdc3c7; border-radius: 6px; font-size: 14px; }
.chat-order-select { padding: 8px; border: 1px solid #bdc3c7; border-radius: 6px; max-width: 200px; }
.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 10px; }
.stat-card { background: #fff; border-radius: 8px; padding: 18px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
.stat-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; font-weight: bold; }
.stat-value { font-size: 28px; font-weight: 800; color: #2c3e50; margin-top: 6px; }
.bar-chart { display: flex; align-items: flex-end; gap: 18px; height: 230px; padding-top: 10px; }
.bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.bar { width: 60%; max-width: 70px; background: linear-gradient(180deg, #54a0ff, #2e86de); border-radius: 4px 4px 0 0; }
.bar-value { font-size: 11px; font-weight: bold; color: #2c3e50; margin-bottom: 4px; }
.bar-label { font-size: 11px; color: #7f8c8d; text-align: center; margin-top: 6px; }
.cargo-row { display: flex; align-items: center; gap: 12px; margin: 10px 0; font-size: 13px; }
.cargo-name { width: 190px; font-weight: 600; }
.cargo-track { flex: 1; height: 12px; background: #ecf0f1; border-radius: 6px; overflow: hidden; }
.cargo-fill { height: 100%; background: #1dd1a1; }
.cargo-amount { width: 120px; text-align: right; color: #2c3e50; font-weight: bold; }
.dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f4f6f9; }
.sidebar { width: 260px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; flex-shrink: 0; box-sizing: border-box; height: 100vh; overflow-y: auto; }
.brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; color: #ecf0f1; }
.user-info { display: flex; align-items: center; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid #34495e; margin-bottom: 15px; }
.avatar { width: 45px; height: 45px; background: #3498db; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
.notification-box { background: #34495e; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; border-left: 4px solid #f1c40f; }
.notification-box h4 { margin: 0 0 6px 0; color: #ecf0f1; }
.navigation-menu { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.navigation-menu button { flex-shrink: 0; }
.navigation-menu button { padding: 12px; text-align: left; background: none; border: none; color: #bdc3c7; font-weight: bold; cursor: pointer; border-radius: 4px; }
.navigation-menu button:hover, .navigation-menu button.active-nav { background: #1a252f; color: white; }
.btn-logout { flex-shrink: 0; margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

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

/* MỚI: nút xem QR kiện hàng trong bảng Current Orders */
.btn-qr-view { background: #0ea5e9; color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; }
.btn-qr-view:hover { background: #0284c7; }

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

/* MỚI: popup QR code kiện hàng */
.qr-modal-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.qr-modal-box { background: white; width: 360px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); overflow: hidden; animation: fadeIn 0.2s ease-out; }
.qr-modal-body { padding: 25px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.qr-success-text { font-size: 13px; color: #27ae60; font-weight: bold; margin: 0 0 5px 0; }
.qr-code-text { font-size: 18px; font-weight: 800; font-family: monospace; color: #2c3e50; margin: 5px 0; }
.qr-hint-text { font-size: 12px; color: #7f8c8d; margin: 0; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
.insurance-box { background: #eaf6fb; border: 1px dashed #5dade2; border-radius: 8px; padding: 10px 14px; }
.insurance-toggle { display: flex; align-items: center; gap: 8px; font-weight: bold; cursor: pointer; }
.insurance-toggle input { width: auto; }
.insurance-fields { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
</style>