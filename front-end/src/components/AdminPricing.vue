<template>
  <div>
    <header><h1>💲 Pricing & Settings</h1></header>
    <p class="hint">Changes apply to new orders straight away. Existing orders keep the price they were created with.</p>

    <div class="card">
      <h3>Freight price per package (USD)</h3>
      <div v-for="(price, type) in rates" :key="type" class="row">
        <label>{{ type }}</label>
        <input v-model.number="rates[type]" type="number" min="0.01" step="0.01" />
      </div>
    </div>

    <div class="card">
      <h3>Insurance, tax and payment terms</h3>
      <div class="row"><label>Insurance rate (% of declared value)</label><input v-model.number="insurancePct" type="number" min="0" max="50" step="0.1" /></div>
      <div class="row"><label>Minimum insurance fee (USD)</label><input v-model.number="minFee" type="number" min="0" step="0.5" /></div>
      <div class="row"><label>VAT on official invoices (%)</label><input v-model.number="vatPct" type="number" min="0" max="50" step="0.5" /></div>
      <div class="row"><label>Days before an unpaid invoice is overdue</label><input v-model.number="overdueDays" type="number" min="1" max="365" /></div>
    </div>

    <button class="primary" @click="save">💾 Save changes</button>
    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const EXT = 'http://localhost:3000/api/ext'
const rates = ref({})
const insurancePct = ref(1.5)
const minFee = ref(1)
const vatPct = ref(10)
const overdueDays = ref(7)
const message = ref('')

const load = async () => {
  try {
    const d = (await axios.get(`${EXT}/pricing`)).data
    rates.value = d.rates
    insurancePct.value = Math.round(d.insurance_rate * 1000) / 10
    minFee.value = d.insurance_min_fee
    vatPct.value = Math.round(d.vat_rate * 1000) / 10
    overdueDays.value = d.overdue_days
  } catch (e) { message.value = 'Unable to load pricing.' }
}

const save = async () => {
  try {
    await axios.put(`${EXT}/admin/pricing`, {
      actor: localStorage.getItem('username'), rates: rates.value,
      insurance_rate: insurancePct.value / 100, insurance_min_fee: minFee.value,
      vat_rate: vatPct.value / 100, overdue_days: overdueDays.value
    })
    message.value = '✓ Saved.'
  } catch (e) { message.value = e.response?.data?.error || 'Error saving.' }
  setTimeout(() => { message.value = '' }, 4500)
}
onMounted(load)
</script>

<style scoped>
.hint { color: #7f8c8d; margin: 4px 0 14px; }
.card { background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; max-width: 640px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 6px 0; border-bottom: 1px solid #f2f3f4; }
.row label { flex: 1; }
input { width: 120px; padding: 7px; border: 1px solid #d5d8dc; border-radius: 6px; text-align: right; }
button.primary { padding: 10px 22px; border: none; border-radius: 6px; background: #27ae60; color: white; font-weight: 700; cursor: pointer; }
.msg { margin-top: 12px; }
</style>
