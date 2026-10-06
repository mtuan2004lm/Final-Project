<template>
  <div class="claims">
    <header><h1>🛡️ {{ $t('claims.title') }}</h1></header>
    <p class="intro">{{ $t('claims.intro') }}</p>

    <h3>{{ $t('claims.my_orders') }}</h3>
    <p v-if="orders.length === 0" class="empty">{{ $t('common.none') }}</p>

    <div v-for="o in orders" :key="o.id" class="order-card">
      <div class="row">
        <div>
          <b>#{{ o.id }} · {{ o.product_name }}</b>
          <small> × {{ o.quantity }} · {{ o.status }}</small>
        </div>
        <span :class="['pill', o.insured ? 'ok' : 'no']">
          {{ o.insured ? `🛡️ ${$t('claims.insured')} · ${money(o.insured_value)} USD` : $t('claims.not_insured') }}
        </span>
      </div>

      <!-- Chưa mua bảo hiểm: khai báo giá trị -->
      <div v-if="canInsure(o)" class="form-row">
        <input v-model.number="declared[o.id]" type="number" min="1" step="1" :placeholder="$t('claims.declared')" />
        <small v-if="declared[o.id] > 0">{{ $t('claims.fee_quote', { fee: quote(declared[o.id]) }) }}</small>
        <button @click="buy(o)">{{ $t('claims.buy') }}</button>
      </div>

      <!-- Đã bảo hiểm: gửi yêu cầu bồi thường -->
      <div v-if="canClaim(o)">
        <button class="link" @click="openForm = openForm === o.id ? null : o.id">⚠️ {{ $t('claims.file') }}</button>
        <div v-if="openForm === o.id" class="claim-form">
          <select v-model="form.reason">
            <option v-for="r in reasons" :key="r" :value="r">{{ $t('claims.' + r) }}</option>
          </select>
          <textarea v-model="form.description" rows="3" :placeholder="$t('claims.describe')"></textarea>
          <input v-model.number="form.amount" type="number" min="1" :max="o.insured_value" :placeholder="`${$t('claims.amount')} ≤ ${money(o.insured_value)}`" />
          <button @click="sendClaim(o)">{{ $t('claims.send') }}</button>
        </div>
      </div>
    </div>

    <h3 style="margin-top: 28px;">{{ $t('claims.my_claims') }}</h3>
    <p v-if="claims.length === 0" class="empty">{{ $t('common.none') }}</p>
    <table v-else class="tbl">
      <thead><tr><th>#</th><th>{{ $t('common.order') }}</th><th>{{ $t('claims.problem') }}</th><th>{{ $t('common.amount') }}</th><th>{{ $t('claims.approved_amount') }}</th><th>{{ $t('common.status') }}</th></tr></thead>
      <tbody>
        <tr v-for="c in claims" :key="c.id">
          <td>{{ c.id }}</td>
          <td>#{{ c.order_id }}</td>
          <td>{{ $t('claims.' + c.reason) }}<br /><small>{{ c.description }}</small></td>
          <td>{{ money(c.claimed_amount) }}</td>
          <td>{{ c.approved_amount === null ? '-' : money(c.approved_amount) }}</td>
          <td>
            <span :class="['pill', c.status]">{{ $t('claims.' + c.status) }}</span>
            <div v-if="c.resolver_note" class="note">{{ c.resolver_note }}</div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { t } from '../i18n'

const EXT = 'http://localhost:3000/api/ext'
const props = defineProps({ username: { type: String, default: '' } })
const username = props.username || localStorage.getItem('username') || ''
const rawOrders = ref([])
const claims = ref([])
const declared = ref({})
const openForm = ref(null)
const form = ref({ reason: 'Damaged', description: '', amount: null })
const message = ref('')
const reasons = ['Damaged', 'Lost', 'Delayed', 'Other']
let timer = null

const money = (n) => Number(n || 0).toFixed(2)
const quote = (v) => Math.max(1, Math.round(v * 1.5) / 100).toFixed(2)
const orders = computed(() => rawOrders.value.filter(o => !['CANCELLED', 'RETURNED'].includes(String(o.status).toUpperCase())))
const openClaimOrderIds = computed(() => new Set(claims.value.filter(c => ['PENDING', 'APPROVED'].includes(c.status)).map(c => c.order_id)))

const canInsure = (o) => !o.insured && !['DELIVERED', 'DONE'].includes(String(o.status).toUpperCase())
const canClaim = (o) => o.insured && !['PENDING'].includes(String(o.status).toUpperCase()) && !openClaimOrderIds.value.has(o.id)

const load = async () => {
  try {
    rawOrders.value = (await axios.get(`http://localhost:3000/api/orders/customer?username=${encodeURIComponent(username)}`)).data
    claims.value = (await axios.get(`${EXT}/claims`, { params: { username } })).data
  } catch (e) { /* lỗi mạng tạm thời: thử lại ở lần polling sau */ }
}
const flash = (m) => { message.value = m; setTimeout(() => { if (message.value === m) message.value = '' }, 4000) }

const buy = async (o) => {
  if (!(Number(declared.value[o.id]) > 0)) { alert('Please enter the declared value of the goods (greater than 0).'); return }
  try {
    await axios.post(`${EXT}/orders/${o.id}/insurance`, { username, declared_value: declared.value[o.id] })
    flash(t('claims.bought')); await load()
  } catch (e) { const m = e.response?.data?.error || t('common.error'); flash(m); alert(m) }
}

const sendClaim = async (o) => {
  try {
    await axios.post(`${EXT}/claims`, { username, order_id: o.id, reason: form.value.reason, description: form.value.description, claimed_amount: form.value.amount })
    flash(t('claims.created'))
    openForm.value = null; form.value = { reason: 'Damaged', description: '', amount: null }
    await load()
  } catch (e) { const m = e.response?.data?.error || t('common.error'); flash(m); alert(m) }
}

onMounted(() => { load(); timer = setInterval(load, 8000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.claims { max-width: 900px; }
.intro { color: #566573; margin: 4px 0 18px; }
.empty { color: #95a5a6; font-style: italic; }
.order-card { background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.form-row, .claim-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 10px; }
.claim-form { flex-direction: column; align-items: stretch; background: #fdf6ec; border-radius: 8px; padding: 10px; }
input, select, textarea { padding: 8px; border: 1px solid #d5d8dc; border-radius: 6px; font-family: inherit; }
button { padding: 8px 14px; border: none; border-radius: 6px; background: #2980b9; color: white; cursor: pointer; font-weight: 600; }
button.link { background: none; color: #c0392b; padding: 6px 0; margin-top: 6px; text-decoration: underline; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: #ecf0f1; color: #566573; }
.pill.ok, .pill.PAID { background: #d5f5e3; color: #1e8449; }
.pill.no { background: #fdebd0; color: #b9770e; }
.pill.PENDING { background: #fcf3cf; color: #9a7d0a; }
.pill.APPROVED { background: #d6eaf8; color: #1f618d; }
.pill.REJECTED { background: #fadbd8; color: #922b21; }
.tbl { width: 100%; border-collapse: collapse; background: white; }
.tbl th, .tbl td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eaeded; font-size: 14px; vertical-align: top; }
.note { font-size: 12px; color: #7f8c8d; margin-top: 4px; }
.msg { margin-top: 14px; background: #eaf2f8; border-radius: 6px; padding: 8px 12px; }
</style>
