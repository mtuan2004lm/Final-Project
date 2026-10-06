<template>
   <div class="dashboard-container">
     <div class="sidebar">
       <div class="brand">LOGISTICS PRO</div>
       <div class="user-info">
         <div class="avatar">{{ userRole.charAt(0) }}</div>
         <div>
            <h3>VEHICLE DEPARTMENT ({{ userRole }})</h3>
            <small style="color: #2ecc71;">Dispatch Online</small>
         </div>
       </div>

       <div class="navigation-menu">
          <button @click="activeTab = 'planning'" :class="{ active: activeTab === 'planning' }" class="menu-btn">
             🗺️ Dispatch & Consolidate Orders
          </button>
          <button @click="activeTab = 'fleet'" :class="{ active: activeTab === 'fleet' }" class="menu-btn">
             🚚 Fleet Management
          </button>
       </div>

       <button @click="logout" class="btn-logout">Log Out</button>
     </div>

     <div class="main-content">

        <div v-if="activeTab === 'planning'">
           <header><h1>SMART ORDER CONSOLIDATION DISPATCH SYSTEM (PLANNING)</h1></header>

           <!-- ĐỢT 3: kế hoạch tự động - gom theo khu vực + gán xe vừa tải -->
           <div class="card list-card" style="border-top: 4px solid #8e44ad; margin-bottom: 25px;">
               <h3 style="color:#8e44ad;">🤖 Auto-plan: group all waiting orders and suggest a truck for each route</h3>
               <p style="font-size:13px; color:#7f8c8d; margin:4px 0 12px;">
                  The system groups waiting orders by the area selected below, splits a group when it exceeds the biggest truck's capacity,
                  and suggests the smallest available truck that fits (expired registry / insurance / maintenance trucks are skipped).
                  Review and change anything, then apply.
               </p>
               <div class="filter-bar">
                  <select v-model="groupMode" class="form-select-custom">
                     <option value="city">Group by city / province</option>
                     <option value="area">Group by area (district + city)</option>
                     <option value="address">Group by exact address</option>
                  </select>
                  <button @click="fetchAutoPlan" :disabled="autoPlanLoading" class="btn-action" style="background:#8e44ad; color:white;">
                     {{ autoPlanLoading ? 'Planning...' : '🤖 Generate plan' }}
                  </button>
                  <label v-if="autoPlan" style="font-size:13px;"><input type="checkbox" v-model="planOptimize" /> Optimize stop order for each route (a few seconds per new address)</label>
               </div>

               <div v-if="autoPlan">
                  <p v-if="autoPlan.plan.length === 0" style="color:#95a5a6; font-style:italic;">No orders are waiting for dispatch.</p>
                  <div v-for="(g, gi) in autoPlan.plan" :key="gi" class="group-card">
                     <div class="group-header" style="flex-wrap:wrap; gap:8px;">
                        <input v-model="g.route_name" class="form-input-custom" style="min-width:240px; font-weight:bold;" />
                        <span class="group-count">{{ g.order_ids.length }} stop(s) · {{ g.total_qty }} pcs</span>
                        <select v-model="g.truck_plate" class="form-select-custom">
                           <option value="">-- No truck --</option>
                           <option v-for="t in availableTrucks" :key="t.id" :value="t.license_plate">{{ t.type }} [{{ t.license_plate }}] · cap {{ t.capacity_pcs }}</option>
                        </select>
                        <span v-if="g.truck_plate && truckCapacity(g.truck_plate) < g.total_qty" style="color:#c0392b; font-size:12px; font-weight:bold;">
                           ⚠️ over capacity ({{ g.total_qty }} &gt; {{ truckCapacity(g.truck_plate) }})
                        </span>
                        <span v-if="g.status" style="font-size:12px; font-weight:bold;" :style="{ color: g.status.startsWith('✔') ? '#27ae60' : '#c0392b' }">{{ g.status }}</span>
                     </div>
                     <div style="padding: 8px 14px; font-size:12px; color:#7f8c8d;">
                        <span v-for="o in g.orders" :key="o.id" style="display:block;">
                           <b>PKG-{{ 60000 + Number(o.id) }}</b> · {{ o.customer_name }} · {{ o.quantity }} pcs · {{ o.delivery_address || 'No address' }}
                        </span>
                     </div>
                  </div>
                  <div v-if="autoPlan.plan.length" style="text-align:right; margin-top:12px;">
                     <button @click="applyAutoPlan" :disabled="applyingPlan" class="btn-action" style="background:#e67e22; color:white; padding:10px 22px; font-size:14px;">
                        {{ applyingPlan ? 'Dispatching...' : '🚀 Apply plan &amp; dispatch all routes' }}
                     </button>
                  </div>
               </div>
           </div>

           <div class="card list-card">
               <h3>🗺️ Consolidate Orders by Delivery Address into Routes</h3>
               <p style="font-size: 13px; color: #7f8c8d; margin: 4px 0 12px;">
                  Orders are grouped by delivery area. Tick the orders that go on the same trip, name the route, pick a truck, then dispatch them together.
               </p>

               <div class="filter-bar">
                  <input v-model="filterText" placeholder="🔍 Filter by address, customer, product..." class="form-input-custom" style="flex: 1; min-width: 220px;" />
                  <select v-model="groupMode" class="form-select-custom">
                     <option value="city">Group by city / province</option>
                     <option value="area">Group by area (district + city)</option>
                     <option value="address">Group by exact address</option>
                  </select>
                  <button @click="selectedIds = []" class="btn-action" style="background:#95a5a6; color:white;">Clear selection</button>
               </div>

               <div class="dispatch-panel" :class="{ ready: selectedIds.length > 0 }">
                  <b>{{ selectedIds.length }} order(s) selected</b>
                  <input v-model="routeName" placeholder="Route name (auto-suggested)" class="form-input-custom" style="flex: 1; min-width: 220px;" />
                  <select v-model="selectedTruck" class="form-select-custom" style="min-width: 190px;">
                     <option value="" disabled>-- Select truck --</option>
                     <option v-for="truck in availableTrucks" :key="truck.id" :value="truck.license_plate">
                        {{ truck.type }} [{{ truck.license_plate }}] · cap {{ truck.capacity_pcs }}
                     </option>
                  </select>
                  <button @click="suggestTruck" :disabled="selectedIds.length === 0" class="btn-action" style="background:#8e44ad; color:white;">💡 Suggest truck</button>
                  <button @click="optimizeSelected" :disabled="selectedIds.length < 2 || optimizing" class="btn-action" style="background:#16a085; color:white;">
                     {{ optimizing ? 'Optimizing...' : '🧭 Optimize stop order' }}
                  </button>
                  <button @click="dispatchRoute" :disabled="selectedIds.length === 0" class="btn-action" style="background: #e67e22; color: white;">
                     🚀 Create Route &amp; Dispatch
                  </button>
               </div>
               <small v-if="selectedIds.length" style="display:block; margin:2px 0 6px;" :style="{ color: overCapacity ? '#c0392b' : '#7f8c8d' }">
                  Load: <b>{{ selectedQty }}</b> pcs<span v-if="selectedTruck"> · truck capacity: <b>{{ truckCapacity(selectedTruck) }}</b><span v-if="overCapacity"> ⚠️ over capacity</span></span>
               </small>

               <!-- Kết quả tối ưu thứ tự điểm giao -->
               <div v-if="optimizeResult" class="optimize-box">
                  <b>🧭 Suggested stop order</b>
                  <span style="color:#16a085;"> · about {{ optimizeResult.total_km }} km (vs {{ optimizeResult.original_km }} km in the current order)</span>
                  <ol style="margin:8px 0 0; padding-left:22px; font-size:13px; line-height:1.7;">
                     <li v-for="st in optimizeResult.stops" :key="st.order_id">
                        <b>PKG-{{ 60000 + Number(st.order_id) }}</b> {{ st.customer_name }} - {{ st.address || 'No address' }}
                        <small v-if="st.leg_km !== null" style="color:#7f8c8d;"> (+{{ st.leg_km }} km<span v-if="st.approximate">, approximate location</span>)</small>
                        <small v-else style="color:#e67e22;"> (address not found on the map - placed last)</small>
                     </li>
                  </ol>
                  <small style="color:#95a5a6;">Straight-line estimates from the warehouse start point, not road distances. This order is used when you dispatch.</small>
               </div>
               <small v-if="availableTrucks.length === 0" style="color:#e74c3c;">No vehicles available - set a truck to "Available" in Fleet Management.</small>

               <div v-for="group in orderGroups" :key="group.key" class="group-card">
                  <div class="group-header">
                     <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" :checked="isGroupSelected(group)" @change="toggleGroup(group, $event.target.checked)" />
                        <b>📍 {{ group.key }}</b>
                     </label>
                     <span class="group-count">{{ group.orders.length }} order(s) · {{ group.totalQty }} pcs</span>
                  </div>
                  <table class="data-table" style="margin-top: 0;">
                     <thead>
                        <tr><th style="width:30px;"></th><th>Package Code</th><th>Customer</th><th>Cargo Details</th><th>Delivery Address</th><th>Receiver</th><th>Pickup</th></tr>
                     </thead>
                     <tbody>
                        <tr v-for="order in group.orders" :key="order.id">
                           <td><input type="checkbox" :value="order.id" v-model="selectedIds" /></td>
                           <td><b class="barcode-tag">PKG-{{ 60000 + Number(order.id) }}</b></td>
                           <td><b>{{ order.customer_name }}</b></td>
                           <td>{{ order.product_name }} (Qty: {{ order.quantity }})</td>
                           <td>
                              <span v-if="order.delivery_address">{{ order.delivery_address }}</span>
                              <span v-else style="color:#e74c3c; font-style:italic;">No address</span>
                           </td>
                           <td>
                              <small v-if="order.receiver_name">{{ order.receiver_name }}<br/>{{ order.receiver_phone }}</small>
                              <span v-else style="color:#95a5a6;">-</span>
                           </td>
                           <td>
                              <small v-if="order.pickup_date">🕒 {{ formatDateTime(order.pickup_date) }}<br/>{{ order.pickup_note }}</small>
                              <span v-else style="color:#95a5a6;">-</span>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
               <div v-if="orderGroups.length === 0" style="text-align:center; color:#95a5a6; padding: 25px; font-style: italic;">
                  No orders awaiting dispatch{{ filterText ? ' for this filter' : '' }}.
               </div>
           </div>

           <div class="card list-card" style="margin-top: 25px; border-top: 4px solid #27ae60;">
               <h3 style="color: #27ae60;">🛣️ Routes On The Road</h3>
               <table class="data-table">
                  <thead><tr><th>Route</th><th>Vehicle</th><th>Orders</th></tr></thead>
                  <tbody>
                     <tr v-for="r in activeRoutes" :key="r.route + r.truck">
                        <td><span class="location-badge" style="background:#e8f5e9; color:#2e7d32;">🛣️ {{ r.route || '(no name)' }}</span></td>
                        <td><span class="location-badge" style="background:#fff3cd; color:#856404;">🚛 {{ r.truck }}</span></td>
                        <td>
                           <small v-for="o in r.orders" :key="o.id" style="display:block;">
                              <b>PKG-{{ 60000 + Number(o.id) }}</b> - {{ o.customer_name }} - {{ o.delivery_address || 'No address' }}
                           </small>
                        </td>
                     </tr>
                     <tr v-if="activeRoutes.length === 0">
                        <td colspan="3" style="text-align:center; color:#95a5a6; padding:15px; font-style:italic;">No routes are currently on the road.</td>
                     </tr>
                  </tbody>
               </table>
           </div>

           <div class="card list-card" style="margin-top: 25px; border-top: 4px solid #2980b9;">
               <h3 style="color: #2980b9;">📱 DRIVER MOBILE APP SIMULATION INTERFACE (DRIVER MOBILE POD)</h3>
               <p style="font-size: 13px; color: #7f8c8d; margin-bottom: 15px;">
                  As the driver travels and incurs costs, upon arriving at the customer's warehouse they will press this button to update the GPS satellite location, submit the proof-of-delivery (POD) form, and push the order to the Accounting department for settlement.
                  Real-time vehicle location (periodically sent by the driver app) is shown in the "Fleet Management" tab.
               </p>

               <table class="data-table">
                   <thead>
                       <tr>
                          <th>Order/Vehicle</th><th>Current Journey</th><th>Incurred Costs (USD)</th><th>Driver E-POD Submission</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="order in orders.filter(o => o.status === 'SHIPPING')" :key="order.id">
                           <td><b class="barcode-tag">PKG-{{ 60000 + Number(order.id) }}</b><br/><small>{{ order.assigned_truck }}</small></td>
                           <td><span style="color: #2e7d32; font-weight: bold;">🚚 En Route:</span><br/><small>{{ order.delivery_route }}</small></td>
                           <td>
                              <div style="display: flex; flex-direction: column; gap: 4px;">
                                 <input type="number" step="0.01" :id="'bot-' + order.id" placeholder="BOT Toll Fee (USD)" class="form-input-custom-small" />
                                 <input type="number" step="0.01" :id="'fuel-' + order.id" placeholder="Fuel Cost (USD)" class="form-input-custom-small" />
                              </div>
                           </td>
                           <td>
                              <div style="display: flex; gap: 6px;">
                                 <input type="text" :id="'notes-' + order.id" placeholder="Driver notes..." class="form-input-custom-small" style="flex:1;" />
                                 <button @click="submitDriverPod(order.id)" class="btn-action" style="background: #2ecc71; color: white;">
                                    📸 Sign & Send to Accounting
                                 </button>
                              </div>
                           </td>
                       </tr>
                       <tr v-if="orders.filter(o => o.status === 'SHIPPING').length === 0">
                           <td colspan="4" style="text-align: center; color: #95a5a6; padding: 20px; font-style: italic;">There are currently no trucks on the road (SHIPPING). Click the "Dispatch" button in the table above to dispatch a vehicle.</td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>

        <div v-if="activeTab === 'fleet'">
           <header><h1>TRANSPORT FLEET MANAGEMENT & PERIODIC MAINTENANCE LOG</h1></header>

           <!-- ĐỢT 3: cảnh báo giấy tờ / bảo dưỡng sắp hoặc đã quá hạn -->
           <div v-if="alerts.length" class="alert-box">
               <b>⚠️ Attention ({{ alerts.length }})</b>
               <div v-for="(a, i) in alerts" :key="i" class="alert-row" :class="a.severity">
                  {{ a.type === 'truck' ? '🚚' : '🧑‍✈️' }} <b>{{ a.ref }}</b> - {{ a.kind }}:
                  <span v-if="a.days_left < 0">expired {{ -a.days_left }} day(s) ago ({{ formatDate(a.date) }})</span>
                  <span v-else-if="a.days_left === 0">expires today</span>
                  <span v-else>expires in {{ a.days_left }} day(s) ({{ formatDate(a.date) }})</span>
               </div>
           </div>

           <!-- FORM THÊM XE MỚI -->
           <div class="card list-card">
               <h3>➕ Add a New Vehicle to the Fleet</h3>
               <div class="fleet-form-grid">
                   <input v-model="newTruck.license_plate" placeholder="License plate (e.g.: 29C-123.45)" class="form-input-custom" />
                   <input v-model="newTruck.type" placeholder="Load type/category" class="form-input-custom" />
                   <input v-model="newTruck.driver_name" placeholder="Assigned driver" class="form-input-custom" />
                   <input v-model="newTruck.fuel_norm" placeholder="Fuel norm (e.g.: 12L/100km)" class="form-input-custom" />
                   <input v-model="newTruck.maintenance_date" type="date" class="form-input-custom" />
                   <input v-model="newTruck.registry_expiry" type="date" class="form-input-custom" title="Registry / inspection expiry" />
                   <input v-model.number="newTruck.capacity_pcs" type="number" min="1" placeholder="Capacity (packages)" class="form-input-custom" />
                   <input v-model="newTruck.insurance_expiry" type="date" class="form-input-custom" title="Insurance expiry" />
                   <button @click="createTruck" class="btn-action" style="background: #2980b9; color: white;">➕ Add Vehicle</button>
               </div>
           </div>

           <div class="card list-card" style="margin-top: 25px;">
               <h3>🚚 Internal Truck Fleet (Real-Time Data from Garage)</h3>
               <table class="data-table">
                   <thead>
                       <tr>
                          <th>License Plate</th><th>Load Type</th><th>Fuel Norm</th><th>Assigned Driver</th>
                          <th>Capacity / Odometer</th><th>Maintenance / Inspection / Insurance</th><th>Real-Time GPS Location</th><th>Technical Condition</th><th>Action</th>
                       </tr>
                   </thead>
                   <tbody>
                       <tr v-for="truck in fleet" :key="truck.id">
                           <td><b style="color: #2c3e50; font-family: monospace; font-size: 15px;">{{ truck.license_plate }}</b></td>

                           <td>
                              <input v-if="editingId === truck.id" v-model="editDraft.type" class="form-input-custom-small" />
                              <span v-else>{{ truck.type }}</span>
                           </td>
                           <td>
                              <input v-if="editingId === truck.id" v-model="editDraft.fuel_norm" class="form-input-custom-small" />
                              <span v-else>{{ truck.fuel_norm }}</span>
                           </td>
                           <td>
                              <input v-if="editingId === truck.id" v-model="editDraft.driver_name" class="form-input-custom-small" />
                              <b v-else>{{ truck.driver_name }}</b>
                           </td>
                           <td>
                              <div v-if="editingId === truck.id" style="display:flex; flex-direction:column; gap:4px;">
                                 <input type="number" min="1" v-model.number="editDraft.capacity_pcs" placeholder="Capacity" class="form-input-custom-small" />
                                 <input type="number" min="0" v-model.number="editDraft.odometer_km" placeholder="Odometer (km)" class="form-input-custom-small" />
                              </div>
                              <small v-else style="line-height:1.6;">📦 {{ truck.capacity_pcs ?? '-' }} pcs<br/>🛣️ {{ truck.odometer_km ?? 0 }} km</small>
                           </td>
                           <td>
                              <div v-if="editingId === truck.id" style="display:flex; flex-direction:column; gap:4px;">
                                 <input type="date" v-model="editDraft.maintenance_date" class="form-input-custom-small" />
                                 <input type="date" v-model="editDraft.registry_expiry" class="form-input-custom-small" />
                                 <input type="date" v-model="editDraft.insurance_expiry" class="form-input-custom-small" title="Insurance expiry" />
                              </div>
                              <small v-else style="line-height: 1.6;">
                                 <span :class="expiryClass(truck.maintenance_date)">Maintenance: {{ formatDate(truck.maintenance_date) }}</span><br/>
                                 <span :class="expiryClass(truck.registry_expiry)">Inspection: {{ formatDate(truck.registry_expiry) }}</span><br/>
                                 <span :class="expiryClass(truck.insurance_expiry)">Insurance: {{ formatDate(truck.insurance_expiry) }}</span>
                              </small>
                           </td>
                           <td>
                              <small v-if="truck.current_lat && truck.current_lng" style="line-height: 1.6;">
                                 📍 {{ Number(truck.current_lat).toFixed(5) }}, {{ Number(truck.current_lng).toFixed(5) }}<br/>
                                 <span style="color:#95a5a6;">Updated: {{ formatDateTime(truck.gps_updated_at) }}</span>
                              </small>
                              <span v-else style="color:#95a5a6; font-style: italic;">No GPS signal yet</span>
                           </td>
                           <td>
                              <select class="form-select-custom" :value="truck.status" @change="updateTruckStatus(truck.id, $event.target.value)">
                                 <option value="Sẵn sàng">Available</option>
                                 <option value="Đang đi giao hàng">Delivering</option>
                                 <option value="Bảo trì">Under Maintenance</option>
                                 <option value="⚠️ Quá hạn bảo trì">⚠️ Maintenance Overdue</option>
                                 <option value="Hỏng - Ngừng khai thác">Broken - Decommissioned</option>
                              </select>
                           </td>
                           <td>
                              <div style="display:flex; gap:6px;">
                                 <template v-if="editingId === truck.id">
                                    <button @click="saveEdit(truck.id)" class="btn-action" style="background:#2ecc71; color:white;">💾 Save</button>
                                    <button @click="cancelEdit" class="btn-action" style="background:#95a5a6; color:white;">✖ Cancel</button>
                                 </template>
                                 <template v-else>
                                    <button @click="openLogs(truck)" class="btn-action" style="background:#8e44ad; color:white;">📒 Logs</button>
                                    <button @click="startEdit(truck)" class="btn-action" style="background:#3498db; color:white;">✏️ Edit</button>
                                    <button @click="deleteTruck(truck.id)" class="btn-action" style="background:#e74c3c; color:white;">🗑️ Delete</button>
                                 </template>
                              </div>
                           </td>
                       </tr>
                       <tr v-if="fleet.length === 0">
                           <td colspan="9" style="text-align:center; color:#95a5a6; padding:20px; font-style:italic;">There are no vehicles in the fleet yet. Add a new vehicle above.</td>
                       </tr>
                   </tbody>
               </table>
           </div>

           <!-- ĐỢT 3: hồ sơ tài xế -->
           <div class="card list-card" style="margin-top: 25px;">
               <h3>🧑‍✈️ Drivers</h3>
               <div class="fleet-form-grid">
                   <input v-model="newDriver.full_name" placeholder="Full name" class="form-input-custom" />
                   <input v-model="newDriver.phone" placeholder="Phone" class="form-input-custom" />
                   <input v-model="newDriver.license_no" placeholder="License number" class="form-input-custom" />
                   <input v-model="newDriver.license_class" placeholder="License class (B2, C, FC...)" class="form-input-custom" />
                   <input v-model="newDriver.license_expiry" type="date" class="form-input-custom" title="License expiry" />
                   <select v-model="newDriver.truck_license_plate" class="form-select-custom">
                      <option value="">-- Assigned truck --</option>
                      <option v-for="t in fleet" :key="t.id" :value="t.license_plate">{{ t.license_plate }}</option>
                   </select>
                   <button @click="createDriver" class="btn-action" style="background: #2980b9; color: white;">➕ Add Driver</button>
               </div>
               <table class="data-table">
                   <thead><tr><th>Name</th><th>Phone</th><th>License</th><th>Expiry</th><th>Truck</th><th>Status</th><th>Action</th></tr></thead>
                   <tbody>
                       <tr v-for="d in drivers" :key="d.id">
                           <td><b>{{ d.full_name }}</b></td>
                           <td>{{ d.phone }}</td>
                           <td>{{ d.license_no }} <small v-if="d.license_class">({{ d.license_class }})</small></td>
                           <td><span :class="expiryClass(d.license_expiry)">{{ formatDate(d.license_expiry) }}</span></td>
                           <td>
                              <select class="form-select-custom" :value="d.truck_license_plate || ''" @change="updateDriver(d, { truck_license_plate: $event.target.value || null })">
                                 <option value="">-</option>
                                 <option v-for="t in fleet" :key="t.id" :value="t.license_plate">{{ t.license_plate }}</option>
                              </select>
                           </td>
                           <td>
                              <button @click="updateDriver(d, { status: d.status === 'Active' ? 'Off' : 'Active' })" class="btn-action"
                                      :style="{ background: d.status === 'Active' ? '#27ae60' : '#95a5a6', color: 'white' }">{{ d.status }}</button>
                           </td>
                           <td><button @click="deleteDriver(d.id)" class="btn-action" style="background:#e74c3c; color:white;">🗑️ Delete</button></td>
                       </tr>
                       <tr v-if="drivers.length === 0">
                           <td colspan="7" style="text-align:center; color:#95a5a6; padding:20px; font-style:italic;">No drivers yet. Add one above.</td>
                       </tr>
                   </tbody>
               </table>
           </div>
        </div>

     </div>

     <!-- ĐỢT 3: nhật ký bảo dưỡng + nhiên liệu của 1 xe -->
     <div v-if="logTruck" class="logs-overlay" @click.self="logTruck = null">
        <div class="logs-box">
           <div class="logs-head">
              <b>📒 {{ logTruck.license_plate }} - {{ logTruck.type }}</b>
              <button @click="logTruck = null" style="background:none; border:none; color:white; font-size:22px; cursor:pointer;">×</button>
           </div>
           <div class="logs-body">
              <div v-if="truckSummary" class="summary-row">
                 <div><small>Fuel cost</small><b>${{ truckSummary.fuel_cost.toFixed(2) }}</b></div>
                 <div><small>Fuel (L)</small><b>{{ truckSummary.fuel_liters.toFixed(1) }}</b></div>
                 <div><small>Avg consumption</small><b>{{ truckSummary.liters_per_100km === null ? '-' : truckSummary.liters_per_100km + ' L/100km' }}</b></div>
                 <div><small>Maintenance cost</small><b>${{ truckSummary.maintenance_cost.toFixed(2) }}</b></div>
                 <div><small>Total cost</small><b>${{ truckSummary.total_cost.toFixed(2) }}</b></div>
              </div>

              <div class="logs-tabs">
                 <button :class="{ on: logTab === 'maintenance' }" @click="logTab = 'maintenance'">🔧 Maintenance / Repair</button>
                 <button :class="{ on: logTab === 'fuel' }" @click="logTab = 'fuel'">⛽ Fuel</button>
              </div>

              <div v-if="logTab === 'maintenance'">
                 <div class="fleet-form-grid">
                    <select v-model="maintForm.kind" class="form-select-custom">
                       <option value="Maintenance">Maintenance</option><option value="Repair">Repair</option><option value="Inspection">Inspection</option>
                    </select>
                    <input v-model="maintForm.log_date" type="date" class="form-input-custom" title="Date" />
                    <input v-model.number="maintForm.cost" type="number" min="0" step="0.01" placeholder="Cost (USD)" class="form-input-custom" />
                    <input v-model.number="maintForm.odometer_km" type="number" min="0" placeholder="Odometer (km)" class="form-input-custom" />
                    <input v-model="maintForm.next_due" type="date" class="form-input-custom" title="Next due date (updates the truck schedule for Maintenance / Inspection)" />
                    <input v-model="maintForm.note" placeholder="Note" class="form-input-custom" />
                    <button @click="addMaintenance" class="btn-action" style="background:#27ae60; color:white;">➕ Add</button>
                 </div>
                 <small style="color:#95a5a6;">"Next due" updates the truck's maintenance date (Maintenance) or inspection expiry (Inspection).</small>
                 <table class="data-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Cost</th><th>Odometer</th><th>Note</th><th></th></tr></thead>
                    <tbody>
                       <tr v-for="m in maintLogs" :key="m.id">
                          <td>{{ formatDate(m.log_date) }}</td><td>{{ m.kind }}</td><td>${{ Number(m.cost).toFixed(2) }}</td><td>{{ m.odometer_km ?? '-' }}</td><td>{{ m.note }}</td>
                          <td><button @click="deleteMaintenance(m.id)" style="border:none; background:none; color:#e74c3c; cursor:pointer;">🗑️</button></td>
                       </tr>
                       <tr v-if="maintLogs.length === 0"><td colspan="6" style="text-align:center; color:#95a5a6; padding:14px;">No records.</td></tr>
                    </tbody>
                 </table>
              </div>

              <div v-else>
                 <div class="fleet-form-grid">
                    <input v-model="fuelForm.log_date" type="date" class="form-input-custom" title="Date" />
                    <input v-model.number="fuelForm.liters" type="number" min="0" step="0.01" placeholder="Liters" class="form-input-custom" />
                    <input v-model.number="fuelForm.cost" type="number" min="0" step="0.01" placeholder="Cost (USD)" class="form-input-custom" />
                    <input v-model.number="fuelForm.odometer_km" type="number" min="0" placeholder="Odometer (km)" class="form-input-custom" />
                    <input v-model="fuelForm.note" placeholder="Note" class="form-input-custom" />
                    <button @click="addFuel" class="btn-action" style="background:#27ae60; color:white;">➕ Add</button>
                 </div>
                 <small style="color:#95a5a6;">Enter the odometer at each fill-up to get the real L/100km consumption.</small>
                 <table class="data-table">
                    <thead><tr><th>Date</th><th>Liters</th><th>Cost</th><th>Odometer</th><th>Note</th><th></th></tr></thead>
                    <tbody>
                       <tr v-for="f in fuelLogs" :key="f.id">
                          <td>{{ formatDate(f.log_date) }}</td><td>{{ Number(f.liters).toFixed(1) }}</td><td>${{ Number(f.cost).toFixed(2) }}</td><td>{{ f.odometer_km ?? '-' }}</td><td>{{ f.note }}</td>
                          <td><button @click="deleteFuel(f.id)" style="border:none; background:none; color:#e74c3c; cursor:pointer;">🗑️</button></td>
                       </tr>
                       <tr v-if="fuelLogs.length === 0"><td colspan="6" style="text-align:center; color:#95a5a6; padding:14px;">No records.</td></tr>
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
     </div>
   </div>
 </template>

 <script setup>
 import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
 import axios from 'axios';
 import { useRouter } from 'vue-router';

 const router = useRouter();
 const userRole = ref('TMS');
 const activeTab = ref('planning');

 const EXT = 'http://localhost:3000/api/ext';
 const orders = ref([]);
 const fleet = ref([]);
 const alerts = ref([]);
 const drivers = ref([]);
 let tmsInterval = null;

 // Chỉ cho phép gán những xe đang "Sẵn sàng" vào chuyến mới
 const availableTrucks = computed(() => fleet.value.filter(t => t.status === 'Sẵn sàng'));
 const truckCapacity = (plate) => Number((fleet.value.find(t => t.license_plate === plate) || {}).capacity_pcs) || 0;

 const fetchTmsData = async () => {
   try {
     const resOrders = await axios.get('http://localhost:3000/api/ext/tms/orders');
     orders.value = resOrders.data;

     const resFleet = await axios.get(`${EXT}/fleet/trucks`);
     fleet.value = resFleet.data;
     alerts.value = (await axios.get(`${EXT}/fleet/alerts`)).data;
     drivers.value = (await axios.get(`${EXT}/fleet/drivers`)).data;
   } catch (error) {
      console.error("Error loading TMS dispatch department data:", error);
   }
 };

 // ================== LỌC THEO ĐỊA CHỈ + GOM TUYẾN ==================
 const filterText = ref('');
 const groupMode = ref('area');      // 'city' = theo thành phố, 'area' = theo quận + thành phố, 'address' = địa chỉ chính xác
 const selectedIds = ref([]);
 const routeName = ref('');
 const selectedTruck = ref('');

 // Lấy "khu vực" từ địa chỉ: 2 phần cuối sau dấu phẩy (ví dụ "12 Lê Văn Việt, Quận 9, TP.HCM" -> "Quận 9, TP.HCM")
 const areaOf = (address) => {
    const a = (address || '').trim();
    if (!a) return 'No address';
    const parts = a.split(',').map(x => x.trim()).filter(Boolean);
    return parts.length <= 2 ? parts.join(', ') : parts.slice(-2).join(', ');
 };
 const cityOf = (address) => {
    const parts = (address || '').split(',').map(x => x.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : 'No address';
 };
 const groupKeyOf = (o) => {
    if (groupMode.value === 'address') return o.delivery_address || 'No address';
    if (groupMode.value === 'city') return cityOf(o.delivery_address);
    return areaOf(o.delivery_address);
 };

 // Đơn chờ điều phối: chưa lên chuyến (APPROVED / PACKED)
 const pendingOrders = computed(() => orders.value.filter(o => ['APPROVED', 'PACKED'].includes((o.status || '').toUpperCase())));

 const orderGroups = computed(() => {
    const q = filterText.value.trim().toLowerCase();
    const map = {};
    pendingOrders.value.forEach(o => {
       const hay = `${o.delivery_address} ${o.customer_name} ${o.product_name} ${o.receiver_name || ''}`.toLowerCase();
       if (q && !hay.includes(q)) return;
       const key = groupKeyOf(o);
       (map[key] = map[key] || { key, orders: [], totalQty: 0 });
       map[key].orders.push(o);
       map[key].totalQty += Number(o.quantity) || 0;
    });
    return Object.values(map).sort((x, y) => y.orders.length - x.orders.length);
 });

 const isGroupSelected = (group) => group.orders.length > 0 && group.orders.every(o => selectedIds.value.includes(o.id));
 const toggleGroup = (group, checked) => {
    const ids = group.orders.map(o => o.id);
    selectedIds.value = checked
       ? Array.from(new Set([...selectedIds.value, ...ids]))
       : selectedIds.value.filter(id => !ids.includes(id));
 };

 // Tự gợi ý tên tuyến khi chọn đơn: cùng khu vực -> "<khu vực> - dd/mm", nhiều khu vực -> "Multi-area - dd/mm"
 const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
 watch(selectedIds, (ids) => {
    if (ids.length === 0) { routeName.value = ''; return; }
    const areas = new Set(pendingOrders.value.filter(o => ids.includes(o.id)).map(o => areaOf(o.delivery_address)));
    routeName.value = `${areas.size === 1 ? [...areas][0] : 'Multi-area'} - ${today()}`;
 });

 // Các tuyến đang chạy: gom đơn SHIPPING theo (tên tuyến + xe)
 const activeRoutes = computed(() => {
    const map = {};
    orders.value.filter(o => (o.status || '').toUpperCase() === 'SHIPPING').forEach(o => {
       const k = `${o.delivery_route}|${o.assigned_truck}`;
       (map[k] = map[k] || { route: o.delivery_route, truck: o.assigned_truck, orders: [] }).orders.push(o);
    });
    return Object.values(map);
 });

 // ---- ĐỢT 3: tải, gợi ý xe, tối ưu thứ tự, điều phối ----
 const selectedQty = computed(() => pendingOrders.value.filter(o => selectedIds.value.includes(o.id)).reduce((a, o) => a + (Number(o.quantity) || 0), 0));
 const overCapacity = computed(() => !!selectedTruck.value && truckCapacity(selectedTruck.value) < selectedQty.value);

 const optimizing = ref(false);
 const optimizeResult = ref(null);
 watch(selectedIds, () => { optimizeResult.value = null; });

 const suggestTruck = async () => {
    try {
       const r = await axios.get(`${EXT}/tms/suggest-truck`, { params: { total_qty: selectedQty.value } });
       const sg = r.data.suggested;
       if (!sg) return alert('No truck is available right now (all busy, or registry / insurance / maintenance expired).');
       selectedTruck.value = sg.license_plate;
       if (!sg.fits) alert(`No single truck can carry ${selectedQty.value} pcs. The largest available (${sg.license_plate}, ${sg.capacity_pcs} pcs) was selected - split the route.`);
    } catch (e) { alert(e.response?.data?.error || 'Error suggesting a truck!'); }
 };

 const optimizeSelected = async () => {
    optimizing.value = true;
    try {
       const r = await axios.post(`${EXT}/tms/optimize-route`, { order_ids: selectedIds.value });
       optimizeResult.value = r.data;
    } catch (e) { alert(e.response?.data?.error || 'Error optimizing the route!'); }
    finally { optimizing.value = false; }
 };

 const dispatchRoute = async () => {
    if (selectedIds.value.length === 0) return alert('Please select at least one order!');
    if (!routeName.value.trim()) return alert('Please enter a route name!');
    if (!selectedTruck.value) return alert('Please select a truck!');
    if (overCapacity.value) return alert(`The load (${selectedQty.value} pcs) exceeds this truck's capacity (${truckCapacity(selectedTruck.value)} pcs).`);

    const areas = new Set(pendingOrders.value.filter(o => selectedIds.value.includes(o.id)).map(o => areaOf(o.delivery_address)));
    if (areas.size > 1 && !confirm(`The selected orders belong to ${areas.size} different areas. Dispatch them on one route anyway?`)) return;

    // Dùng thứ tự đã tối ưu nếu có, ngược lại theo thứ tự chọn
    const ids = optimizeResult.value ? optimizeResult.value.ordered_ids : selectedIds.value;
    try {
       const res = await axios.post(`${EXT}/tms/consolidate-ordered`, {
          order_ids: ids,
          route_name: routeName.value,
          license_plate: selectedTruck.value
       });
       alert(`🚚 ${res.data.message}. The orders are now SHIPPING.`);
       selectedIds.value = [];
       selectedTruck.value = '';
       fetchTmsData();
    } catch (err) {
       alert(err.response?.data?.error || 'Error dispatching the route!');
    }
 };

 // ---- ĐỢT 3: kế hoạch tự động ----
 const autoPlan = ref(null);
 const autoPlanLoading = ref(false);
 const planOptimize = ref(true);
 const applyingPlan = ref(false);

 const fetchAutoPlan = async () => {
    autoPlanLoading.value = true;
    try {
       const r = await axios.get(`${EXT}/tms/auto-plan`, { params: { mode: groupMode.value } });
       r.data.plan.forEach(g => { g.truck_plate = g.truck ? g.truck.license_plate : ''; g.status = ''; });
       autoPlan.value = r.data;
    } catch (e) { alert(e.response?.data?.error || 'Error generating the plan!'); }
    finally { autoPlanLoading.value = false; }
 };

 const applyAutoPlan = async () => {
    const groups = autoPlan.value.plan;
    const missing = groups.filter(g => !g.truck_plate);
    if (missing.length && !confirm(`${missing.length} route(s) have no truck and will be skipped. Continue?`)) return;
    if (!confirm(`Dispatch ${groups.length - missing.length} route(s) now?`)) return;
    applyingPlan.value = true;
    for (const g of groups) {
       if (!g.truck_plate) { g.status = '— skipped (no truck)'; continue; }
       if (truckCapacity(g.truck_plate) < g.total_qty) { g.status = '✖ over capacity'; continue; }
       try {
          let ids = g.order_ids;
          if (planOptimize.value && ids.length > 1) {
             try { ids = (await axios.post(`${EXT}/tms/optimize-route`, { order_ids: ids })).data.ordered_ids; } catch (_) { /* giữ thứ tự gốc */ }
          }
          await axios.post(`${EXT}/tms/consolidate-ordered`, { order_ids: ids, route_name: g.route_name, license_plate: g.truck_plate });
          g.status = '✔ dispatched';
       } catch (e) { g.status = '✖ ' + (e.response?.data?.error || 'failed'); }
    }
    applyingPlan.value = false;
    fetchTmsData();
 };

 // TÀI XẾ NỘP BIÊN BẢN GIAO HÀNG ĐIỆN TỬ E-POD
 const submitDriverPod = async (orderId) => {
    const botFee = document.getElementById(`bot-${orderId}`).value || 0;
    const fuelFee = document.getElementById(`fuel-${orderId}`).value || 0;
    const driverNotes = document.getElementById(`notes-${orderId}`).value || '';

    try {
        await axios.put(`http://localhost:3000/api/orders/tms/${orderId}/pod-submit`, {
            bot_fee: botFee,
            fuel_fee: fuelFee,
            driver_notes: driverNotes,
            pod_image: 'https://cdn-storage.logistics.pro/pod_600' + orderId + '.jpg',
            gps_coordinates: '10.762622, 106.660172 (Customer warehouse)'
        });

        // Đồng thời ghi nhận vào sổ cái lịch sử hành trình chung
        await axios.put(`http://localhost:3000/api/orders/${orderId}`, {
            status: 'DELIVERED',
            current_dept: 'ACC',
            from_dept: 'TMS',
            notes: `Driver successfully handed over the goods to the customer at the GPS satellite coordinates. Submitted road expenses (BOT: $${botFee}, Fuel: $${fuelFee}). The record has been forwarded to Accounting for revenue approval.`
        });

        alert("Driver completed the journey! The order has been delivered successfully and the data has been sent to Accounting.");
        fetchTmsData();
    } catch (err) {
        alert("Error submitting the delivery report!");
    }
 };

 // ================== QUẢN LÝ ĐỘI XE (FLEET) ==================
 const newTruck = ref({
    license_plate: '', type: '', driver_name: '', fuel_norm: '',
    maintenance_date: '', registry_expiry: '',
    capacity_pcs: 100, insurance_expiry: ''
 });

 const createTruck = async () => {
    if (!newTruck.value.license_plate || !newTruck.value.type) {
       alert("Please enter at least the license plate and vehicle type!");
       return;
    }
    try {
       await axios.post('http://localhost:3000/api/orders/tms/fleet', newTruck.value);
       // Cột mở rộng (tải trọng, bảo hiểm): tìm xe vừa tạo theo biển số
       const list = (await axios.get(`${EXT}/fleet/trucks`)).data;
       const created = list.find(t => t.license_plate === newTruck.value.license_plate);
       if (created) await axios.put(`${EXT}/fleet/trucks/${created.id}/extra`, {
          capacity_pcs: newTruck.value.capacity_pcs || null, insurance_expiry: newTruck.value.insurance_expiry || null });
       alert("New vehicle added to the fleet!");
       newTruck.value = { license_plate: '', type: '', driver_name: '', fuel_norm: '', maintenance_date: '', registry_expiry: '', capacity_pcs: 100, insurance_expiry: '' };
       fetchTmsData();
    } catch (err) {
       alert(err.response?.data?.error || "Error adding new vehicle!");
    }
 };

 const editingId = ref(null);
 const editDraft = ref({});

 const startEdit = (truck) => {
    editingId.value = truck.id;
    editDraft.value = {
       type: truck.type,
       driver_name: truck.driver_name,
       fuel_norm: truck.fuel_norm,
       maintenance_date: truck.maintenance_date ? truck.maintenance_date.substring(0, 10) : '',
       registry_expiry: truck.registry_expiry ? truck.registry_expiry.substring(0, 10) : '',
       insurance_expiry: truck.insurance_expiry ? truck.insurance_expiry.substring(0, 10) : '',
       capacity_pcs: truck.capacity_pcs, odometer_km: truck.odometer_km
    };
 };

 const cancelEdit = () => { editingId.value = null; editDraft.value = {}; };

 const saveEdit = async (truckId) => {
    try {
       await axios.put(`http://localhost:3000/api/orders/tms/fleet/${truckId}`, editDraft.value);
       await axios.put(`${EXT}/fleet/trucks/${truckId}/extra`, {
          capacity_pcs: editDraft.value.capacity_pcs, insurance_expiry: editDraft.value.insurance_expiry, odometer_km: editDraft.value.odometer_km });
       alert("Vehicle information updated!");
       cancelEdit();
       fetchTmsData();
    } catch (err) {
       alert("Error updating vehicle!");
    }
 };

 const updateTruckStatus = async (truckId, status) => {
    try {
       await axios.put(`http://localhost:3000/api/orders/tms/fleet/${truckId}/status`, { status });
       fetchTmsData();
    } catch (err) {
       alert("Error updating vehicle status!");
    }
 };

 const deleteTruck = async (truckId) => {
    if (!confirm("Confirm deleting this vehicle from the fleet?")) return;
    try {
       await axios.delete(`http://localhost:3000/api/orders/tms/fleet/${truckId}`);
       fetchTmsData();
    } catch (err) {
       alert("Error deleting vehicle!");
    }
 };

 const formatDate = (d) => {
    if (!d) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date(d).toLocaleDateString('vi-VN');
 };
 const expiryClass = (d) => {
    const m = d && /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (!m) return '';
    const t = new Date(); const today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const days = Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - today0) / 86400000);
    return days < 0 ? 'exp-bad' : days <= 30 ? 'exp-soon' : '';
 };

 // ---- ĐỢT 3: tài xế ----
 const newDriver = ref({ full_name: '', phone: '', license_no: '', license_class: '', license_expiry: '', truck_license_plate: '' });
 const createDriver = async () => {
    if (!newDriver.value.full_name.trim()) return alert('Please enter the driver name!');
    try {
       await axios.post(`${EXT}/fleet/drivers`, newDriver.value);
       newDriver.value = { full_name: '', phone: '', license_no: '', license_class: '', license_expiry: '', truck_license_plate: '' };
       fetchTmsData();
    } catch (e) { alert(e.response?.data?.error || 'Error adding the driver!'); }
 };
 const updateDriver = async (d, patch) => {
    try { await axios.put(`${EXT}/fleet/drivers/${d.id}`, { ...d, ...patch }); fetchTmsData(); }
    catch (e) { alert(e.response?.data?.error || 'Error updating the driver!'); }
 };
 const deleteDriver = async (id) => {
    if (!confirm('Delete this driver?')) return;
    try { await axios.delete(`${EXT}/fleet/drivers/${id}`); fetchTmsData(); } catch (e) { alert('Error deleting the driver!'); }
 };

 // ---- ĐỢT 3: nhật ký bảo dưỡng / nhiên liệu ----
 const logTruck = ref(null);
 const logTab = ref('maintenance');
 const maintLogs = ref([]);
 const fuelLogs = ref([]);
 const truckSummary = ref(null);
 const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
 const blankMaint = () => ({ kind: 'Maintenance', log_date: todayIso(), cost: 0, odometer_km: null, next_due: '', note: '' });
 const blankFuel = () => ({ log_date: todayIso(), liters: null, cost: 0, odometer_km: null, note: '' });
 const maintForm = ref(blankMaint());
 const fuelForm = ref(blankFuel());

 const loadLogs = async () => {
    const id = logTruck.value.id;
    maintLogs.value = (await axios.get(`${EXT}/fleet/trucks/${id}/maintenance`)).data;
    fuelLogs.value = (await axios.get(`${EXT}/fleet/trucks/${id}/fuel`)).data;
    truckSummary.value = (await axios.get(`${EXT}/fleet/trucks/${id}/summary`)).data;
 };
 const openLogs = async (truck) => {
    logTruck.value = truck; logTab.value = 'maintenance';
    maintForm.value = blankMaint(); fuelForm.value = blankFuel();
    try { await loadLogs(); } catch (e) { alert('Error loading logs!'); }
 };
 const addMaintenance = async () => {
    try {
       await axios.post(`${EXT}/fleet/trucks/${logTruck.value.id}/maintenance`, { ...maintForm.value, next_due: maintForm.value.next_due || null });
       maintForm.value = blankMaint(); await loadLogs(); fetchTmsData();
    } catch (e) { alert(e.response?.data?.error || 'Error saving the record!'); }
 };
 const deleteMaintenance = async (id) => {
    if (!confirm('Delete this record?')) return;
    await axios.delete(`${EXT}/fleet/maintenance/${id}`); await loadLogs();
 };
 const addFuel = async () => {
    if (!fuelForm.value.liters) return alert('Please enter the liters!');
    try {
       await axios.post(`${EXT}/fleet/trucks/${logTruck.value.id}/fuel`, fuelForm.value);
       fuelForm.value = blankFuel(); await loadLogs(); fetchTmsData();
    } catch (e) { alert(e.response?.data?.error || 'Error saving the record!'); }
 };
 const deleteFuel = async (id) => {
    if (!confirm('Delete this record?')) return;
    await axios.delete(`${EXT}/fleet/fuel/${id}`); await loadLogs();
 };
 const formatDateTime = (d) => d ? new Date(d).toLocaleString('vi-VN') : '—';

 onMounted(() => {
   if (!localStorage.getItem('role')) {
     router.push('/');
   } else {
     fetchTmsData();
     tmsInterval = setInterval(fetchTmsData, 5000);
   }
 });

 onUnmounted(() => { if (tmsInterval) clearInterval(tmsInterval); });
 const logout = () => { localStorage.clear(); router.push('/'); };
 </script>

 <style scoped>
 .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
 .sidebar { width: 240px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; box-sizing: border-box;}
 .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; }
 .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid #34495e; margin-bottom: 20px; }
 .avatar { width: 40px; height: 40px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
 .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
 .main-content { flex: 1; padding: 30px; overflow-y: auto; background: #fff;}
 .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eef2f5;}
 .navigation-menu { display: flex; flex-direction: column; gap: 8px; margin-top: 10px;}
 .menu-btn { padding: 12px 15px; background: none; border: none; color: #b2bec3; text-align: left; font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; transition: all 0.2s;}
 .menu-btn:hover, .menu-btn.active { background: #34495e; color: #fff; }
 header h1 { font-size: 22px; font-weight: 800; color: #2c3e50; margin: 0 0 25px 0; }
 .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
 .data-table th, .data-table td { padding: 14px 16px; border-bottom: 1px solid #ecf0f1; text-align: left; font-size: 13px;}
 .data-table th { background: #f8f9fa; color: #7f8c8d; font-size: 12px; font-weight: bold; text-transform: uppercase;}
 .barcode-tag { font-family: monospace; background: #2d3436; color: #fff; padding: 3px 6px; border-radius: 3px; font-size: 13px; }
 .location-badge { font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 12px; display: inline-block;}
 .truck-status { padding: 4px 8px; border-radius: 20px; font-size: 12px; font-weight: bold; }
 .status-safe { background: #e8f5e9; color: #2e7d32; }
 .status-danger { background: #ffebee; color: #c62828; }
 .form-select-custom { padding: 8px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px; background: white;}
 .form-input-custom-small { width: 100%; padding: 6px 10px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 12.5px; box-sizing: border-box;}
 .form-input-custom { padding: 8px 10px; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 13px; box-sizing: border-box;}
 .btn-action { padding: 7px 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;}
 .fleet-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; align-items: center; margin-top: 10px;}
 .fleet-form-grid button { grid-column: span 1; height: 38px; }
 .filter-bar { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
 .dispatch-panel { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 12px 14px; background: #f8f9fa; border: 1px dashed #bdc3c7; border-radius: 6px; margin-bottom: 8px; }
 .dispatch-panel.ready { background: #fff8ee; border: 1px solid #e67e22; }
 .group-card { border: 1px solid #ecf0f1; border-radius: 6px; margin-top: 14px; overflow: hidden; }
 .group-header { display: flex; justify-content: space-between; align-items: center; background: #eaf2f8; padding: 10px 14px; font-size: 14px; }
 .group-count { font-size: 12px; color: #2980b9; font-weight: bold; }

 .optimize-box { background:#effaf7; border:1px solid #a3e4d7; border-radius:8px; padding:12px 14px; margin:10px 0; }
 .alert-box { background:#fff8e6; border:1px solid #f5cf87; border-left:4px solid #e67e22; border-radius:8px; padding:12px 16px; margin-bottom:20px; font-size:13px; }
 .alert-row { padding:3px 0; }
 .alert-row.expired { color:#c0392b; }
 .alert-row.soon { color:#b9770e; }
 .exp-bad { color:#c0392b; font-weight:bold; }
 .exp-soon { color:#b9770e; font-weight:bold; }
 .logs-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:1000; }
 .logs-box { background:white; width:min(900px,94vw); max-height:90vh; border-radius:10px; overflow:hidden; display:flex; flex-direction:column; }
 .logs-head { background:#2c3e50; color:white; padding:12px 18px; display:flex; justify-content:space-between; align-items:center; }
 .logs-body { padding:16px 18px; overflow:auto; }
 .summary-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
 .summary-row div { background:#f4f6f7; border-radius:8px; padding:8px 14px; display:flex; flex-direction:column; min-width:110px; }
 .summary-row small { color:#7f8c8d; }
 .logs-tabs { display:flex; gap:8px; margin-bottom:12px; }
 .logs-tabs button { border:1px solid #d5d8dc; background:white; padding:7px 14px; border-radius:6px; cursor:pointer; }
 .logs-tabs button.on { background:#8e44ad; color:white; border-color:#8e44ad; }
 </style>