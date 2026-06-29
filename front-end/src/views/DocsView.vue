<template>
   <div class="dashboard-container">
     <div class="sidebar">
       <div class="brand">LOGISTICS PRO</div>
       <div class="user-info">
         <div class="avatar">🗄️</div>
         <div>
            <h3>Phòng Tài Liệu</h3>
            <small style="color: #f1c40f;">Docs & Digital Archive</small>
         </div>
       </div>
       <div class="mission-box">
          <p>📌 Nghiệm thu hồ sơ:</p>
          <small>Rà soát chứng từ giao nhận (POD), đối chiếu phí BOT, phụ phí đường bộ và thực hiện đóng/niêm phong sổ sách kế toán kiểm toán.</small>
       </div>
       <button @click="logout" class="btn-logout">Đăng Xuất</button>
     </div>
 
     <div class="main-content">
       <header class="header-flex">
         <h1>🗄️ TRUNG TÂM QUẢN TRỊ LƯU TRỮ HỒ SƠ & CHỨNG TỪ VẬN TẢI (DOCS DEPT)</h1>
         <button @click="exportDataExcel" class="btn-export">📥 Xuất file báo cáo tài liệu</button>
       </header>
 
       <div class="kpi-grid">
          <div class="kpi-card total">
             <div class="kpi-icon">📁</div>
             <div class="kpi-info">
                <p>Hồ sơ đang lưu giữ</p>
                <h2>{{ kpi.totalArchives }} Bộ</h2>
             </div>
          </div>
          <div class="kpi-card done">
             <div class="kpi-icon">🔒</div>
             <div class="kpi-info">
                <p>Đã niêm phong kho số</p>
                <h2>{{ kpi.closedArchives }} Hồ sơ</h2>
             </div>
          </div>
          <div class="kpi-card warning">
             <div class="kpi-icon">📸</div>
             <div class="kpi-info">
                <p>Đã có ảnh minh chứng POD</p>
                <h2>{{ kpi.hasPodProof }} Đơn vị</h2>
             </div>
          </div>
       </div>
 
       <div class="card list-card" style="margin-top: 25px;">
          <h3>📋 Danh mục quản lý chứng từ trực tuyến</h3>
          <table class="data-table">
             <thead>
                <tr>
                   <th>Mã Đơn</th>
                   <th>Khách hàng</th>
                   <th>Hàng hóa</th>
                   <th>Số lượng</th>
                   <th>Trạng thái hồ sơ</th>
                   <th>Vị trí kho bãi</th>
                   <th>Hành động</th>
                </tr>
             </thead>
             <tbody>
                <tr v-for="doc in docs" :key="doc.id">
                   <td><span class="id-tag">#{{ doc.id }}</span></td>
                   <td><span class="customer-txt">{{ doc.customer_name }}</span></td>
                   <td>
                      <span class="product-txt">{{ doc.product_name }}</span>
                      <span class="sub-txt">Tuyến đường: {{ doc.delivery_route }}</span>
                   </td>
                   <td>{{ doc.quantity }} kiện</td>
                   <td>
                      <span :class="['badge', doc.status === 'DONE' ? 'badge-success' : 'badge-warning']">
                         {{ doc.status === 'DONE' ? 'Đã nghiệm thu vĩnh viễn' : 'Đang tập kết Docs' }}
                      </span>
                   </td>
                   <td><span class="id-tag">{{ doc.warehouse_location }}</span></td>
                   <td>
                      <div style="display: flex; gap: 8px;">
                         <button @click="openDetails(doc)" class="btn-action view-btn">👁️ Xem chi tiết</button>
                         <button v-if="doc.status !== 'DONE'" @click="lockArchive(doc.id)" class="btn-action lock-btn">🔒 Niêm phong</button>
                      </div>
                   </td>
                </tr>
                <tr v-if="docs.length === 0">
                   <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 30px;">
                      Hiện tại chưa có hồ sơ nào luân chuyển đến phân hệ này.
                   </td>
                </tr>
             </tbody>
          </table>
       </div>
     </div>
 
     <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-container">
           <div class="modal-header">
              <h2>🗂️ CHI TIẾT HỒ SƠ LƯU TRỮ ĐIỆN TỬ - ĐƠN HÀNG #{{ selectedDoc.id }}</h2>
              <button @click="showModal = false" class="close-btn">&times;</button>
           </div>
           <div class="modal-body">
              <div class="modal-grid-layout">
                 <div>
                    <h4>📌 THÔNG TIN TỜ KHAI CƠ BẢN</h4>
                    
                    <table class="doc-table">
                       <tbody>
                          <tr><td><b>Mã định danh đơn hàng:</b></td><td>#{{ selectedDoc.id }}</td></tr>
                          <tr><td><b>Đơn vị khai báo khách hàng:</b></td><td>{{ selectedDoc.customer_name }}</td></tr>
                          <tr><td><b>Chi tiết danh mục hàng hóa:</b></td><td>{{ selectedDoc.product_name }}</td></tr>
                          <tr><td><b>Tổng khối lượng định biên:</b></td><td>{{ selectedDoc.quantity }} kiện hàng chuyên chở</td></tr>
                          <tr><td><b>Định giá trị hợp đồng (Cước):</b></td><td><b class="cost-txt">${{ selectedDoc.total_cost }} USD</b></td></tr>
                          <tr><td><b>Thời điểm xuất xưởng (OMS):</b></td><td>{{ new Date(selectedDoc.created_at).toLocaleString() }}</td></tr>
                          <tr><td><b>Vị trí kiểm soát hiện tại:</b></td><td><span style="color: #2980b9; font-weight: bold;">Phân hệ [{{ selectedDoc.current_dept }}] - Trạng thái: {{ selectedDoc.status }}</span></td></tr>
                       </tbody>
                    </table>
 
                    <h4 style="margin-top: 20px;">🚚 THÔNG TIN ĐIỀU PHỐI VẬN TẢI</h4>
                    <table class="doc-table">
                       <tbody>
                          <tr><td><b>Tuyến đường vận chuyển:</b></td><td>{{ selectedDoc.delivery_route }}</td></tr>
                          <tr><td><b>Đội xe & Tài xế phụ trách:</b></td><td>{{ selectedDoc.assigned_truck }}</td></tr>
                          <tr><td><b>Chi phí cầu đường (BOT):</b></td><td>${{ selectedDoc.bot_fee }} USD</td></tr>
                          <tr><td><b>Định mức tiêu hao nhiên liệu:</b></td><td>${{ selectedDoc.fuel_fee }} USD</td></tr>
                          <tr><td><b>Ghi chú từ hiện trường (Driver):</b></td><td><span class="driver-note">"{{ selectedDoc.driver_notes }}"</span></td></tr>
                       </tbody>
                    </table>
                 </div>
 
                 <div>
                    <h4>📸 CHỨNG TỪ GIAO NHẬN THỰC ĐỊA (POD PROOF)</h4>
                    <div v-if="selectedDoc.pod_image" class="pod-preview-wrapper">
                       <img :src="'http://localhost:3000' + selectedDoc.pod_image" alt="POD Proof" class="pod-image-render"/>
                    </div>
                    <div v-else class="no-pod-box">
                       ⚠️ Hiện chưa có hình ảnh biên bản bàn giao (POD) được đồng bộ tải lên từ ứng dụng Tài xế (Driver App).
                    </div>
                 </div>
              </div>
           </div>
        </div>
     </div>
   </div>
 </template>
 
 <script>
 import axios from 'axios';
 
 export default {
   name: 'DocsView',
   data() {
     return {
       docs: [],
       kpi: {
         totalArchives: 0,
         closedArchives: 0,
         hasPodProof: 0
       },
       showModal: false,
       selectedDoc: null
     };
   },
   mounted() {
     this.fetchDocsData();
   },
   methods: {
     async fetchDocsData() {
       try {
         const response = await axios.get('http://localhost:3000/api/orders/docs');
         this.docs = response.data.orders || [];
         this.kpi = response.data.kpi || { totalArchives: 0, closedArchives: 0, hasPodProof: 0 };
       } catch (error) {
         console.error('🔴 Lỗi tải dữ liệu phòng Docs:', error);
         alert('Không thể kết nối đến máy chủ Backend!');
       }
     },
     openDetails(doc) {
       this.selectedDoc = doc;
       this.showModal = true;
     },
     async lockArchive(id) {
       if (!confirm(`Bạn có chắc chắn muốn NIÊM PHONG hồ sơ #${id}? Sau khi khóa, dữ liệu sẽ được chuyển vào kho lưu trữ số vĩnh viễn và không thể chỉnh sửa chéo khâu.`)) return;
       try {
         await axios.put(`http://localhost:3000/api/orders/docs/${id}/lock`);
         alert('🔒 Đã niêm phong chứng từ thành công vào kho lưu trữ!');
         if (this.showModal && this.selectedDoc && this.selectedDoc.id === id) {
            this.showModal = false;
         }
         this.fetchDocsData();
       } catch (error) {
         console.error('🔴 Lỗi niêm phong hồ sơ:', error);
         alert('Thao tác khóa hồ sơ thất bại!');
       }
     },
     exportDataExcel() {
        alert('📥 Tính năng xuất file báo cáo Excel (Bảng kê nghiệm thu chứng từ) đang tải dữ liệu từ máy chủ...');
     },
     logout() {
       localStorage.clear();
       this.$router.push('/login');
     }
   }
 };
 </script>
 
 <style scoped>
 /* DASHBOARD LAYOUT & SIDEBAR */
 .dashboard-container { display: flex; min-height: 100vh; background: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
 .sidebar { width: 260px; background: #2c3e50; color: white; padding: 25px 20px; display: flex; flex-direction: column; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
 .brand { font-size: 20px; font-weight: 800; letter-spacing: 1px; color: #ecf0f1; text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 1px solid #34495e; }
 .user-info { display: flex; align-items: center; gap: 12px; margin-bottom: 30px; }
 .avatar { width: 45px; height: 45px; background: #34495e; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
 .user-info h3 { font-size: 14px; margin: 0; font-weight: 600; color: #f3f4f6; }
 .user-info small { font-size: 11px; font-weight: 500; }
 .mission-box { background: #34495e; padding: 12px; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #bdc3c7; border-left: 4px solid #f1c40f; margin-bottom: auto; }
 .mission-box p { font-weight: bold; margin: 0 0 5px 0; color: #fff; }
 .btn-logout { background: #e74c3c; color: white; border: none; padding: 11px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; margin-top: 20px; }
 .btn-logout:hover { background: #c0392b; }
 
 /* MAIN CONTENT */
 .main-content { flex: 1; padding: 30px; overflow-y: auto; }
 .header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
 .header-flex h1 { font-size: 19px; font-weight: 700; color: #2c3e50; margin: 0; }
 .btn-export { background: #27ae60; color: white; border: none; padding: 10px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 13px; transition: 0.2s; }
 .btn-export:hover { background: #219653; }
 
 /* KPI CARDS */
 .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
 .kpi-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); display: flex; align-items: center; gap: 20px; border-bottom: 4px solid #bdc3c7; }
 .kpi-card.total { border-bottom-color: #2980b9; }
 .kpi-card.done { border-bottom-color: #27ae60; }
 .kpi-card.warning { border-bottom-color: #f1c40f; }
 .kpi-icon { font-size: 35px; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #f8f9fa; }
 .kpi-info p { margin: 0 0 5px 0; font-size: 13px; color: #7f8c8d; font-weight: 500; }
 .kpi-info h2 { margin: 0; font-size: 22px; font-weight: 700; color: #2c3e50; }
 
 /* DATA TABLES */
 .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
 .list-card h3 { margin: 0 0 20px 0; font-size: 15px; color: #2c3e50; font-weight: 700; }
 .data-table { width: 100%; border-collapse: collapse; }
 .data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 13.5px; vertical-align: middle; }
 .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
 .data-table tbody tr:hover { background-color: #fbfcfc; } 
 .id-tag { background: #f1f2f6; padding: 3px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; color: #57606f; font-size: 12.5px; }
 .customer-txt { font-weight: 600; color: #2c3e50; }
 .product-txt { font-weight: 600; display: block; color: #333; }
 .sub-txt { display: block; font-size: 11.5px; color: #7f8c8d; margin-top: 3px; }
 .cost-txt { font-weight: bold; color: #27ae60; }
 .driver-note { display: block; font-size: 11.5px; color: #7f8c8d; font-style: italic; margin-top: 2px; line-height: 1.4; }
 
 /* BADGES */
 .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
 .badge-success { background: #d4efdf; color: #196f3d; }
 .badge-warning { background: #fcf3cf; color: #b7950b; }
 
 /* BUTTONS ACTION */
 .btn-action { border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; transition: 0.15s; }
 .view-btn { background: #3498db; color: white; }
 .view-btn:hover { background: #2980b9; }
 .lock-btn { background: #e67e22; color: white; }
 .lock-btn:hover { background: #d35400; }
 
 /* POPUP MODAL ARCHIVE */
 .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 999; }
 .modal-container { background: white; width: 850px; max-width: 90%; border-radius: 8px; box-shadow: 0 5px 25px rgba(0,0,0,0.2); overflow: hidden; animation: fadeIn 0.25s ease; }
 @keyframes fadeIn { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
 .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #2c3e50; color: white; }
 .modal-header h2 { font-size: 15px; margin: 0; font-weight: 700; letter-spacing: 0.5px; }
 .close-btn { background: none; border: none; color: white; font-size: 26px; cursor: pointer; line-height: 1; }
 .modal-body { padding: 25px; max-height: 75vh; overflow-y: auto; background: #fdfefe; }
 .modal-grid-layout { display: grid; grid-template-columns: 1.2fr 1fr; gap: 25px; }
 .modal-grid-layout h4 { margin: 0 0 12px 0; font-size: 13px; color: #2c3e50; border-left: 3px solid #34495e; padding-left: 8px; font-weight: bold; }
 
 /* TABLES INSIDE POPUP */
 .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 4px; }
 .doc-table td { padding: 10px 12px; font-size: 12.5px; border-bottom: 1px solid #edf2f7; color: #2d3748; }
 .doc-table td:first-child { width: 40%; color: #718096; font-weight: 500; }
 
 /* IMAGE RENDER POD */
 .pod-preview-wrapper { width: 100%; border: 2px dashed #cbd5e0; padding: 8px; border-radius: 6px; background: #fff; box-sizing: border-box; }
 .pod-image-render { width: 100%; height: auto; display: block; border-radius: 4px; object-fit: contain; max-height: 350px; }
 .no-pod-box { border: 2px dashed #e2e8f0; padding: 40px 20px; text-align: center; color: #a0aec0; font-size: 12.5px; border-radius: 6px; background: #f8f9fa; line-height: 1.5; }
 </style>