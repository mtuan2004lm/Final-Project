<template>
  <div class="card">
    <h3>🛡️ {{ $t('acc.claims_title') }}</h3>
    <p v-if="claims.length === 0" class="empty">{{ $t('common.none') }}</p>
    <table v-else class="tbl">
      <thead><tr><th>#</th><th>{{ $t('common.order') }}</th><th>{{ $t('oms.customer') }}</th><th>{{ $t('claims.problem') }}</th><th>{{ $t('claims.approved_amount') }}</th><th>{{ $t('common.status') }}</th><th></th></tr></thead>
      <tbody>
        <tr v-for="c in claims" :key="c.id">
          <td>{{ c.id }}</td><td>#{{ c.order_id }}</td><td>{{ c.username }}</td>
          <td>{{ $t('claims.' + c.reason) }}</td>
          <td><b>{{ Number(c.approved_amount).toFixed(2) }}</b> USD</td>
          <td><span :class="['pill', c.status]">{{ $t('claims.' + c.status) }}</span></td>
          <td><button v-if="c.status === 'APPROVED'" @click="pay(c)">💸 {{ $t('acc.mark_paid') }}</button></td>
        </tr>
      </tbody>
    </table>
    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { t } from '../i18n'

const EXT = 'http://localhost:3000/api/ext'
const claims = ref([])
const message = ref('')
let timer = null

const load = async () => { try { claims.value = (await axios.get(`${EXT}/acc/claims`)).data } catch (e) { /* thử lại ở lần sau */ } }
const pay = async (c) => {
  if (!confirm(`${c.approved_amount} USD → ${c.username}?`)) return
  try {
    await axios.put(`${EXT}/acc/claims/${c.id}/pay`, { username: localStorage.getItem('username') || 'ACC' })
    message.value = t('acc.paid_done'); await load()
  } catch (e) { message.value = e.response?.data?.error || t('common.error') }
}

onMounted(() => { load(); timer = setInterval(load, 8000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.card { background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 14px 18px; margin-top: 28px; }
.empty { color: #95a5a6; font-style: italic; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eaeded; font-size: 14px; }
button { padding: 6px 12px; border: none; border-radius: 6px; background: #27ae60; color: white; cursor: pointer; font-weight: 600; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: #d6eaf8; color: #1f618d; }
.pill.PAID { background: #d5f5e3; color: #1e8449; }
.msg { margin-top: 10px; background: #eaf2f8; border-radius: 6px; padding: 8px 12px; }
</style>
