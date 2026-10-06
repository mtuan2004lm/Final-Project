<template>
  <div>
    <header><h1>🛡️ {{ $t('oms.claims_title') }}</h1></header>
    <p v-if="claims.length === 0" class="empty">{{ $t('common.none') }}</p>

    <div v-for="c in claims" :key="c.id" class="card" :class="{ pending: c.status === 'PENDING' }">
      <div class="top">
        <b>#{{ c.id }} · {{ $t('common.order') }} #{{ c.order_id }} · {{ c.product_name }}</b>
        <span :class="['pill', c.status]">{{ $t('claims.' + c.status) }}</span>
      </div>
      <div class="meta">
        {{ $t('oms.customer') }}: <b>{{ c.username }}</b> ·
        {{ $t('claims.problem') }}: <b>{{ $t('claims.' + c.reason) }}</b> ·
        {{ $t('common.amount') }}: <b>{{ money(c.claimed_amount) }}</b> / {{ $t('claims.value') }}: {{ money(c.insured_value) }} USD
      </div>
      <p class="desc">“{{ c.description }}”</p>

      <div v-if="c.status === 'PENDING'" class="actions">
        <input v-model.number="amounts[c.id]" type="number" min="1" :max="c.claimed_amount" :placeholder="`${$t('oms.approved_amount')} (${money(c.claimed_amount)})`" />
        <button class="ok" @click="decide(c, 'approve')">✔ {{ $t('oms.approve') }}</button>
        <input v-model="notes[c.id]" type="text" :placeholder="$t('oms.reject_reason')" />
        <button class="bad" @click="decide(c, 'reject')">✖ {{ $t('oms.reject') }}</button>
      </div>
      <div v-else class="meta">
        <span v-if="c.approved_amount !== null">{{ $t('claims.approved_amount') }}: <b>{{ money(c.approved_amount) }}</b></span>
        <span v-if="c.resolver_note"> · {{ c.resolver_note }}</span>
      </div>
    </div>

    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { t } from '../i18n'

const EXT = 'http://localhost:3000/api/ext'
const claims = ref([])
const amounts = ref({})
const notes = ref({})
const message = ref('')
let timer = null

const money = (n) => Number(n || 0).toFixed(2)
const load = async () => { try { claims.value = (await axios.get(`${EXT}/oms/claims`)).data } catch (e) { /* thử lại ở lần sau */ } }
const flash = (m) => { message.value = m; setTimeout(() => { if (message.value === m) message.value = '' }, 4000) }

const decide = async (c, decision) => {
  try {
    await axios.put(`${EXT}/oms/claims/${c.id}`, {
      decision, approved_amount: amounts.value[c.id] || undefined, note: notes.value[c.id] || '',
      resolved_by: localStorage.getItem('username') || 'OMS'
    })
    flash(t('oms.decision_done')); await load()
  } catch (e) { flash(e.response?.data?.error || t('common.error')) }
}

onMounted(() => { load(); timer = setInterval(load, 8000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.empty { color: #95a5a6; font-style: italic; }
.card { background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
.card.pending { border-left: 4px solid #f39c12; }
.top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.meta { font-size: 13px; color: #566573; margin-top: 6px; }
.desc { font-style: italic; margin: 8px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
input { padding: 7px; border: 1px solid #d5d8dc; border-radius: 6px; }
button { padding: 7px 14px; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600; }
button.ok { background: #27ae60; } button.bad { background: #e74c3c; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; background: #ecf0f1; color: #566573; }
.pill.PAID { background: #d5f5e3; color: #1e8449; } .pill.PENDING { background: #fcf3cf; color: #9a7d0a; }
.pill.APPROVED { background: #d6eaf8; color: #1f618d; } .pill.REJECTED { background: #fadbd8; color: #922b21; }
.msg { margin-top: 12px; background: #eaf2f8; border-radius: 6px; padding: 8px 12px; }
</style>
