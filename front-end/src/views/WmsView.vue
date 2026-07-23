<template>
   <div class="dashboard-container">
     <div class="sidebar">
       <div class="brand">LOGISTICS PRO</div>
       <div class="user-info">
         <div class="avatar">{{ userRole.charAt(0) }}</div>
         <div>
            <h3>WAREHOUSE DEPARTMENT ({{ userRole }})</h3>
            <small style="color: #2ecc71;">Operations Online</small>
         </div>
       </div>

       <div class="navigation-menu">
          <button @click="activeTab = 'inbound'" :class="{ active: activeTab === 'inbound' }" class="menu-btn">
             📥 1. Inbound & Package Registration
          </button>
          <button @click="activeTab = 'locations'" :class="{ active: activeTab === 'locations' }" class="menu-btn">
             📍 2. Bin / Shelf Location Management
          </button>
          <button @click="activeTab = 'cargo_condition'" :class="{ active: activeTab === 'cargo_condition' }" class="menu-btn">
             ⚠️ 3. Damage Report & Photos
          </button>
          <button @click="activeTab = 'outbound'" :class="{ active: activeTab === 'outbound' }" class="menu-btn">
             📤 4. Outbound & Handover to TMS
          </button>
          <button @click="switchToHistoryTab" :class="{ active: activeTab === 'warehouse_history' }" class="menu-btn" style="color: #f39c12;">
             📜 5. Inbound/Outbound Log
          </button>
       </div>

       <button @click="logout" class="btn-logout">Log Out</button>
     </div>

     <div class="main-content">
       <div v-if="activeTab === 'inbound'">
          <header>
             <h1>TRANSIT YARD INBOUND CARGO RECEIVING MANAGEMENT</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Order Code</th>
                      <th>Order Image</th>
                      <th>Product Name</th>
                      <th>Quantity</th>
                      <th>Current Department</th>
                      <th>Operational Status</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <img :src="getImageUrl(order.cargo_image || order.product_image)" class="table-img-preview" alt="Cargo image" />
                      </td>
                      <td><b>{{ order.product_name }}</b><br><small style="color: #7f8c8d;">Owner: {{ order.customer_name }}</small></td>
                      <td>{{ order.quantity }} packages</td>
                      <td><span class="dept-badge wms">{{ order.current_dept }}</span></td>
                      <td><span class="status-badge process">🏬 AWAITING WAREHOUSE PROCESSING</span></td>
                   </tr>
                   <tr v-if="wmsOrders.length === 0">
                      <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">There are currently no packages awaiting yard intake.</td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>

       <div v-if="activeTab === 'locations'">
          <header>
             <h1>WAREHOUSE BIN / SHELF LOCATION ASSIGNMENT SYSTEM</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Order Code</th>
                      <th>Current Image</th>
                      <th>Product</th>
                      <th>Current Location</th>
                      <th>New Bin / Shelf Location</th>
                      <th>Action</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <img :src="getImageUrl(order.cargo_image || order.product_image)" class="table-img-preview" />
                      </td>
                      <td>{{ order.product_name }}</td>
                      <td>
                         <span v-if="order.warehouse_location" class="location-tag">📍 {{ order.warehouse_location }}</span>
                         <span v-else style="color: #e74c3c; font-style: italic;">⚠️ Not Shelved Yet</span>
                      </td>
                      <td>
                        <select v-model="locationInputs[order.id]" class="table-input">
                            <option value="" disabled>-- Select Storage Bin / Shelf --</option>
                            <option value="Zone A - Shelf 01 (Regular Goods)">Zone A - Shelf 01 (Regular Goods)</option>
                            <option value="Zone A - Shelf 02 (Regular Goods)">Zone A - Shelf 02 (Regular Goods)</option>
                            <option value="Zone B - Shelf 01 (Heavy/Bulky Goods)">Zone B - Shelf 01 (Heavy/Bulky Goods)</option>
                            <option value="Zone C - Cold Shelf (Low Temperature)">Zone C - Cold Shelf (Low Temperature)</option>
                            <option value="Zone D - Fragile Goods Shelf (VIP)">Zone D - Fragile Goods Shelf (VIP)</option>
                            <option value="Zone E - Urgent Delivery Shelf (VVIP)">Zone E - Urgent Delivery Shelf (VVIP)</option>
                        </select>
                      </td>
                      <td>
                         <button @click="updateLocation(order.id)" class="btn-action-cyan">🎯 Save Location</button>
                      </td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>

       <div v-if="activeTab === 'cargo_condition'">
          <header>
             <h1>WAREHOUSE INSPECTION CONDITION & DAMAGE ASSESSMENT REPORT</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Order Code</th>
                      <th>Original Image (OMS)</th>
                      <th>Damage Image (WMS)</th>
                      <th>Product</th>
                      <th>Current Condition Report</th>
                      <th>Update Condition & Upload New Warehouse Photo</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>

                      <td>
                         <img :src="getImageUrl(order.product_image)" class="table-img-preview" alt="Original image" />
                      </td>

                      <td>
                         <img v-if="order.damage_image" :src="getImageUrl(order.damage_image)" class="table-img-preview" style="border: 2px solid #e74c3c;" alt="Damage image" />
                         <span v-else style="color: #95a5a6; font-size: 12px; font-style: italic;">Not recorded yet</span>
                      </td>

                      <td>{{ order.product_name }}</td>
                      <td>
                         <p class="condition-text" v-if="order.cargo_condition">💬 {{ order.cargo_condition }}</p>
                         <span v-else style="color: #27ae60; font-weight: bold;">💚 Goods Intact and Sealed</span>
                      </td>
                      <td>
                         <div class="report-box-grid">
                            <input type="text" v-model="conditionInputs[order.id]" placeholder="Describe damage if any..." class="table-input" />
                            <!-- Native <input type="file"> button text ("Chọn tệp" / "No file chosen") is rendered
                                 by the browser itself based on its OS/browser locale and cannot be overridden via
                                 HTML/Vue. So the real input is hidden and a custom English button + filename label
                                 is used instead, triggering the hidden input via .click(). -->
                            <input
                               type="file"
                               :ref="el => { if (el) fileInputRefs[order.id] = el }"
                               @change="onFileChange($event, order.id)"
                               accept="image/*"
                               style="display: none;"
                            />
                            <div class="file-upload-row">
                               <button type="button" class="btn-choose-file" @click="fileInputRefs[order.id]?.click()">📎 Choose File</button>
                               <span class="file-name-txt">{{ fileInputs[order.id]?.name || 'No file chosen' }}</span>
                            </div>
                            <button @click="submitConditionReport(order.id)" class="btn-action-orange">⚠️ Submit Report</button>
                         </div>
                      </td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>

       <div v-if="activeTab === 'outbound'">
          <header>
             <h1>TRANSIT OUTBOUND APPROVAL & HANDOVER TO TMS FLEET</h1>
          </header>
          <div class="card">
             <table class="data-table">
                <thead>
                   <tr>
                      <th>Order Code</th>
                      <th>Handover Image</th>
                      <th>Product</th>
                      <th>Storage Location</th>
                      <th>Condition & Scan Status</th>
                      <th>Operation Command</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="order in wmsOrders" :key="order.id">
                      <td><b class="order-id-tag">{{ formatOrderId(order.id) }}</b></td>
                      <td>
                         <img :src="getImageUrl(order.cargo_image || order.product_image)" class="table-img-preview" />
                      </td>
                      <td><b>{{ order.product_name }}</b></td>
                      <td><span class="location-tag">📍 {{ order.warehouse_location || 'General Warehouse' }}</span></td>
                      <td>
                         <div style="margin-bottom: 6px;">
                            <span v-if="order.cargo_condition" style="color: #e67e22; font-size: 13px;">⚠️ {{ order.cargo_condition }}</span>
                            <span v-else style="color: #27ae60; font-size: 13px;">💚 Normal</span>
                         </div>
                         <div>
                            <span v-if="order.is_scanned" style="color: #2ecc71; font-size: 12px; font-weight: bold;">✔️ Package Scanned</span>
                            <span v-else style="color: #e74c3c; font-size: 12px; font-weight: bold;">❌ Package Not Scanned</span>
                         </div>
                      </td>
                      <td>
                         <div style="display: flex; flex-direction: column; gap: 6px;">
                            <button v-if="!order.is_scanned" @click="scanOrder(order.id)" class="btn-action-blue">🔍 Scan to Confirm Order</button>

                            <button
                               @click="releaseToTms(order.id)"
                               :disabled="!order.is_scanned"
                               :class="{ 'btn-disabled': !order.is_scanned }"
                               class="btn-action-green"
                            >
                               📤 Release from Warehouse & Hand Over to TMS
                            </button>
                         </div>
                      </td>
                   </tr>
                   <tr v-if="wmsOrders.length === 0">
                      <td colspan="6" style="text-align: center; color: #7f8c8d; padding: 20px;">There are currently no packages.</td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>

       <div v-if="activeTab === 'warehouse_history'">
          <header>
             <h1>📜 SEARCH INBOUND/OUTBOUND LOG BY ORDER CODE</h1>
          </header>
          <div class="card">
             <div class="search-box">
                <input
                   type="text"
                   v-model="searchOrderId"
                   @keyup.enter="searchOrderLogs"
                   placeholder="Enter Order Code (e.g.: PKG-60015 or 15)"
                   class="table-input"
                   style="width: 260px;"
                />
                <button @click="searchOrderLogs" class="btn-action-cyan">🔍 Search</button>
             </div>

             <table class="data-table" v-if="hasSearched" style="margin-top: 18px;">
                <thead>
                   <tr>
                      <th>Order Code</th>
                      <th>Recorded Activity</th>
                      <th>Old Status</th>
                      <th>New Status</th>
                      <th>Change Time</th>
                   </tr>
                </thead>
                <tbody>
                   <tr v-for="(log, idx) in warehouseLogs" :key="idx">
                      <td><b class="order-id-tag">{{ formatOrderId(log.order_id) }}</b></td>
                      <td><span class="log-notes-txt">{{ log.notes }}</span></td>
                      <td><span class="status-badge-old">{{ log.old_status }}</span></td>
                      <td><span class="status-badge-new">{{ log.new_status }}</span></td>
                      <td style="color: #7f8c8d; font-size: 13px;">{{ formatDate(log.changed_at) }}</td>
                   </tr>
                   <tr v-if="warehouseLogs.length === 0">
                      <td colspan="5" style="text-align: center; color: #95a5a6; padding: 20px;">No inbound/outbound log found for this order code.</td>
                   </tr>
                </tbody>
             </table>

             <p v-else style="color: #95a5a6; margin-top: 18px;">Please enter an Order Code to view the corresponding log.</p>
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
const userRole = ref(localStorage.getItem('role') || 'WMS_STAFF');
const activeTab = ref('inbound');

const wmsOrders = ref([]);
const warehouseLogs = ref([]);
const searchOrderId = ref('');
const hasSearched = ref(false);

const locationInputs = ref({});
const conditionInputs = ref({});
const fileInputs = ref({});
const fileInputRefs = ref({}); // holds the hidden <input type="file"> DOM elements, keyed by order id

let wmsInterval = null;

const formatOrderId = (id) => {
   if (!id) return '';
   return `PKG-${60000 + Number(id)}`;
};

const getImageUrl = (path) => {
   if (!path) return 'https://placehold.co/60x45?text=No+Image';
   return `http://localhost:3000${path}`;
};

const fetchWmsOrders = async () => {
   try {
      const res = await axios.get('http://localhost:3000/api/orders/wms');
      wmsOrders.value = res.data;
   } catch (err) {
      console.error("Error syncing WMS data:", err);
   }
};

// Hỗ trợ nhập cả dạng "PKG-60015" lẫn ID số thô "15"
const parseOrderIdInput = (val) => {
   if (!val) return null;
   const trimmed = val.trim();

   const match = trimmed.match(/PKG-(\d+)/i);
   if (match) {
      const rawId = Number(match[1]) - 60000;
      return rawId > 0 ? rawId : null;
   }

   if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
   }

   return null;
};

const searchOrderLogs = async () => {
   const orderId = parseOrderIdInput(searchOrderId.value);

   if (!orderId) {
      alert("⚠️ Please enter a valid Order Code format! (e.g.: PKG-60015 or ID number 15)");
      return;
   }

   hasSearched.value = true;

   try {
      const res = await axios.get(`http://localhost:3000/api/orders/wms/logs/${orderId}`);
      warehouseLogs.value = res.data;
   } catch (err) {
      console.error("Error searching warehouse log by order code:", err);
      warehouseLogs.value = [];
   }
};

const switchToHistoryTab = () => {
   activeTab.value = 'warehouse_history';
   warehouseLogs.value = [];
   hasSearched.value = false;
   searchOrderId.value = '';
};

// ĐÃ SỬA CHUẨN: Đổi từ đuôi /scan thành /scan-barcode để gọi đúng API Node.js
const scanOrder = async (id) => {
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/scan-barcode`);
      alert("⚡ Package barcode scan confirmed successfully!");
      fetchWmsOrders();
   } catch (err) {
      console.error(err);
      alert("System error while scanning the package barcode!");
   }
};

const updateLocation = async (id) => {
   const loc = locationInputs.value[id];
   if (!loc || loc.trim() === '') {
      alert("⚠️ Please select a Bin / Shelf location before saving!");
      return;
   }
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/location`, { warehouse_location: loc });
      alert("🎯 Package location assigned successfully!");
      fetchWmsOrders();
   } catch (err) {
      alert("Error updating the warehouse location!");
   }
};

const onFileChange = (event, id) => {
   if (event.target.files && event.target.files[0]) {
      fileInputs.value[id] = event.target.files[0];
   }
};

const submitConditionReport = async (id) => {
   const txt = conditionInputs.value[id] || 'Normal';
   const file = fileInputs.value[id];

   const formData = new FormData();
   formData.append('cargo_condition', txt);
   if (file) {
      formData.append('cargo_image', file);
   }

   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/condition`, formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert("⚠️ Condition inspection report submitted successfully!");
      conditionInputs.value[id] = '';
      delete fileInputs.value[id];
      fetchWmsOrders();
   } catch (err) {
      alert("Error submitting the damage inspection report!");
   }
};

const releaseToTms = async (id) => {
   try {
      await axios.put(`http://localhost:3000/api/orders/wms/${id}/release`);
      alert("📤 Outbound order approved, handover record sent to the TMS Fleet department!");
      fetchWmsOrders();
   } catch (err) {
      alert("Outbound operation failed!");
   }
};

const formatDate = (dateStr) => {
   if (!dateStr) return '';
   const d = new Date(dateStr);
   return d.toLocaleString('en-US');
};

const logout = () => {
   localStorage.clear();
   router.push('/');
};

onMounted(() => {
   if (localStorage.getItem('role') !== 'WMS') {
      router.push('/');
   } else {
      fetchWmsOrders();
      wmsInterval = setInterval(() => {
         fetchWmsOrders();
         if (activeTab.value === 'warehouse_history' && hasSearched.value) {
            searchOrderLogs();
         }
      }, 5000);
   }
});

onUnmounted(() => {
   if (wmsInterval) clearInterval(wmsInterval);
});
</script>

<style scoped>
.dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f4f6f9; }
.sidebar { width: 260px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; flex-shrink: 0; }
.brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 25px; color: #ecf0f1; letter-spacing: 0.5px; }
.user-info { display: flex; align-items: center; gap: 12px; padding-bottom: 15px; border-bottom: 1px solid #34495e; margin-bottom: 25px; }
.avatar { width: 45px; height: 45px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 16px; }
.navigation-menu { display: flex; flex-direction: column; gap: 10px; }
.menu-btn { padding: 12px 15px; text-align: left; background: none; border: none; color: #bdc3c7; font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 13px; transition: 0.2s; }
.menu-btn:hover, .menu-btn.active { background: #1a252f; color: white; border-left: 4px solid #e67e22; padding-left: 11px; }
.btn-logout { margin-top: auto; padding: 12px; background: #e74c3c; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }

.main-content { flex: 1; padding: 30px; overflow-y: auto; }
header h1 { font-size: 22px; font-weight: 800; color: #2c3e50; margin-bottom: 25px; border-left: 5px solid #e67e22; padding-left: 12px; text-transform: uppercase; }
.card { background: white; padding: 25px; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
.data-table th { background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
.order-id-tag { background: #e2e8f0; color: #4a5568; padding: 3px 6px; border-radius: 4px; font-family: monospace; }
.table-img-preview { width: 75px; height: 55px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; background-color: #f8fafc; }
.dept-badge { font-size: 11px; font-weight: bold; padding: 3px 6px; border-radius: 4px; }
.dept-badge.wms { background: #fef3c7; color: #d97706; }
.status-badge { font-size: 12px; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
.status-badge.process { background: #e0f2fe; color: #0369a1; }

.location-tag { background: #ecfdf5; color: #065f46; font-weight: bold; padding: 4px 8px; border-radius: 4px; border: 1px solid #a7f3d0; font-size: 13px; }
.table-input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; width: 160px; }
.mini-file-input { font-size: 11px; color: #7f8c8d; max-width: 150px; }
.report-box-grid { display: flex; flex-direction: column; gap: 6px; max-width: 220px; }
.file-upload-row { display: flex; align-items: center; gap: 8px; }
.btn-choose-file { background: #ecf0f1; color: #34495e; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; cursor: pointer; white-space: nowrap; }
.btn-choose-file:hover { background: #dfe6e9; }
.file-name-txt { font-size: 11px; color: #7f8c8d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
.condition-text { margin: 0; font-size: 13px; color: #d35400; font-style: italic; font-weight: 500; }

.btn-action-cyan { background: #16a085; color: white; border: none; padding: 8px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; }
.btn-action-orange { background: #e67e22; color: white; border: none; padding: 8px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; }
.btn-action-green { background: #27ae60; color: white; border: none; padding: 10px 16px; font-weight: bold; font-size: 13px; border-radius: 4px; cursor: pointer; width: 100%; }

.btn-action-blue { background: #3498db; color: white; border: none; padding: 8px 14px; font-weight: bold; font-size: 12px; border-radius: 4px; cursor: pointer; width: 100%; text-align: center; }
.btn-action-blue:hover { background: #2980b9; }
.btn-disabled { background: #cbd5e1 !important; color: #94a3b8 !important; cursor: not-allowed !important; }

.search-box { display: flex; align-items: center; gap: 10px; }
.log-notes-txt { color: #2c3e50; font-weight: 500; font-size: 13px; display: block; max-width: 400px; line-height: 1.4; }
.status-badge-old { background: #f1f5f9; color: #64748b; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace; }
.status-badge-new { background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-family: monospace; font-weight: bold; }
</style>