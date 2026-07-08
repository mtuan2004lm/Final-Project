<template>
    <div class="dashboard-container">
      <div class="sidebar">
        <div class="brand">LOGISTICS PRO</div>
        <div class="user-info">
          <div class="avatar">👑</div>
          <div>
             <h3>QUẢN TRỊ HỆ THỐNG</h3>
             <small style="color: #2ecc71;">Toàn quyền giám sát</small>
          </div>
        </div>
 
        <div class="navigation-menu">
           <button @click="activeTab = 'pipeline'" :class="{ active: activeTab === 'pipeline' }" class="menu-btn">
              🔄 Quy Trình Đơn Hàng
           </button>
           <button @click="activeTab = 'revenue'" :class="{ active: activeTab === 'revenue' }" class="menu-btn">
              📊 Tổng Quan Doanh Thu
           </button>
           <button @click="activeTab = 'ops'" :class="{ active: activeTab === 'ops' }" class="menu-btn">
              📦 Tổng Quan Vận Hành
           </button>
           <button @click="activeTab = 'reports'" :class="{ active: activeTab === 'reports' }" class="menu-btn">
              📄 Báo Cáo Từ Docs
           </button>
        </div>
 
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
 
      <div class="main-content">
 
         <!-- ============ TAB 1: QUY TRÌNH ĐƠN HÀNG (CHI TIẾT NHƯ TIKTOK SHOP) ============ -->
         <div v-if="activeTab === 'pipeline'">
            <header><h1>🔄 GIÁM SÁT TOÀN BỘ QUY TRÌNH LUÂN CHUYỂN ĐƠN HÀNG</h1></header>
 
            <div class="card list-card">
               <h3>📋 Tất cả đơn hàng trong hệ thống ({{ overview.totalOrders }} đơn)</h3>
               <table class="data-table">
                  <thead>
                     <tr>
                        <th>Mã Đơn</th>
                        <th>Khách hàng</th>
                        <th>Hàng hóa</th>
                        <th>Tiến trình</th>
                        <th>Phòng ban hiện tại</th>
                        <th>Ngày tạo</th>
                        <th>Hành động</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr v-for="order in overview.orders" :key="order.id">
                        <td><b class="order-id-tag">#{{ order.id }}</b></td>
                        <td><b>{{ order.customer_name }}</b></td>
                        <td>{{ order.product_name }} <small style="color:#7f8c8d;">(SL: {{ order.quantity }})</small></td>
                        <td>
                           <span v-if="order.status === 'RETURNED'" class="badge-returned">⚠️ Đã hoàn trả</span>
                           <span v-else class="mini-step-badge">
                              Bước {{ getStepIndex(order) }}/6 - {{ getStepLabel(order) }}
                           </span>
                        </td>
                        <td><span class="dept-badge">{{ order.current_dept || '—' }}</span></td>
                        <td><small>{{ formatDate(order.created_at) }}</small></td>
                        <td>
                           <button @click="openTimeline(order)" class="btn-action btn-view">🔍 Xem hành trình</button>
                        </td>
                     </tr>
                     <tr v-if="overview.orders.length === 0">
                        <td colspan="7" style="text-align:center; color:#95a5a6; padding:25px;">Chưa có đơn hàng nào trong hệ thống.</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>
 
         <!-- ============ TAB 2: TỔNG QUAN DOANH THU ============ -->
         <div v-if="activeTab === 'revenue'">
            <header><h1>📊 TỔNG QUAN DOANH THU & LỢI NHUẬN TOÀN CÔNG TY</h1></header>
 
            <div class="revenue-grid">
               <div class="box-rev today">
                  <p>DOANH THU HÔM NAY</p>
                  <h2>${{ revenue.today }}</h2>
               </div>
               <div class="box-rev month">
                  <p>DOANH THU THÁNG NÀY</p>
                  <h2>${{ revenue.month }}</h2>
               </div>
            </div>
 
            <div class="summary-cards-grid">
               <div class="summary-card revenue">
                  <div class="card-icon">💰</div>
                  <div class="card-info">
                     <p class="card-label">Tổng Tiền Đã Thu Khách Hàng</p>
                     <h2 class="card-value">{{ accSummary.collectedCustomerRevenue }} USD</h2>
                     <small>Dự kiến tổng thu: {{ accSummary.totalCustomerRevenue }} USD</small>
                  </div>
               </div>
               <div class="summary-card cost">
                  <div class="card-icon">⛽</div>
                  <div class="card-info">
                     <p class="card-label">Tổng Chi Phí E-POD Toàn Đội Xe</p>
                     <h2 class="card-value">-{{ accSummary.totalEpodCost }} USD</h2>
                     <small>BOT: {{ accSummary.totalBotFee }} USD | Nhiên liệu: {{ accSummary.totalFuelFee }} USD</small>
                  </div>
               </div>
               <div class="summary-card profit" :class="{ 'positive': accSummary.netProfit >= 0, 'negative': accSummary.netProfit < 0 }">
                  <div class="card-icon">📈</div>
                  <div class="card-info">
                     <p class="card-label">Lợi Nhuận Ròng Toàn Công Ty</p>
                     <h2 class="card-value">{{ accSummary.netProfit }} USD</h2>
                     <small>Doanh thu đã thu − Chi phí E-POD</small>
                  </div>
               </div>
            </div>
         </div>
 
         <!-- ============ TAB 3: TỔNG QUAN VẬN HÀNH (KHÔNG CHI TIẾT) ============ -->
         <div v-if="activeTab === 'ops'">
            <header class="header-flex">
               <h1>📦 TỔNG QUAN VẬN HÀNH TOÀN HỆ THỐNG (THEO PHÒNG BAN)</h1>
               <button @click="exportOrdersReport" class="btn-export">📥 Xuất báo cáo đơn hàng (CSV)</button>
            </header>
 
            <div class="dept-count-grid">
               <div class="dept-count-card" v-for="(count, dept) in overview.deptCounts" :key="dept">
                  <div class="dept-count-number">{{ count }}</div>
                  <div class="dept-count-label">{{ dept }}</div>
               </div>
               <div v-if="Object.keys(overview.deptCounts).length === 0" class="text-muted-empty">
                  Chưa có dữ liệu phòng ban.
               </div>
            </div>
 
            <div class="card list-card" style="margin-top: 25px;">
               <h3>📦 Danh sách đơn hàng tổng quan (không đi vào chi tiết từng kiện)</h3>
               <p class="hint-text">Xem chi tiết vị trí kệ, tình trạng hàng, quét mã vạch... vui lòng dùng phân hệ WMS/TMS chuyên trách.</p>
               <table class="data-table">
                  <thead>
                     <tr>
                        <th>Mã Đơn</th>
                        <th>Khách hàng</th>
                        <th>Hàng hóa</th>
                        <th>SL</th>
                        <th>Trạng thái</th>
                        <th>Phòng ban</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr v-for="order in overview.orders" :key="'ops-' + order.id">
                        <td><b class="order-id-tag">#{{ order.id }}</b></td>
                        <td>{{ order.customer_name }}</td>
                        <td>{{ order.product_name }}</td>
                        <td>{{ order.quantity }}</td>
                        <td><span class="badge-simple">{{ order.status }}</span></td>
                        <td><span class="dept-badge">{{ order.current_dept || '—' }}</span></td>
                     </tr>
                     <tr v-if="overview.orders.length === 0">
                        <td colspan="6" style="text-align:center; color:#95a5a6; padding:25px;">Chưa có đơn hàng nào.</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>
 
         <!-- ============ TAB 4: BÁO CÁO TỪ DOCS (MỞ XEM TRỰC TIẾP, KHÔNG TẢI FILE) ============ -->
         <div v-if="activeTab === 'reports'">
            <header><h1>📄 BÁO CÁO ĐƠN HÀNG DO PHÒNG CHỨNG TỪ (DOCS) GỬI</h1></header>
 
            <div class="card list-card">
               <h3>📥 Danh sách báo cáo đã nhận ({{ reports.length }})</h3>
               <table class="data-table">
                  <thead>
                     <tr>
                        <th>Tên Báo Cáo</th>
                        <th>Người Gửi</th>
                        <th>Thời Gian Gửi</th>
                        <th>Hành động</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr v-for="report in reports" :key="report.id">
                        <td><b>{{ report.title }}</b></td>
                        <td><span class="dept-badge">{{ report.created_by }}</span></td>
                        <td><small>{{ formatDateTime(report.created_at) }}</small></td>
                        <td>
                           <button @click="openReport(report.id)" class="btn-action btn-view">👁️ Mở xem</button>
                        </td>
                     </tr>
                     <tr v-if="reports.length === 0">
                        <td colspan="4" style="text-align:center; color:#95a5a6; padding:25px;">Chưa có báo cáo nào được Docs gửi.</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>
 
      </div>
 
      <!-- ============ MODAL: MỞ XEM BÁO CÁO TỪ DOCS (TRỰC TIẾP TRONG APP) ============ -->
      <div v-if="showReportModal" class="modal-overlay" @click.self="showReportModal = false">
         <div class="modal-content-box report-modal-box">
            <div class="modal-header">
               <h2>📄 {{ activeReport?.title }}</h2>
               <button class="close-btn" @click="showReportModal = false">×</button>
            </div>
            <div class="modal-body">
               <p class="hint-text">Gửi bởi: <b>{{ activeReport?.created_by }}</b> • Lúc: {{ formatDateTime(activeReport?.created_at) }} • Tổng {{ activeReport?.data?.length || 0 }} đơn hàng</p>
               <table class="data-table">
                  <thead>
                     <tr>
                        <th>Mã Đơn</th>
                        <th>Khách hàng</th>
                        <th>Hàng hóa</th>
                        <th>Trạng thái</th>
                        <th>Phòng ban</th>
                        <th>Cước phí (USD)</th>
                        <th>Phí BOT (USD)</th>
                        <th>Nhiên liệu (USD)</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr v-for="row in (activeReport?.data || [])" :key="row.id">
                        <td><b class="order-id-tag">#{{ row.id }}</b></td>
                        <td>{{ row.customer_name }}</td>
                        <td>{{ row.product_name }} <small>(SL: {{ row.quantity }})</small></td>
                        <td><span class="badge-simple">{{ row.status }}</span></td>
                        <td><span class="dept-badge">{{ row.current_dept }}</span></td>
                        <td>{{ row.total_cost }}</td>
                        <td>{{ row.bot_fee }}</td>
                        <td>{{ row.fuel_fee }}</td>
                     </tr>
                     <tr v-if="!activeReport?.data || activeReport.data.length === 0">
                        <td colspan="8" style="text-align:center; color:#95a5a6; padding:20px;">Báo cáo này không có dữ liệu đơn hàng.</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>
      </div>
 
      <!-- ============ MODAL: HÀNH TRÌNH CHI TIẾT ĐƠN HÀNG (KIỂU TIKTOK SHOP) ============ -->
      <div v-if="showTimelineModal" class="modal-overlay" @click.self="showTimelineModal = false">
         <div class="modal-content-box">
            <div class="modal-header">
               <h2>📜 Hành Trình Đơn Hàng #{{ selectedOrder?.id }}</h2>
               <button class="close-btn" @click="showTimelineModal = false">×</button>
            </div>
 
            <div class="modal-body">
               <!-- Thanh tiến trình trực quan kiểu tracking TikTok Shop -->
               <div v-if="selectedOrder?.status !== 'RETURNED'" class="stepper-row">
                  <div v-for="(label, idx) in stepLabels" :key="idx" class="stepper-step">
                     <div class="stepper-circle" :class="{ done: (idx + 1) <= getStepIndex(selectedOrder), current: (idx + 1) === getStepIndex(selectedOrder) }">
                        {{ idx + 1 }}
                     </div>
                     <div class="stepper-label">{{ label }}</div>
                     <div v-if="idx < stepLabels.length - 1" class="stepper-line" :class="{ done: (idx + 1) < getStepIndex(selectedOrder) }"></div>
                  </div>
               </div>
               <div v-else class="returned-banner">⚠️ Đơn hàng này đã bị hoàn trả về khách hàng, không tiếp tục quy trình chuẩn.</div>
 
               <h4 style="margin-top: 25px;">📌 Nhật ký chi tiết từng lần luân chuyển</h4>
               <div class="timeline-wrapper">
                  <div v-for="log in activeOrderHistory" :key="log.id" class="timeline-item">
                     <div class="timeline-badge-circle"></div>
                     <div class="timeline-content-card">
                        <div class="time-stamp">{{ formatDateTime(log.changed_at) }}</div>
                        <h4 class="action-title">
                           Trạng thái: <span class="dept-tag">{{ log.old_status || '—' }}</span> ➡️ <span class="dept-tag">{{ log.new_status }}</span>
                        </h4>
                        <p v-if="log.notes" class="log-notes">📝 {{ log.notes }}</p>
                     </div>
                  </div>
                  <div v-if="activeOrderHistory.length === 0" style="text-align: center; color: #95a5a6; padding: 25px; font-style: italic;">
                     Đơn hàng này chưa có lịch sử luân chuyển nào được ghi nhận.
                  </div>
               </div>
            </div>
         </div>
      </div>
 
    </div>
  </template>
 
  <script setup>
  import { ref, onMounted, onUnmounted } from 'vue';
  import axios from 'axios';
  import { useRouter } from 'vue-router';
 
  const router = useRouter();
  const activeTab = ref('pipeline');
 
  const overview = ref({ orders: [], totalOrders: 0, deptCounts: {}, statusCounts: {} });
  const revenue = ref({ today: 0, month: 0 });
  const accSummary = ref({
     totalCustomerRevenue: 0, collectedCustomerRevenue: 0,
     totalEpodCost: 0, totalBotFee: 0, totalFuelFee: 0, netProfit: 0
  });
 
  const showTimelineModal = ref(false);
  const selectedOrder = ref(null);
  const activeOrderHistory = ref([]);
 
  const reports = ref([]);
  const showReportModal = ref(false);
  const activeReport = ref(null);
 
  const stepLabels = ['Đặt hàng', 'Duyệt đơn (OMS)', 'Xử lý kho (WMS)', 'Vận chuyển (TMS)', 'Đã giao hàng', 'Hoàn tất'];
 
  // Suy luận đơn hàng đang ở bước thứ mấy trong 6 bước chuẩn, dựa trên status + current_dept hiện tại.
  // Đây là ước lượng trực quan cho Admin xem tổng quan, không thay thế nghiệp vụ chi tiết của từng phòng ban.
  const getStepIndex = (order) => {
     if (!order) return 1;
     const status = (order.status || '').toUpperCase();
     const dept = (order.current_dept || '').toUpperCase();
     if (status === 'DONE' || dept === 'ARCHIVED') return 6;
     if (status === 'DELIVERED') return 5;
     if (status === 'SHIPPING' || dept === 'TMS') return 4;
     if (status === 'PACKED' || dept === 'WMS') return 3;
     if (status === 'APPROVED') return 2;
     return 1;
  };
 
  const getStepLabel = (order) => stepLabels[getStepIndex(order) - 1] || '';
 
  const fetchOverview = async () => {
     try {
        const res = await axios.get('http://localhost:3000/api/orders/admin/overview');
        overview.value = res.data;
     } catch (err) {
        console.error('Lỗi tải tổng quan đơn hàng:', err);
     }
  };
 
  // Xuất báo cáo CSV (mở được thẳng bằng Excel) từ toàn bộ đơn hàng đang có trong overview.orders
  const exportOrdersReport = () => {
     const list = overview.value.orders || [];
     if (list.length === 0) {
        alert('⚠️ Không có đơn hàng nào để xuất báo cáo!');
        return;
     }
 
     const headers = [
        'Mã Đơn', 'Khách Hàng', 'Hàng Hóa', 'Số Lượng', 'Trạng Thái', 'Phòng Ban Hiện Tại',
        'Vị Trí Kho Bãi', 'Tuyến Đường', 'Xe Phụ Trách', 'Phí BOT (USD)', 'Phí Nhiên Liệu (USD)',
        'Cước Phí (USD)', 'Trạng Thái Thanh Toán', 'Ngày Tạo'
     ];
 
     const rows = list.map(o => [
        o.id, o.customer_name, o.product_name, o.quantity, o.status, o.current_dept,
        o.warehouse_location, o.delivery_route, o.assigned_truck, o.bot_fee, o.fuel_fee,
        o.total_cost, o.payment_status, o.created_at ? new Date(o.created_at).toLocaleDateString('vi-VN') : ''
     ]);
 
     const escapeCsv = (val) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
           return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
     };
 
     const csvContent = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
     const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
 
     const now = new Date();
     const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
     const link = document.createElement('a');
     link.href = url;
     link.setAttribute('download', `BaoCao_TongQuan_Admin_${stamp}.csv`);
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     URL.revokeObjectURL(url);
  };
 
  const fetchRevenue = async () => {
     try {
        const res = await axios.get('http://localhost:3000/api/orders/oms/analytics/revenue');
        revenue.value = res.data;
     } catch (err) {
        console.error('Lỗi tải doanh thu ngày/tháng:', err);
     }
  };
 
  const fetchAccSummary = async () => {
     try {
        const res = await axios.get('http://localhost:3000/api/orders/acc/orders');
        accSummary.value = res.data.summary || accSummary.value;
     } catch (err) {
        console.error('Lỗi tải tổng kết kế toán:', err);
     }
  };
 
  // ĐÃ SỬA: dùng đúng route "/history/:id" đã đăng ký trong orderRoutes.js
  // (khác với OmsView.vue đang gọi nhầm "/:id/history" - route đó không tồn tại nên bị lỗi).
  const openTimeline = async (order) => {
     selectedOrder.value = order;
     try {
        const res = await axios.get(`http://localhost:3000/api/orders/history/${order.id}`);
        activeOrderHistory.value = res.data;
        showTimelineModal.value = true;
     } catch (err) {
        alert('Không thể tải lịch sử hành trình đơn hàng này!');
     }
  };
 
  // MỚI: danh sách báo cáo Docs đã gửi + mở xem chi tiết 1 báo cáo trực tiếp trong app
  const fetchReports = async () => {
     try {
        const res = await axios.get('http://localhost:3000/api/orders/admin/reports');
        reports.value = res.data;
     } catch (err) {
        console.error('Lỗi tải danh sách báo cáo:', err);
     }
  };
 
  const openReport = async (reportId) => {
     try {
        const res = await axios.get(`http://localhost:3000/api/orders/admin/reports/${reportId}`);
        activeReport.value = res.data;
        showReportModal.value = true;
     } catch (err) {
        alert('Không thể mở báo cáo này!');
     }
  };
 
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—';
 
  let adminInterval = null;
  const refreshAllData = () => {
     fetchOverview();
     fetchRevenue();
     fetchAccSummary();
     fetchReports();
  };
 
  onMounted(() => {
     if (!localStorage.getItem('role')) {
        router.push('/');
     } else {
        refreshAllData();
        adminInterval = setInterval(refreshAllData, 8000);
     }
  });
 
  onUnmounted(() => { if (adminInterval) clearInterval(adminInterval); });
 
  const logout = () => { localStorage.clear(); router.push('/'); };
  </script>
 
  <style scoped>
  .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
  .sidebar { width: 250px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; box-sizing: border-box;}
  .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; }
  .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid #34495e; margin-bottom: 20px; }
  .avatar { width: 40px; height: 40px; background: #f1c40f; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 20px;}
  .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  .main-content { flex: 1; padding: 30px; overflow-y: auto; background: #fff;}
  .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f5;}
  .navigation-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 10px;}
  .menu-btn { padding: 12px 15px; background: none; border: none; color: #b2bec3; text-align: left; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; transition: all 0.2s;}
  .menu-btn:hover, .menu-btn.active { background: #34495e; color: #fff; }
  header h1 { font-size: 21px; font-weight: 800; color: #2c3e50; margin: 0 0 25px 0; }
  .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
  .header-flex h1 { margin: 0; }
  .btn-export { background: #27ae60; color: white; border: none; padding: 10px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px; transition: 0.2s; white-space: nowrap; }
  .btn-export:hover { background: #219653; }
 
  .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  .data-table th, .data-table td { padding: 12px 15px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 13px; vertical-align: middle;}
  .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase;}
  .order-id-tag { background: #eaeaea; padding: 3px 6px; border-radius: 4px; font-family: monospace; color: #333; }
  .dept-badge { display: inline-block; font-size: 11px; color: #4b5563; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-weight: bold;}
  .badge-simple { font-size: 11px; font-weight: bold; background: #eef2f7; color: #34495e; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;}
  .badge-returned { font-size: 11px; font-weight: bold; background: #ffebee; color: #c62828; padding: 4px 8px; border-radius: 4px;}
  .mini-step-badge { font-size: 12px; font-weight: bold; background: #e3f2fd; color: #1565c0; padding: 4px 8px; border-radius: 4px; display: inline-block;}
  .hint-text { font-size: 12px; color: #7f8c8d; font-style: italic; margin: -10px 0 5px 0; }
 
  .btn-action { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;}
  .btn-view { background: #2980b9; color: white; }
  .btn-view:hover { background: #2471a3; }
 
  .revenue-grid { display: flex; gap: 20px; margin-bottom: 25px; }
  .box-rev { flex: 1; padding: 25px; border-radius: 8px; color: white; box-shadow: 0 6px 18px rgba(0,0,0,0.06); }
  .box-rev.today { background: linear-gradient(135deg, #1dd1a1, #10ac84); }
  .box-rev.month { background: linear-gradient(135deg, #2e86de, #54a0ff); }
  .box-rev p { margin: 0; font-size: 12px; font-weight: bold; text-transform: uppercase; opacity: 0.9;}
  .box-rev h2 { font-size: 32px; margin: 8px 0 0 0; font-weight: 800; }
 
  .summary-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .summary-card { background: white; padding: 20px; border-radius: 8px; display: flex; align-items: center; gap: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f5; }
  .card-icon { font-size: 32px; width: 55px; height: 55px; border-radius: 50%; display: flex; justify-content: center; align-items: center; }
  .revenue .card-icon { background: #e8f5e9; }
  .cost .card-icon { background: #ffebee; }
  .profit.positive .card-icon { background: #e3f2fd; }
  .profit.negative .card-icon { background: #fbe9e7; }
  .card-info { flex: 1; }
  .card-label { font-size: 12px; color: #7f8c8d; margin: 0 0 5px 0; font-weight: 600; text-transform: uppercase; }
  .card-value { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; }
  .revenue .card-value { color: #2e7d32; }
  .cost .card-value { color: #c62828; }
  .profit.positive .card-value { color: #1565c0; }
  .profit.negative .card-value { color: #d84315; }
  .card-info small { font-size: 11px; color: #95a5a6; display: block; }
 
  .dept-count-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
  .dept-count-card { background: white; border: 1px solid #eef2f5; border-radius: 8px; padding: 18px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
  .dept-count-number { font-size: 28px; font-weight: 800; color: #2c3e50; }
  .dept-count-label { font-size: 12px; font-weight: bold; color: #7f8c8d; text-transform: uppercase; margin-top: 4px; }
  .text-muted-empty { color: #95a5a6; font-style: italic; padding: 10px; }
 
  .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
  .modal-content-box { background: white; width: 680px; max-height: 82vh; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.15); }
  .report-modal-box { width: 920px; max-width: 92vw; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #2c3e50; color: white; }
  .modal-header h2 { font-size: 16px; margin: 0; font-weight: 700; }
  .close-btn { background: none; border: none; color: white; font-size: 26px; cursor: pointer; line-height: 1; }
  .modal-body { padding: 25px; overflow-y: auto; background: #fdfefe; }
 
  .returned-banner { background: #ffebee; color: #c62828; padding: 14px; border-radius: 6px; font-weight: bold; text-align: center; border: 1px dashed #ef5350; }
 
  /* STEPPER TRACKING KIỂU TIKTOK SHOP */
  .stepper-row { display: flex; align-items: flex-start; }
  .stepper-step { flex: 1; display: flex; flex-direction: column; align-items: center; position: relative; }
  .stepper-circle { width: 30px; height: 30px; border-radius: 50%; background: #dcdde1; color: #7f8c8d; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; z-index: 2; }
  .stepper-circle.done { background: #27ae60; color: white; }
  .stepper-circle.current { background: #e67e22; color: white; box-shadow: 0 0 0 4px rgba(230,126,34,0.25); }
  .stepper-label { font-size: 10.5px; text-align: center; margin-top: 6px; color: #57606f; font-weight: 600; max-width: 80px; }
  .stepper-line { position: absolute; top: 15px; left: 50%; width: 100%; height: 3px; background: #dcdde1; z-index: 1; }
  .stepper-line.done { background: #27ae60; }
 
  .timeline-wrapper { position: relative; border-left: 2px solid #34495e; margin-left: 15px; padding-left: 25px; display: flex; flex-direction: column; gap: 20px; }
  .timeline-item { position: relative; }
  .timeline-badge-circle { position: absolute; left: -34px; top: 5px; width: 12px; height: 12px; background: #e67e22; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 2px #34495e; }
  .timeline-content-card { background: #f8f9fa; padding: 14px 18px; border-radius: 4px; border: 1px solid #e2e8f0; }
  .time-stamp { font-size: 11px; color: #7f8c8d; font-weight: bold; margin-bottom: 5px; }
  .action-title { margin: 4px 0; color: #2c3e50; font-size: 13px; font-weight: 700; }
  .dept-tag { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #475569; }
  .log-notes { background: #fff5f5; color: #c0392b; padding: 10px; border-radius: 4px; font-size: 13px; border-left: 4px solid #e74c3c; margin-top: 8px; font-weight: 500; }
  </style>