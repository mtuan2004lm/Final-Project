<template>
  <div>
    <header><h1>📈 Performance Report</h1></header>
    <div class="bar">
      <label>Period:
        <select v-model.number="days" @change="load">
          <option :value="7">Last 7 days</option><option :value="30">Last 30 days</option>
          <option :value="90">Last 90 days</option><option :value="365">Last 12 months</option>
        </select>
      </label>
    </div>

    <div class="tiles">
      <div class="tile"><b>{{ d.total_orders }}</b><span>Orders created</span></div>
      <div class="tile good"><b>{{ pct(d.delivered_rate) }}</b><span>Delivered of closed orders</span></div>
      <div class="tile warn"><b>{{ pct(d.cancelled_rate) }}</b><span>Cancelled</span></div>
      <div class="tile warn"><b>{{ pct(d.returned_rate) }}</b><span>Returned</span></div>
    </div>

    <h3>⏱️ Average time an order spends at each step</h3>
    <p v-if="!d.per_status.length" class="empty">Not enough history yet.</p>
    <div v-else class="steps">
      <div v-for="s in ordered" :key="s.status" class="step">
        <span class="name">{{ label(s.status) }}</span>
        <div class="track"><div class="fill" :style="{ width: Math.max(4, (s.avg_hours / maxHours) * 100) + '%' }"></div></div>
        <b>{{ s.avg_hours }} h</b><small>({{ s.samples }} orders)</small>
      </div>
    </div>

    <h3>🏆 Driver ranking</h3>
    <p v-if="!d.drivers.length" class="empty">No delivered orders in this period.</p>
    <table v-else class="tbl">
      <thead><tr><th>#</th><th>Driver</th><th>Vehicle</th><th>Delivered</th><th>Avg rating</th><th>Road costs (USD)</th></tr></thead>
      <tbody><tr v-for="(r, i) in d.drivers" :key="r.truck + i"><td>{{ i + 1 }}</td><td><b>{{ r.driver }}</b></td><td>{{ r.truck }}</td><td>{{ r.delivered }}</td>
        <td>{{ r.avg_rating === null ? '—' : '⭐ ' + r.avg_rating }}</td><td>{{ r.road_cost.toFixed(2) }}</td></tr></tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const days = ref(30)
const d = ref({ total_orders: 0, delivered_rate: null, cancelled_rate: null, returned_rate: null, per_status: [], drivers: [] })
const ORDER = ['NEW', 'APPROVED', 'PACKED', 'SHIPPING']
const NAMES = { NEW: 'Waiting for OMS approval', APPROVED: 'Warehouse processing', PACKED: 'Waiting for a truck', SHIPPING: 'On the road' }

const ordered = computed(() => [...d.value.per_status].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)))
const maxHours = computed(() => Math.max(1, ...d.value.per_status.map(s => s.avg_hours)))
const pct = (v) => v === null || v === undefined ? '—' : v + '%'
const label = (s) => NAMES[s] || s

const load = async () => {
  try { d.value = (await axios.get('http://localhost:3000/api/ext/admin/performance', { params: { days: days.value } })).data } catch (e) { /* giữ số liệu cũ */ }
}
onMounted(load)
</script>

<style scoped>
.bar { margin: 12px 0; } select { padding: 7px; border: 1px solid #d5d8dc; border-radius: 6px; }
.tiles { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
.tile { background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 10px 18px; min-width: 150px; display: flex; flex-direction: column; }
.tile b { font-size: 26px; } .tile span { font-size: 12px; color: #7f8c8d; }
.tile.good b { color: #1e8449; } .tile.warn b { color: #b9770e; }
h3 { margin: 22px 0 8px; } .empty { color: #95a5a6; font-style: italic; }
.step { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
.step .name { width: 220px; font-size: 14px; } .track { flex: 1; max-width: 420px; background: #eef2f4; height: 14px; border-radius: 7px; overflow: hidden; }
.fill { background: #3498db; height: 100%; } .step small { color: #95a5a6; }
.tbl { width: 100%; border-collapse: collapse; background: white; }
.tbl th, .tbl td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eaeded; font-size: 14px; }
</style>
