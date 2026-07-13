<template>
   <div class="dashboard-container">
     <div class="sidebar">
       <div class="brand">LOGISTICS PRO</div>
       <div class="user-info">
         <div class="avatar">{{ userRole.charAt(0) }}</div>
         <div>
            <h3>{{ userRole }} DEPARTMENT</h3>
            <small style="color: #2ecc71;">Admin Online</small>
         </div>
       </div>

       <div class="navigation-menu">
          <button @click="activeTab = 'orders'" :class="{ active: activeTab === 'orders' }" class="menu-btn">
             📦 Approve & Return Orders
          </button>
          <button @click="activeTab = 'customers'" :class="{ active: activeTab === 'customers' }" class="menu-btn">
             👥 Customer Management
          </button>
          <button @click="activeTab = 'analytics'" :class="{ active: activeTab === 'analytics' }" class="menu-btn">
             📊 Revenue Report
          </button>
       </div>

       <button @click="logout" class="btn-logout">Log Out</button>
     </div>

     <div class="main-content">

        <div v-if="activeTab === 'orders'">
           <header><h1>ORDER MANAGEMENT DEPARTMENT (OMS) - FLOW COORDINATION</h1></header>
           <div class="card list-card" style="margin-top: 25px;">
               <h3>📋 Newly Received Orders (Pending Review)</h3>
               <table class="data-table">
                   <thead>
                       <tr>
                         <th>Order ID</th>
                         <th>Image</th>
                         <th>Customer</th>
                         <th>Cargo</th>
                         <th>Qty</th>
                         <th>Status</th>
                         <th>Actions</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders" :key="order.id">
                           <td @click="openOrderTimeline(order.id)" class="clickable-id" title="Click to view history details">
                              <b>#{{ order.id }}</b> 🔍
                           </td>

                           <td class="img-cell">
                              <img v-if="order.product_image"
                                   :src="'http://localhost:3000' + order.product_image"
                                   alt="Product"
                                   class="product-thumb" />
                              <span v-else class="no-img">No image</span>
                           </td>

                           <td><b>{{ order.customer_name }}</b></td>
                           <td>{{ order.product_name }}</td>
                           <td>{{ order.quantity }}</td>
                           <td><span class="badge status-new">{{ order.status }}</span></td>
                           <td class="action-cell">
                             <button @click="approveOrder(order.id)" class="btn-action btn-ok">Approve & Transfer to WMS</button>
                             <button @click="handleReturnOrder(order.id)" class="btn-action btn-fail">↩️ Return Order (Pricing/Documentation Error)</button>
                           </td>
                       </tr>
                       <tr v-if="orders.length === 0">
                           <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 30px; font-style: italic;">There are no orders awaiting approval.</td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>

        <div v-if="activeTab === 'customers'">
           <header><h1>👥 CUSTOMER PROFILES & PURCHASE HISTORY</h1></header>
           <div class="card list-card" style="margin-top: 25px;">
               <h3>📈 Contribution Value Statistics per Account</h3>
               <table class="data-table">
                   <thead>
                       <tr>
                         <th>Customer Name</th>
                         <th>Total Orders Placed</th>
                         <th>Lifetime Total Spent</th>
                         <th>Last Purchase</th>
                         <th>Care Tier</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="cus in customerAnalytics" :key="cus.customer_name">
                           <td><b>{{ cus.customer_name || 'Walk-in Customer' }}</b></td>
                           <td>{{ cus.total_orders }} orders</td>
                           <td style="color: #2980b9; font-weight: bold;">${{ cus.total_spent }}</td>
                           <td>{{ new Date(cus.last_purchase).toLocaleString() }}</td>
                           <td>
                              <span v-if="cus.total_spent >= 3000" class="badge-vip">💎 VIP Member</span>
                              <span v-else class="badge-normal">⭐ Loyal</span>
                           </td>
                       </tr>
                       <tr v-if="customerAnalytics.length === 0">
                           <td colspan="5" style="text-align: center; color: #7f8c8d; padding: 20px;">No customer data yet.</td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>

        <div v-if="activeTab === 'analytics'">
           <header><h1>📊 VISUAL COMPANY REVENUE REPORT DATA</h1></header>
           <div class="revenue-container">
              <div class="box-rev today">
                 <p>TODAY'S REVENUE</p>
                 <h2>${{ revenueReport.today }}</h2>
                 <div class="custom-progress"><div class="line" style="width: 35%"></div></div>
              </div>
              <div class="box-rev month">
                 <p>REVENUE THIS MONTH</p>
                 <h2>${{ revenueReport.month }}</h2>
                 <div class="custom-progress"><div class="line" style="width: 75%"></div></div>
              </div>
           </div>
        </div>

     </div>

     <div v-if="showHistoryModal" class="modal-overlay" @click="showHistoryModal = false">
       <div class="modal-content-box" @click.stop>
          <div class="modal-header">
             <h2>📜 Order Journey Log #{{ selectedOrderId }}</h2>
             <button class="close-btn" @click="showHistoryModal = false">×</button>
          </div>

          <div class="modal-body">
             <div class="timeline-wrapper">
                <!-- ĐÃ SỬA: order_logs thực tế chỉ có old_status/new_status/notes/changed_at,
                     không có from_dept/to_dept/action_by/status như bản cũ đang tham chiếu
                     (khiến các dòng luôn hiện "undefined"). -->
                <div v-for="log in activeOrderHistory" :key="log.id" class="timeline-item">
                   <div class="timeline-badge-circle"></div>
                   <div class="timeline-content-card">
                      <div class="time-stamp">{{ new Date(log.changed_at).toLocaleString() }}</div>
                      <h4 class="action-title">
                         Status: <span class="dept-tag">{{ log.old_status || '—' }}</span> ➡️ <span class="dept-tag">{{ log.new_status }}</span>
                      </h4>
                      <p v-if="log.notes" class="log-notes">📌 <b>Reason / Details:</b> {{ log.notes }}</p>
                   </div>
                </div>

                <div v-if="activeOrderHistory.length === 0" style="text-align: center; color: #95a5a6; padding: 25px; font-style: italic;">
                   This order was just created and has no department transfer history yet.
                </div>
             </div>
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
 const activeTab = ref('orders');

 const orders = ref([]);
 const customerAnalytics = ref([]);
 const revenueReport = ref({ today: 0, month: 0 });

 const showHistoryModal = ref(false);
 const selectedOrderId = ref(null);
 const activeOrderHistory = ref([]);

 const fetchOrders = async () => {
   try {
     const res = await axios.get('http://localhost:3000/api/orders/oms');
     orders.value = res.data;
   } catch (error) {
     console.error("Error loading OMS department data");
   }
 };
 const fetchCustomerData = async () => {
   try {
     const res = await axios.get('http://localhost:3000/api/orders/oms/analytics/customers');
     customerAnalytics.value = res.data;
   } catch (error) {
     console.error("Unable to load customer report");
   }
 };
 const fetchRevenueData = async () => {
   try {
     const res = await axios.get('http://localhost:3000/api/orders/oms/analytics/revenue');
     revenueReport.value = res.data;
   } catch (error) {
     console.error("Unable to load revenue data");
   }
 };

 // ĐÃ SỬA: URL đúng đã đăng ký trong orderRoutes.js là "/history/:id", không phải "/:id/history"
 const openOrderTimeline = async (orderId) => {
    selectedOrderId.value = orderId;
    try {
       const res = await axios.get(`http://localhost:3000/api/orders/history/${orderId}`);
       activeOrderHistory.value = res.data;
       showHistoryModal.value = true;
    } catch (error) {
       alert("Unable to load this order's history!");
    }
 };

 const approveOrder = async (orderId) => {
   try {
     await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
       status: 'APPROVED',
       current_dept: 'WMS',
       from_dept: 'OMS'
     });
     alert("Order approved and transferred to the Warehouse (WMS)!");
     refreshAllData();
   } catch (error) {
     alert("Failed to approve the order!");
   }
 };
 const handleReturnOrder = async (orderId) => {
    const reason = prompt("Enter the reason for returning this order to the Customer:");
    if (reason === null) return;
    if (!reason.trim()) return alert("Please enter a specific reason!");

    try {
       const res = await axios.put(`http://localhost:3000/api/orders/${orderId}/return-order`, { reason });
       alert(res.data.message);
       refreshAllData();
    } catch (error) {
       alert("An error occurred while processing the return!");
    }
 };
 const refreshAllData = () => {
    fetchOrders();
    fetchCustomerData();
    fetchRevenueData();
 };

 onMounted(() => {
   if (!localStorage.getItem('role')) router.push('/');
   else {
      refreshAllData();
      setInterval(refreshAllData, 5000);
   }
 });

 const logout = () => { localStorage.clear(); router.push('/'); };
 </script>

 <style scoped>
 .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
 .sidebar { width: 250px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; box-sizing: border-box;}
 .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; }
 .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid #34495e; margin-bottom: 20px; }
 .avatar { width: 40px; height: 40px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
 .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
 .main-content { flex: 1; padding: 30px; overflow-y: auto; background: #fff;}
 .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f5;}

 .navigation-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 10px;}
 .menu-btn { padding: 12px 15px; background: none; border: none; color: #b2bec3; text-align: left; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; transition: all 0.2s;}
 .menu-btn:hover, .menu-btn.active { background: #34495e; color: #fff; }

 .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
 .data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 14px; vertical-align: middle;}
 .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase;}

 /* ========================================================================= */
 /* ĐÃ THÊM: CSS GIAO DIỆN HÌNH ẢNH SẢN PHẨM Ở BẢNG OMS */
 /* ========================================================================= */
 .img-cell { width: 80px; text-align: center; }
 .product-thumb { width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #dcdde1; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: block; margin: 0 auto; }
 .no-img { font-size: 11px; color: #95a5a6; font-style: italic; }

 .action-cell { display: flex; gap: 8px; }
 .btn-action { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;}
 .btn-ok { background: #2980b9; color: white; }
 .btn-ok:hover { background: #2471a3; }
 .btn-fail { background: #e74c3c; color: white; }
 .btn-fail:hover { background: #c0392b; }

 .badge { padding: 4px 8px; background: #e8f5e9; color: #2e7d32; border-radius: 4px; font-size: 11px; font-weight: bold; }
 .badge-vip { padding: 4px 10px; background: #fff9db; color: #f59f00; border-radius: 20px; font-size: 12px; font-weight: bold; border: 1px solid #ffe066;}
 .badge-normal { padding: 4px 10px; background: #e1f5fe; color: #0288d1; border-radius: 20px; font-size: 12px; font-weight: bold;}

 .revenue-container { display: flex; gap: 20px; margin-top: 25px; }
 .box-rev { flex: 1; padding: 25px; border-radius: 8px; color: white; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
 .box-rev.today { background: linear-gradient(135deg, #1dd1a1, #10ac84); }
 .box-rev.month { background: linear-gradient(135deg, #2e86de, #54a0ff); }
 .box-rev h2 { font-size: 36px; margin: 8px 0; font-weight: 800; }
 .custom-progress { width: 100%; height: 5px; background: rgba(255,255,255,0.3); border-radius: 10px; margin-top: 15px; }
 .custom-progress .line { height: 100%; background: #fff; border-radius: 10px; }

 .clickable-id { color: #2980b9; cursor: pointer; text-decoration: underline; font-weight: bold; }
 .clickable-id:hover { color: #1f618d; }

 .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
 .modal-content-box { background: white; width: 620px; max-height: 80vh; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.15); animation: popupFade 0.2s ease-out; }
 .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #2c3e50; color: white; }
 .modal-header h2 { font-size: 16px; margin: 0; font-weight: 700; letter-spacing: 0.5px; }
 .close-btn { background: none; border: none; color: white; font-size: 26px; cursor: pointer; line-height: 1; }
 .modal-body { padding: 25px; overflow-y: auto; background: #fdfefe; }

 .timeline-wrapper { position: relative; border-left: 2px solid #34495e; margin-left: 15px; padding-left: 25px; display: flex; flex-direction: column; gap: 20px; }
 .timeline-item { position: relative; }
 .timeline-badge-circle { position: absolute; left: -34px; top: 5px; width: 12px; height: 12px; background: #e67e22; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 2px #34495e; }
 .timeline-content-card { background: #f8f9fa; padding: 14px 18px; border-radius: 4px; border: 1px solid #e2e8f0; }
 .time-stamp { font-size: 11px; color: #7f8c8d; font-weight: bold; margin-bottom: 5px; }
 .action-title { margin: 4px 0; color: #2c3e50; font-size: 13px; font-weight: 700; }
 .dept-tag { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #475569; }
 .status-state { font-size: 12px; color: #475569; margin: 5px 0; }
 .log-notes { background: #fff5f5; color: #c0392b; padding: 10px; border-radius: 4px; font-size: 13px; border-left: 4px solid #e74c3c; margin-top: 8px; font-weight: 500; }

 @keyframes popupFade { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
 </style>