<template>
  <div>
    <header><h1>🚨 Alerts Dashboard</h1></header>
    <p class="hint">Refreshes automatically every 30 seconds.</p>

    <div class="tiles">
      <div class="tile" :class="{ bad: data.stuck.length }"><b>{{ data.stuck.length }}</b><span>Stuck orders (&gt; {{ data.stuck_hours }}h)</span></div>
      <div class="tile" :class="{ bad: data.oldClaims.length }"><b>{{ data.oldClaims.length }}</b><span>Claims waiting &gt; 48h</span></div>
      <div class="tile" :class="{ bad: data.unpaidOverdue }"><b>{{ data.unpaidOverdue }}</b><span>Overdue unpaid orders</span></div>
      <div class="tile" :class="{ bad: fleet.length }"><b>{{ fleet.length }}</b><span>Fleet document alerts</span></div>
      <div class="tile" :class="{ bad: data.failedLogins.length }"><b>{{ data.failedLogins.length }}</b><span>Suspicious logins (24h)</span></div>
    </div>

    <h3>📦 Orders stuck too long</h3>
    <p v-if="!data.stuck.length" class="ok">✓ No stuck orders.</p>
    <table v-else class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Department</th><th>Waiting</th></tr></thead>
      <tbody><tr v-for="o in data.stuck" :key="o.id"><td>#{{ o.id }}</td><td>{{ o.customer_name }}</td><td>{{ o.status }}</td><td>{{ o.current_dept }}</td><td><b>{{ o.hours }} h</b></td></tr></tbody></table>

    <h3>🛡️ Claims waiting for a decision</h3>
    <p v-if="!data.oldClaims.length" class="ok">✓ Nothing waiting.</p>
    <table v-else class="tbl"><thead><tr><th>Claim</th><th>Order</th><th>Customer</th><th>Amount</th><th>Waiting</th></tr></thead>
      <tbody><tr v-for="c in data.oldClaims" :key="c.id"><td>#{{ c.id }}</td><td>#{{ c.order_id }}</td><td>{{ c.username }}</td><td>{{ c.claimed_amount.toFixed(2) }}</td><td><b>{{ c.hours }} h</b></td></tr></tbody></table>

    <h3>🚚 Vehicle & driver documents</h3>
    <p v-if="!fleet.length" class="ok">✓ All documents are valid for the next 30 days.</p>
    <table v-else class="tbl"><thead><tr><th>Item</th><th>Document</th><th>Date</th><th>Status</th></tr></thead>
      <tbody><tr v-for="(a, i) in fleet" :key="i" :class="a.severity"><td>{{ a.type === 'truck' ? '🚚' : '🧑‍✈️' }} {{ a.ref }}</td><td>{{ a.kind }}</td><td>{{ a.date }}</td>
        <td><b v-if="a.days_left < 0">expired {{ -a.days_left }} day(s) ago</b><span v-else>expires in {{ a.days_left }} day(s)</span></td></tr></tbody></table>

    <h3>🔐 Repeated failed logins</h3>
    <p v-if="!data.failedLogins.length" class="ok">✓ Nothing suspicious.</p>
    <table v-else class="tbl"><thead><tr><th>Account</th><th>Failed attempts</th><th>Last attempt</th></tr></thead>
      <tbody><tr v-for="f in data.failedLogins" :key="f.actor"><td>{{ f.actor }}</td><td><b>{{ f.attempts }}</b></td><td>{{ new Date(f.last_at).toLocaleString() }}</td></tr></tbody></table>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const EXT = 'http://localhost:3000/api/ext'
const data = ref({ stuck_hours: 24, stuck: [], oldClaims: [], failedLogins: [], unpaidOverdue: 0 })
const fleet = ref([])
let timer = null

const load = async () => {
  try {
    data.value = (await axios.get(`${EXT}/admin/alerts`)).data
    fleet.value = (await axios.get(`${EXT}/fleet/alerts`)).data
  } catch (e) { /* thử lại ở lần sau */ }
}
onMounted(() => { load(); timer = setInterval(load, 30000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.hint { color: #7f8c8d; margin: 4px 0 14px; }
.tiles { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.tile { background: white; border: 1px solid #e5e8ea; border-left: 4px solid #27ae60; border-radius: 8px; padding: 10px 16px; min-width: 150px; display: flex; flex-direction: column; }
.tile b { font-size: 26px; } .tile span { font-size: 12px; color: #7f8c8d; }
.tile.bad { border-left-color: #e74c3c; } .tile.bad b { color: #c0392b; }
h3 { margin: 22px 0 6px; }
.ok { color: #27ae60; margin: 4px 0; }
.tbl { width: 100%; border-collapse: collapse; background: white; }
.tbl th, .tbl td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eaeded; font-size: 14px; }
tr.expired td { color: #c0392b; } tr.soon td { color: #b9770e; }
</style>
