<template>
  <div class="dashboard-container">
    <div class="sidebar">
      <div class="brand">LOGISTICS PRO</div>
      <div class="user-info">
        <div class="avatar">{{ userRole.charAt(0) }}</div>
        <div>
           <h3>PHÒNG KHO ({{ userRole }})</h3>
           <small style="color: #2ecc71;">Trực tuyến vận hành</small>
        </div>
      </div>
      
      <div class="navigation-menu">
         <button @click="activeTab = 'inbound_outbound'" :class="{ active: activeTab === 'inbound_outbound' }" class="menu-btn">
            📦 Nhập / Xuất Kho & Quét Mã
         </button>
         <button @click="activeTab = 'locations'" :class="{ active: activeTab === 'locations' }" class="menu-btn">
            📍 Quản lý Vị trí Ô / Kệ
         </button>
         <button @click="activeTab = 'cargo_condition'" :class="{ active: activeTab === 'cargo_condition' }" class="menu-btn">
            ⚠️ Báo cáo Hư hại & Hoàn trả
         </button>
      </div>
 
      <button @click="logout" class="btn-logout">Đăng Xuất</button>
    </div>
 
    <div class="main-content">
      
       <div v-if="activeTab === 'inbound_outbound'">
          <header><h1>QUẢN LÝ NHẬP XUẤT KHO KÝ GỬI & QUÉT MÃ KIỆN HÀNG</h1></header>

          <div class="revenue-container" style="margin-bottom: 25px;">
             <div class="box-rev today">
                <p>KIỆN HÀNG ĐÃ QUÉT TRONG NGÀY</p>
                <h2>{{ orders.filter(o => o.is_scanned).length }} / {{ orders.length }} Kiện</h2>
                <div class="custom-progress">
                   <div class="line" :style="{ width: (orders.length ? (orders.filter(o => o.is_scanned).length / orders.length) * 100 : 0) + '%' }"></div>
                </div>
             </div>
             <div class="box-rev month">
                <p>HIỆU SUẤT LẤP ĐẦY KHO TRUNG CHUYỂN</p>
                <h2>68% Diện tích</h2>
                <div class="custom-progress"><div class="line" style="width: 68%"></div></div>
             </div>
          </div>

          <div class="card list-card">
              <h3>📦 Danh sách hàng chờ quét mã & xuất kho sang Vận tải (TMS)</h3>
              
              <div class="barcode-scanner-mock">
                 <input type="text" v-model="barcodeInput" placeholder="Nhấp vào đây rồi dùng máy quét hoặc nhập mã (VD: PKG-#ID) để quét nhanh..." @keyup.enter="handleBarcodeScan" class="scan-input" />
                 <button @click="handleBarcodeScan" class="btn-action btn-ok">Mô phỏng quét mã</button>
              </div>

              <table class="data-table">
                  <thead>
                      <tr>
                        <th>Mã kiện (QR/Barcode)</th><th>ID Đơn</th><th>Khách hàng</th><th>Hàng hóa</th><th>SL</th><th>Trạng thái quét</th><th>Thao tác xuất</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td>
                             <code class="barcode-tag">📋 PKG-{{ order.id }}0093</code>
                          </td>
                          <td><b>#{{ order.id }}</b></td>
                          <td>{{ order.customer_name }}</td>
                          <td>{{ order.product_name }}</td>
                          <td>{{ order.quantity }}</td>
                          <td>
                             <span v-if="order.is_scanned" class="badge-vip" style="background: #e8f5e9; color: #2e7d32; border-color: #a5d6a7;">✓ Đã quét mã</span>
                             <span v-else class="badge-normal" style="background: #ffe082; color: #b7791f;">⏳ Chờ quét kiểm kho</span>
                          </td>
                          <td>
                            <button @click="packOrder(order.id, order.is_scanned)" class="btn-action btn-ok" :disabled="!order.is_scanned" :style="{ opacity: order.is_scanned ? 1 : 0.5, cursor: order.is_scanned ? 'pointer' : 'not-allowed' }">
                               Bàn giao xe tải (TMS)
                            </button>
                          </td>
                      </tr>
                      <tr v-if="orders.length === 0">
                          <td colspan="7" style="text-align: center; color: #7f8c8d; padding: 30px; font-style: italic;">Kho trống - Chưa có hàng hóa cần luân chuyển.</td>
                      </tr>
                  </tbody>
              </table>
          </div>
       </div>

       <div v-if="activeTab === 'locations'">
          <header><h1>SƠ ĐỒ ĐỊNH VỊ VÀ SẮP XẾP KIỆN HÀNG CHUYÊN NGHIỆP</h1></header>
          <div class="card list-card" style="margin-top: 25px;">
              <h3>📍 Phân phối tọa độ lưu trữ (Giúp nhân viên bốc xếp tìm hàng nhanh)</h3>
              <table class="data-table">
                  <thead>
                      <tr>
                        <th>ID Đơn</th>
                        <th>Khách hàng</th>
                        <th>Hàng hóa</th>
                        <th>Số lượng</th>
                        <th>Vị trí lưu kho hiện tại</th>
                        <th>Hành động điều phối</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td><b>#{{ order.id }}</b></td>
                          <td><b>{{ order.customer_name }}</b></td>
                          <td>{{ order.product_name }}</td>
                          <td>{{ order.quantity }} kiện</td>
                          <td>
                             <span class="dept-tag" style="background: #34495e; color: #fff; font-size: 13px; padding: 4px 8px;">
                                {{ order.warehouse_location || '⚠️ Chưa xếp ô kệ (Đang ở sảnh nhận)' }}
                             </span>
                          </td>
                          <td>
                             <button @click="openLocationModal(order)" class="btn-action btn-ok" style="background: #27ae60;">✏️ Đổi vị trí ô kệ</button>
                          </td>
                      </tr>
                      <tr v-if="orders.length === 0">
                          <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Không có dữ liệu lưu trữ hàng hóa trong kho.</td>
                      </tr>
                  </tbody>
              </table>
          </div>
       </div>

       <div v-if="activeTab === 'cargo_condition'">
          <header><h1>BÁO CÁO HIỆN TRẠNG KIỆN HÀNG & XỬ LÝ HOÀN TRẢ</h1></header>
          <div class="card list-card" style="margin-top: 25px;">
              <h3>⚠️ Khảo sát tình trạng thực tế khi nhận hàng từ khách / Đối tác</h3>
              <p style="font-size: 13px; color: #7f8c8d; margin-top: -5px;">*Lập biên bản chụp ảnh tình trạng móp méo ngay tại sảnh kho để tránh rủi ro đền bù oan uổng.</p>
              
              <table class="data-table" style="margin-top: 15px;">
                  <thead>
                      <tr>
                        <th>ID Đơn</th>
                        <th>Chủ hàng</th>
                        <th>Tên mặt hàng</th>
                        <th>Tình trạng ghi nhận</th>
                        <th>Ảnh minh chứng</th>
                        <th>Xử lý nghiệp vụ kho</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr v-for="order in orders" :key="order.id">
                          <td><b>#{{ order.id }}</b></td>
                          <td>{{ order.customer_name }}</td>
                          <td>{{ order.product_name }}</td>
                          <td>
                             <span v-if="order.cargo_condition" class="badge-vip" style="background: #fff5f5; color: #e74c3c; border-color: #fab1a0;">
                                ❌ {{ order.cargo_condition }}
                             </span>
                             <span v-else class="badge" style="background: #e8f5e9; color: #2e7d32;">
                                ✓ Hàng nguyên đai nguyên kiện
                             </span>
                          </td>
                          <td>
                             <div v-if="order.cargo_image" class="mock-img-preview">
                                <span style="font-size: 11px; color: #2980b9; font-weight: bold;">🖼️ Đã đính kèm ảnh.jpg</span>
                             </div>
                             <span v-else style="color: #bdc3c7; font-size: 12px; font-style: italic;">Chưa đính kèm</span>
                          </td>
                          <td class="action-cell">
                             <button @click="openDamageModal(order)" class="btn-action btn-fail">⚠️ Lập BB Hư Hại</button>
                             <button @click="processReturnFromWms(order.id)" class="btn-action" style="background: #d35400; color: white;">↩️ Xuất trả hàng ngay</button>
                          </td>
                      </tr>
                      <tr v-if="orders.length === 0">
                          <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">Không có hàng hóa lỗi/cần kiểm tra.</td>
                      </tr>
                  </tbody>
              </table>
          </div>
       </div>
    </div>

    <div v-if="showLocationModal" class="modal-overlay" @click="showLocationModal = false">
      <div class="modal-content-box" @click.stop style="width: 450px;">
         <div class="modal-header">
            <h2>📍 Xếp Vị Trí Lưu Kho Cho Đơn #{{ selectedOrder?.id }}</h2>
            <button class="close-btn" @click="showLocationModal = false">×</button>
         </div>
         <div class="modal-body">
            <label style="display: block; font-weight: bold; margin-bottom: 8px; font-size: 13px;">Chọn Khu vực - Dãy kệ - Tầng chứa hàng:</label>
            <select v-model="targetLocation" class="form-select-custom">
               <option value="Khu A - Kệ 01 - Tầng 1">Khu A - Kệ 01 - Tầng 1 (Hàng nặng)</option>
               <option value="Khu A - Kệ 02 - Tầng 3">Khu A - Kệ 02 - Tầng 3 (Hàng giá trị cao)</option>
               <option value="Khu B - Kệ 05 - Tầng 2">Khu B - Kệ 05 - Tầng 2 (Bách hóa)</option>
               <option value="Khu C - Khu vực Chất Pallet">Khu C - Khu vực Chất Pallet nền kho</option>
            </select>
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
               <button @click="showLocationModal = false" class="btn-action" style="background: #bdc3c7; color: #000;">Hủy</button>
               <button @click="submitLocationChange" class="btn-action btn-ok">Xác nhận cập nhật</button>
            </div>
         </div>
      </div>
    </div>

    <div v-if="showDamageModal" class="modal-overlay" @click="showDamageModal = false">
      <div class="modal-content-box" @click.stop>
         <div class="modal-header" style="background: #e74c3c;">
            <h2>⚠️ Biên Bản Ghi Nhận Tình Trạng Hàng Lỗi #{{ selectedOrder?.id }}</h2>
            <button class="close-btn" @click="showDamageModal = false">×</button>
         </div>
         <div class="modal-body">
            <div class="log-notes" style="margin-top: 0; margin-bottom: 15px;">
               📌 <b>Lưu ý pháp lý:</b> Thông tin này sẽ làm căn cứ chứng minh hàng hóa đã lỗi trước khi nhập kho trung chuyển.
            </div>
            
            <div style="margin-bottom: 15px;">
               <label style="display: block; font-weight: bold; margin-bottom: 6px; font-size: 13px;">Mô tả chi tiết lỗi ngoại quan:</label>
               <textarea v-model="damageNotes" placeholder="Ví dụ: Thùng carton rách góc, đổ vỡ chất lỏng, móp méo vỏ ngoài nặng..." rows="3" class="form-textarea-custom"></textarea>
            </div>

            <div style="margin-bottom: 15px;">
               <label style="display: block; font-weight: bold; margin-bottom: 6px; font-size: 13px;">Chụp ảnh minh chứng (Cargo Photo):</label>
               <input type="file" @change="simulateImageUpload" accept="image/*" style="font-size: 13px;" />
               <p v-if="damageImageUploaded" style="color: #27ae60; font-size: 12px; font-weight: bold; margin-top: 5px;">✓ Tải ảnh lên bộ nhớ đệm thành công!</p>
            </div>

            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
               <button @click="showDamageModal = false" class="btn-action" style="background: #bdc3c7; color: #000;">Đóng</button>
               <button @click="submitDamageReport" class="btn-action btn-fail" style="background: #e74c3c;">Lưu biên bản</button>
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
const userRole = ref('WMS');
const activeTab = ref('inbound_outbound'); // Mặc định hiển thị tab quét mã nhập xuất

const orders = ref([]);
const barcodeInput = ref('');

// Các trạng thái đóng mở Modal tương tự cấu trúc OMS
const showLocationModal = ref(false);
const showDamageModal = ref(false);
const selectedOrder = ref(null);

const targetLocation = ref('');
const damageNotes = ref('');
const damageImageUploaded = ref(false);
  
// Hàm tải danh sách đơn hàng thuộc phòng quản lý WMS
const fetchOrders = async () => {
  try {
    const res = await axios.get('http://localhost:3000/api/orders/wms');
    // Thêm các thuộc tính client-side bổ sung giả lập nếu DB chưa hỗ trợ trường quét
    orders.value = res.data.map(order => ({
       ...order,
       is_scanned: order.is_scanned || false,
       warehouse_location: order.warehouse_location || '',
       cargo_condition: order.cargo_condition || '',
       cargo_image: order.cargo_image || false
    }));
  } catch (error) {
    console.error("Lỗi tải dữ liệu phòng WMS từ máy chủ");
  }
};

// 1. NGHIỆP VỤ QUÉT MÃ BARCODE GIẢ LẬP
const handleBarcodeScan = () => {
   if (!barcodeInput.value.trim()) return alert("Vui lòng nhập chuỗi mã Barcode!");
   
   // Trích xuất ID đơn hàng từ chuỗi giả lập quét mã (Ví dụ người dùng nhập hoặc quét ra chuỗi chứ kí tự số đơn hàng)
   const foundOrder = orders.value.find(o => barcodeInput.value.includes(o.id.toString()));
   
   if (foundOrder) {
      foundOrder.is_scanned = true;
      alert(`🎯 Quét mã thành công kiện hàng Đơn #${foundOrder.id}! Đã xác nhận khớp thông tin hệ thống.`);
      barcodeInput.value = '';
   } else {
      alert("❌ Mã kiện hàng (Barcode) không tồn tại trên hệ thống điều phối kho hiện tại!");
   }
};

// THAO TÁC ĐÓNG GÓI & XUẤT KHO SANG TMS (CẦN ĐIỀU KIỆN ĐÃ QUÉT MÃ)
const packOrder = async (orderId, isScanned) => {
  if (!isScanned) {
     return alert("Ngăn chặn: Kiện hàng này chưa được quét Barcode xác nhận nhập bãi, không thể xuất kho!");
  }
  try {
    await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
      status: 'PACKED',
      current_dept: 'TMS',
      from_dept: 'WMS'
    });
    alert("Đã hoàn tất đóng gói, dán tem QR tải trọng và bàn giao thành công sang Đội xe vận tải (TMS)!");
    fetchOrders();
  } catch (error) {
    alert("Thao tác xuất kho lên xe thất bại!");
  }
};

// 2. NGHIỆP VỤ QUẢN LÝ VỊ TRÍ Ô KỆ KHO
const openLocationModal = (order) => {
   selectedOrder.value = order;
   targetLocation.value = order.warehouse_location || 'Khu A - Kệ 01 - Tầng 1';
   showLocationModal.value = true;
};

const submitLocationChange = async () => {
   if (!selectedOrder.value) return;
   try {
      // Gửi API cập nhật tọa độ vị trí thực tế trong kho trung chuyển
      await axios.put(`http://localhost:3000/api/orders/${selectedOrder.value.id}/location`, {
         location: targetLocation.value
      });
      alert(`Đã gán thành công đơn hàng vào ô kệ: ${targetLocation.value}`);
      showLocationModal.value = false;
      fetchOrders();
   } catch (err) {
      // Hỗ trợ cập nhật trực tiếp tại local client nếu Endpoint API chưa cập nhật kịp
      selectedOrder.value.warehouse_location = targetLocation.value;
      alert(`[Demo Mode] Đã lưu tạm vị trí ô chứa hàng: ${targetLocation.value}`);
      showLocationModal.value = false;
   }
};

// 3. NGHIỆP VỤ BÁO CÁO HƯ HẠI (CARGO CONDITION)
const openDamageModal = (order) => {
   selectedOrder.value = order;
   damageNotes.value = order.cargo_condition || '';
   damageImageUploaded.value = order.cargo_image || false;
   showDamageModal.value = true;
};

const simulateImageUpload = () => {
   damageImageUploaded.value = true;
};

const submitDamageReport = async () => {
   if (!damageNotes.value.trim()) return alert("Vui lòng ghi nội dung hư hại!");
   try {
      await axios.put(`http://localhost:3000/api/orders/${selectedOrder.value.id}/condition`, {
         condition: damageNotes.value,
         has_image: damageImageUploaded.value
      });
      alert("Đã gửi biên bản hư hại và đồng bộ lên nhật ký hành trình hệ thống!");
      showDamageModal.value = false;
      fetchOrders();
   } catch (err) {
      selectedOrder.value.cargo_condition = damageNotes.value;
      selectedOrder.value.cargo_image = damageImageUploaded.value;
      alert("[Demo Mode] Ghi nhận hư hại ngoại quan thành công!");
      showDamageModal.value = false;
   }
};

// 4. TÍNH NĂNG TRẢ LẠI HÀNG NGAY TẠI KHO TRUNG CHUYỂN
const processReturnFromWms = async (orderId) => {
   const confirmReturn = confirm(`Bạn có chắc chắn muốn xuất lệnh TRẢ LẠI HÀNG đơn #${orderId} về trực tiếp người gửi do lỗi/vấn đề phát sinh không?`);
   if (!confirmReturn) return;
   
   try {
      // Gọi endpoint đổi trạng thái đơn hàng thành hoàn trả từ vị trí kho trung chuyển WMS
      await axios.put(`http://localhost:3000/api/orders/${orderId}/return-order`, {
         reason: "Hàng bị phát hiện hư hỏng / sai quy cách nghiêm trọng khi kiểm tra tại Kho WMS."
      });
      alert("Hệ thống đã lập lệnh xuất kho trả hàng hoàn thành công!");
      fetchOrders();
   } catch (error) {
      alert("Xử lý hoàn hàng tại kho gặp lỗi hệ thống!");
   }
};
  
onMounted(() => {
  if (!localStorage.getItem('role')) router.push('/');
  else {
     fetchOrders();
     setInterval(fetchOrders, 10000); // Tự động làm mới dữ liệu sau mỗi 10 giây giống OMS
  }
});
  
const logout = () => { localStorage.clear(); router.push('/'); };
</script>
 
<style scoped>
/* TOÀN BỘ CSS ĐƯỢC CHÉP TỪ OMS ĐỂ ĐẢM BẢO ĐỒNG BỘ GIAO DIỆN KHÔNG BỊ LỆCH */
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
.data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 14px;}
.data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase;}

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
/* Chỉnh lại dải màu Gradient cho hợp tông màu quản trị kho trung chuyển */
.box-rev.today { background: linear-gradient(135deg, #e67e22, #d35400); }
.box-rev.month { background: linear-gradient(135deg, #34495e, #2c3e50); }
.box-rev h2 { font-size: 36px; margin: 8px 0; font-weight: 800; }
.custom-progress { width: 100%; height: 5px; background: rgba(255,255,255,0.3); border-radius: 10px; margin-top: 15px; }
.custom-progress .line { height: 100%; background: #fff; border-radius: 10px; }

/* CSS CHO CÁC PHẦN FORM CHỨC NĂNG MỚI ĐƯỢC THÊM VÀO KHO HÀNG */
.barcode-scanner-mock { display: flex; gap: 10px; margin-bottom: 20px; background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px dashed #bdc3c7;}
.scan-input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 14px;}
.barcode-tag { font-family: monospace; background: #dfe6e9; padding: 3px 6px; border-radius: 3px; color: #2d3436; font-weight: bold;}
.mock-img-preview { border: 1px solid #3498db; background: #ebf5fb; padding: 4px 8px; border-radius: 4px; display: inline-block;}
.form-select-custom, .form-textarea-custom { width: 100%; padding: 10px; border: 1px solid #bdc3c7; border-radius: 4px; box-sizing: border-box; font-size: 14px; margin-top: 5px;}
.form-textarea-custom { font-family: sans-serif; resize: none;}
.dept-tag { background: #e2e8f0; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; color: #475569; }
.log-notes { background: #fff5f5; color: #c0392b; padding: 10px; border-radius: 4px; font-size: 13px; border-left: 4px solid #e74c3c; margin-top: 8px; font-weight: 500; }

/* OVERLAY MODAL TIMELINE POPUP STYLE */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.modal-content-box { background: white; width: 500px; max-height: 80vh; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 30px rgba(0,0,0,0.15); animation: popupFade 0.2s ease-out; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; background: #2c3e50; color: white; }
.modal-header h2 { font-size: 16px; margin: 0; font-weight: 700; letter-spacing: 0.5px; }
.close-btn { background: none; border: none; color: white; font-size: 26px; cursor: pointer; line-height: 1; }
.modal-body { padding: 25px; overflow-y: auto; background: #fdfefe; }

@keyframes popupFade { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
</style>