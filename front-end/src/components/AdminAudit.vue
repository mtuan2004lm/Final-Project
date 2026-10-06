<template>
  <div>
    <header><h1>🗂️ {{ $t('admin.audit_title') }}</h1></header>

    <div class="filters">
      <input v-model="actor" :placeholder="$t('admin.filter_actor')" @keyup.enter="load" />
      <input v-model="q" :placeholder="$t('admin.filter_text')" style="min-width: 260px;" @keyup.enter="load" />
      <label>{{ $t('admin.from') }} <input v-model="from" type="date" /></label>
      <label>{{ $t('admin.to') }} <input v-model="to" type="date" /></label>
      <button @click="load">🔍 {{ $t('common.search') }}</button>
    </div>

    <p v-if="rows.length === 0" class="empty">{{ $t('common.none') }}</p>
    <table v-else class="tbl">
      <thead><tr><th>{{ $t('admin.time') }}</th><th>{{ $t('admin.actor') }}</th><th>{{ $t('admin.action') }}</th><th>HTTP</th><th>{{ $t('admin.detail') }}</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id" :class="{ bad: r.action === 'LOGIN_FAILED' || r.action === 'OTP_FAILED' || r.status_code >= 400 }">
          <td class="nowrap">{{ fmt(r.created_at) }}</td>
          <td>{{ r.actor || '—' }}</td>
          <td><b>{{ r.action }}</b><small v-if="r.entity_id"> · #{{ r.entity_id }}</small></td>
          <td>{{ r.status_code || '' }}</td>
          <td class="detail">{{ r.detail }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'

const rows = ref([])
const actor = ref('')
const q = ref('')
const from = ref('')
const to = ref('')

const fmt = (d) => d ? new Date(d).toLocaleString() : ''
const load = async () => {
  try {
    rows.value = (await axios.get('http://localhost:3000/api/ext/admin/audit', {
      params: { actor: actor.value || undefined, q: q.value || undefined, from: from.value || undefined, to: to.value || undefined, limit: 200 }
    })).data
  } catch (e) { rows.value = [] }
}
onMounted(load)
</script>

<style scoped>
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 14px 0; }
input { padding: 7px; border: 1px solid #d5d8dc; border-radius: 6px; }
button { padding: 7px 14px; border: none; border-radius: 6px; background: #2c3e50; color: white; cursor: pointer; font-weight: 600; }
.empty { color: #95a5a6; font-style: italic; }
.tbl { width: 100%; border-collapse: collapse; background: white; }
.tbl th, .tbl td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eaeded; font-size: 13px; vertical-align: top; }
.tbl tr.bad td { background: #fdf2f0; }
.nowrap { white-space: nowrap; }
.detail { max-width: 420px; word-break: break-word; color: #566573; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
</style>
