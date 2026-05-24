<template>
   <div class="dashboard-container">
     <div class="sidebar">
       <div class="brand">LOGISTICS FINANCE</div>
       <div class="user-info">
         <div class="avatar">📊</div>
         <div>
            <h3>PHÒNG KẾ TOÁN</h3>
            <small style="color: #2ecc71;">Kiểm soát dòng tiền</small>
         </div>
       </div>
       <div class="mission-box">
          <p>📌 Vai trò Đối soát:</p>
          <small>Kiểm tra dòng tiền thu từ Khách hàng, phê duyệt xuất kho và đối chiếu quyết toán phụ phí cầu đường, nhiên liệu từ Tài xế gửi về.</small>
       </div>
       <button @click="logout" class="btn-logout">Đăng Xuất</button>
     </div>
 
     <div class="main-content">
        <header>
           <h1>💵 TRUNG TÂM PHÊ DUYỆT DOANH THU & CHI PHÍ KẾ TOÁN (ACCOUNTING)</h1>
        </header>
 
        <div class="summary-cards-grid">
           <div class="summary-card revenue">
              <div class="card-icon">💰</div>
              <div class="card-info">
                 <p class="card-label">Tiền Thu Khách Hàng (Đã thu)</p>
                 <h2 class="card-value">{{ summary.collectedCustomerRevenue }} USD</h2>
                 <small>Dự kiến tổng thu: {{ summary.totalCustomerRevenue }} USD</small>
              </div>
           </div>
           
           <div class="summary-card cost">
              <div class="card-icon">⛽</div>
              <div class="card-info">
                 <p class="card-label">Tổng Chi Phí E-POD Tài Xế</p>
                 <h2 class="card-value">-{{ summary.totalEpodCost }} USD</h2>
                 <small>BOT: {{ summary.totalBotFee }} USD | Nhiên liệu: {{ summary.totalFuelFee }} USD</small>
              </div>
           </div>
           
           <div class="summary-card profit" :class="{ 'positive': summary.netProfit >= 0, 'negative': summary.netProfit < 0 }">
              <div class="card-icon">📈</div>
              <div class="card-info">
                 <p class="card-label">Lợi Nhuận Ròng Thực Tế</p>
                 <h2 class="card-value">{{ summary.netProfit }} USD</h2>
                 <small>Biên lợi nhuận thực tế</small>
              </div>
           </div>
        </div>
 
        <div class="card table-card">
           <h3>📥 Sổ cái tổng hợp chứng từ & Phân tách dòng tiền liên phòng ban</h3>
           
           <table class="data-table">
              <thead>
                 <tr>
                    <th>Mã Đơn</th>
                    <th>Thông tin Khách</th>
                    <th>Phần Tiền Khách (Thu)</th>
                    <th>Phần Tiền E-POD (Chi)</th>
                    <th>Vận hành Kho/Xe</th>
                    <th>Chứng từ Giao hàng</th>
                    <th>Trạng thái Thu/Chi</th>
                    <th>Hành động</th>
                 </tr>
              </thead>
              <tbody>
                 <tr v-for="order in orders" :key="order.id">
                    <td><strong class="order-id-tag">#{{ order.id }}</strong></td>
                    <td>
                       <span class="customer-name-txt">{{ order.customer_name }}</span>
                       <span class="product-sub-txt">📦 Hàng: {{ order.product_name }} (SL: {{ order.quantity }})</span>
                    </td>
                    <td>
                       <span class="money-in">+{{ order.total_cost }} USD</span>
                    </td>
                    <td>
                       <div v-if="order.bot_fee > 0 || order.fuel_fee > 0" class="epod-breakdown">
                          <span class="money-out">- Tổng: {{ order.bot_fee + order.fuel_fee }} USD</span>
                          <small>• Phí BOT: {{ order.bot_fee }} USD</small>
                          <small>• Nhiên liệu: {{ order.fuel_fee }} USD</small>
                       </div>
                       <span v-else class="text-muted">Chưa phát sinh</span>
                    </td>
                    <td>
                       <span class="dept-badge">🏬 Kho: {{ order.warehouse_location }}</span>
                       <span class="dept-badge">🚚 Lộ trình: {{ order.delivery_route }}</span>
                    </td>
                    <td>
                       <div v-if="order.pod_image">
                          <span class="badge-success">✓ Đã nộp POD</span>
                          <span class="text-notes" v-if="order.driver_notes">📝 Ghi chú: "{{ order.driver_notes }}"</span>
                       </div>
                       <span v-else class="badge-pending">⏳ Chưa có</span>
                    </td>
                    <td>
                       <span v-if="order.status === 'DONE'" class="status-tag status-done">💸 Đã Quyết Toán</span>
                       <span v-else-if="order.payment_status === 'PAID'" class="status-tag status-paid">💰 Đã Thu Tiền Khách</span>
                       <span v-else-if="order.payment_status === 'PENDING'" class="status-tag status-pending">⏳ Chờ Duyệt Tiền</span>
                       <span v-else class="status-tag status-unpaid">❌ Chưa đóng tiền</span>
                    </td>
                    <td>
                       <button 
                          v-if="order.current_dept === 'ACC' && (order.status === 'PENDING' || order.status === 'DELIVERED')"
                          @click="approveOrderPayment(order.id)" 
                          class="btn-approve-action"
                       >
                          {{ order.status === 'DELIVERED' ? 'Duyệt Chi E-POD' : 'Duyệt Thu Tiền Khách' }}
                       </button>
                       <span v-else class="text-locked">🔒 Đã khóa sổ cái</span>
                    </td>
                 </tr>
                 <tr v-if="orders.length === 0">
                    <td colspan="8" style="text-align: center; color: #7f8c8d; padding: 30px;">Hiện tại không có chứng từ phát sinh dòng tiền cần xử lý.</td>
                 </tr>
              </tbody>
           </table>
        </div>
     </div>
   </div>
</template>
 
<script>
import axios from 'axios';
 
export default {
   name: 'AccView',
   data() {
      return {
         orders: [],
         summary: {
            totalCustomerRevenue: 0,
            collectedCustomerRevenue: 0,
            totalEpodCost: 0,
            totalBotFee: 0,
            totalFuelFee: 0,
            netProfit: 0
         }
      };
   },
   created() {
      this.fetchFinancialData();
   },
   methods: {
      async fetchFinancialData() {
         try {
            const response = await axios.get('http://localhost:3000/api/orders/acc/orders');
            if (response.data) {
               this.orders = response.data.orders || [];
               this.summary = response.data.summary || this.summary;
            }
         } catch (err) {
            alert('Lỗi khi tải dữ liệu từ phòng Kế toán: ' + err.message);
         }
      },
      async approveOrderPayment(orderId) {
         if (!confirm(`Xác nhận phê duyệt luân chuyển dòng tiền và khóa sổ cái cho chứng từ #${orderId}?`)) return;
         try {
            const response = await axios.put(`http://localhost:3000/api/orders/acc/${orderId}/approve`);
            alert(response.data.message || 'Phê duyệt dòng tiền thành công!');
            this.fetchFinancialData(); // Cập nhật lại số liệu tức thì
         } catch (err) {
            alert('Lỗi trong quá trình phê duyệt: ' + err.message);
         }
      },
      logout() {
         localStorage.clear();
         this.$router.push('/login');
      }
   }
};
</script>
 
<style scoped>
  /* CẤU TRÚC GIAO DIỆN CHUNG */
  .dashboard-container { display: flex; min-height: 100vh; font-family: 'Segoe UI', Roboto, sans-serif; background: #f4f6f9; color: #2c3e50; }
  .sidebar { width: 280px; background: #2c3e50; color: white; padding: 30px 20px; display: flex; flex-direction: column; box-shadow: 4px 0 10px rgba(0,0,0,0.1); }
  .brand { font-size: 20px; font-weight: bold; letter-spacing: 1px; color: #f1c40f; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #34495e; padding-bottom: 15px; }
  .user-info { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
  .avatar { width: 45px; height: 45px; background: #34495e; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 20px; border: 2px solid #f1c40f; }
  .mission-box { background: #34495e; padding: 15px; border-radius: 6px; font-size: 13px; line-height: 1.5; color: #ecf0f1; margin-top: 10px; border-left: 4px solid #f1c40f; }
  .btn-logout { margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; transition: 0.3s; }
  .btn-logout:hover { background: #c0392b; }
  
  .main-content { flex: 1; padding: 30px 40px; overflow-y: auto; }
  header h1 { font-size: 24px; font-weight: 700; color: #2c3e50; margin: 0 0 25px 0; }
  
  /* GRID THẺ THỐNG KÊ DOANH THU */
  .summary-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
  .summary-card { background: white; padding: 20px; border-radius: 8px; display: flex; align-items: center; gap: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f5; }
  .card-icon { font-size: 35px; width: 60px; height: 60px; border-radius: 50%; display: flex; justify-content: center; align-items: center; }
  .revenue .card-icon { background: #e8f5e9; }
  .cost .card-icon { background: #ffebee; }
  .profit.positive .card-icon { background: #e3f2fd; }
  .profit.negative .card-icon { background: #fbe9e7; }
  .card-info { flex: 1; }
  .card-label { font-size: 13px; color: #7f8c8d; margin: 0 0 5px 0; font-weight: 600; text-transform: uppercase; }
  .card-value { font-size: 22px; font-weight: 700; margin: 0 0 4px 0; }
  .revenue .card-value { color: #2e7d32; }
  .cost .card-value { color: #c62828; }
  .profit.positive .card-value { color: #1565c0; }
  .profit.negative .card-value { color: #d84315; }
  .card-info small { font-size: 11.5px; color: #95a5a6; display: block; }
  
  /* THIẾT KẾ BẢNG SỔ CÁI */
  .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); border: 1px solid #eef2f5; }
  .table-card h3 { margin-top: 0; margin-bottom: 20px; font-size: 16px; color: #34495e; border-left: 4px solid #2c3e50; padding-left: 10px; }
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 13.5px; vertical-align: top; }
  .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  
  /* CHI TIẾT TỪNG PHẦN TIỀN */
  .order-id-tag { background: #eaeaea; padding: 3px 6px; border-radius: 4px; font-family: monospace; color: #333; }
  .customer-name-txt { font-weight: 600; display: block; color: #2c3e50; }
  .product-sub-txt { font-size: 12px; color: #7f8c8d; display: block; margin-top: 2px; }
  
  .money-in { color: #27ae60; font-weight: bold; font-size: 14px; }
  .money-out { color: #c0392b; font-weight: bold; font-size: 14px; display: block; }
  .epod-breakdown { display: flex; flex-direction: column; gap: 1px; }
  .epod-breakdown small { color: #7f8c8d; font-size: 11px; }
  
  .dept-badge { display: block; font-size: 11px; color: #4b5563; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; margin-bottom: 3px; width: fit-content; }
  .text-notes { display: block; background: #fff8e1; border: 1px dashed #ffe082; padding: 4px; border-radius: 4px; margin-top: 4px; font-style: italic; font-size: 11px; color: #b76e00; }
  
  /* TRẠNG THÁI */
  .status-tag { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
  .status-done { background: #e8f5e9; color: #2e7d32; }
  .status-paid { background: #e3f2fd; color: #1565c0; }
  .status-pending { background: #fff3e0; color: #ef6c00; }
  .status-unpaid { background: #ffebee; color: #c62828; }
  
  /* HÀNH ĐỘNG BUTTON */
  .btn-approve-action { padding: 6px 12px; background: #27ae60; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 12px; cursor: pointer; transition: 0.2s; box-shadow: 0 2px 4px rgba(39,174,96,0.2); }
  .btn-approve-action:hover { background: #219653; transform: translateY(-1px); }
  .text-locked { color: #94a3b8; font-size: 12px; font-style: italic; font-weight: 500; }
</style>