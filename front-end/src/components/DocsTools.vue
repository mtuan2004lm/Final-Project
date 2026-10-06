<template>
  <div class="tools">
    <h2>🔎 Advanced Search & Record Files</h2>

    <div class="filters">
      <input v-model="f.q" placeholder="Order code, customer, product, route, truck, shelf..." class="wide" @keyup.enter="search" />
      <label>From <input type="date" v-model="f.from" /></label>
      <label>To <input type="date" v-model="f.to" /></label>
      <select v-model="f.status"><option value="">Any status</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      <select v-model="f.dept"><option value="">Any department</option><option v-for="d in depts" :key="d" :value="d">{{ d }}</option></select>
      <select v-model="f.payment"><option value="">Any payment</option><option value="PAID">PAID</option><option value="UNPAID">UNPAID</option></select>
      <select v-model="f.sealed"><option value="">Sealed or open</option><option value="true">Sealed only</option><option value="false">Open only</option></select>
      <button class="primary" @click="search">🔍 Search</button>
      <button @click="reset">Clear</button>
    </div>

    <p class="count">{{ rows.length }} record(s){{ rows.length >= 200 ? ' (showing the first 200)' : '' }}</p>
    <table class="tbl">
      <thead><tr><th>Order</th><th>Customer</th><th>Item</th><th>Status</th><th>Dept</th><th>Payment</th><th class="r">Amount</th><th>Files</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td><b>#{{ r.id }}</b><br /><small>PKG-{{ 60000 + r.id }}</small></td>
          <td>{{ r.customer_name }}</td><td>{{ r.product_name }} × {{ r.quantity }}</td>
          <td>{{ r.status }}</td><td>{{ r.current_dept }}</td><td>{{ r.payment_status || 'UNPAID' }}</td>
          <td class="r">{{ Number(r.amount).toFixed(2) }}</td><td>📎 {{ r.files }}</td>
          <td class="btns">
            <button @click="openDetail(r)">📂 Files & history</button>
            <button @click="open('handover', r)">📄 Handover</button>
            <button @click="open('damage', r)">⚠️ Damage report</button>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="9" class="empty">No records match.</td></tr>
      </tbody>
    </table>

    <!-- Chi tiết 1 hồ sơ -->
    <div v-if="sel" class="overlay" @click.self="sel = null">
      <div class="box">
        <div class="head"><b>📂 Order #{{ sel.id }} - {{ sel.customer_name }}</b><button class="x" @click="sel = null">×</button></div>
        <div class="body">
          <p v-if="sealed" class="sealed">🔒 This record is sealed. Files cannot be added or removed. Only an Admin can reopen it.</p>

          <h3>Attached files</h3>
          <div v-if="!sealed" class="bar">
            <select v-model="docType"><option v-for="t in docTypes" :key="t" :value="t">{{ t }}</option></select>
            <input type="file" ref="fileInput" />
            <button class="primary" @click="upload">⬆️ Upload</button>
            <small>PDF, images, Word, Excel, CSV, TXT - up to 10 MB.</small>
          </div>
          <table class="tbl">
            <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
            <tbody>
              <tr v-for="x in files" :key="x.id">
                <td><a :href="HOST + x.url" target="_blank">{{ x.original_name }}</a></td><td>{{ x.doc_type }}</td>
                <td>{{ (x.size_bytes / 1024).toFixed(0) }} KB</td><td>{{ new Date(x.uploaded_at).toLocaleString() }}<br /><small>{{ x.uploaded_by }}</small></td>
                <td><button v-if="!sealed" class="danger" @click="remove(x)">🗑️</button></td>
              </tr>
              <tr v-if="!files.length"><td colspan="5" class="empty">No files attached.</td></tr>
            </tbody>
          </table>

          <h3>Seal history</h3>
          <ul class="hist">
            <li v-for="h in history" :key="h.id"><b>{{ h.action === 'SEALED' ? '🔒 Sealed' : '🔓 Reopened' }}</b> by {{ h.actor || 'unknown' }} · {{ new Date(h.created_at).toLocaleString() }}<span v-if="h.reason"> - {{ h.reason }}</span></li>
            <li v-if="!history.length" class="empty">No seal events recorded.</li>
          </ul>
        </div>
      </div>
    </div>
    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const HOST = 'http://localhost:3000'
const EXT = `${HOST}/api/ext`
const me = localStorage.getItem('username') || ''
const statuses = ['APPROVED', 'PACKED', 'SHIPPING', 'DELIVERED', 'DONE', 'RETURNED', 'CANCELLED']
const depts = ['OMS', 'WMS', 'TMS', 'ACC', 'DOCS', 'ARCHIVED']
const docTypes = ['Contract', 'Delivery note', 'Customs', 'Invoice', 'Damage report', 'Other']
const blank = () => ({ q: '', from: '', to: '', status: '', dept: '', payment: '', sealed: '' })
const f = ref(blank())
const rows = ref([])
const sel = ref(null)
const files = ref([])
const history = ref([])
const docType = ref('Contract')
const fileInput = ref(null)
const message = ref('')
const sealed = computed(() => !!sel.value && String(sel.value.current_dept).toUpperCase() === 'ARCHIVED')

const flash = (m) => { message.value = m; setTimeout(() => { if (message.value === m) message.value = '' }, 5000) }
const search = async () => {
  try { rows.value = (await axios.get(`${EXT}/docs/search`, { params: Object.fromEntries(Object.entries(f.value).filter(([, v]) => v)) })).data }
  catch (e) { flash('Search failed.') }
}
const reset = () => { f.value = blank(); search() }
const open = (kind, r) => window.open(`${EXT}/documents/${kind}/${r.id}`, '_blank')

const loadDetail = async () => {
  files.value = (await axios.get(`${EXT}/docs/orders/${sel.value.id}/files`)).data
  history.value = (await axios.get(`${EXT}/docs/orders/${sel.value.id}/archive-history`)).data
}
const openDetail = async (r) => { sel.value = r; try { await loadDetail() } catch (e) { flash('Unable to load the record.') } }
const upload = async () => {
  const file = fileInput.value && fileInput.value.files[0]
  if (!file) return flash('Choose a file first.')
  const fd = new FormData(); fd.append('file', file); fd.append('doc_type', docType.value); fd.append('uploaded_by', me)
  try { await axios.post(`${EXT}/docs/orders/${sel.value.id}/files`, fd); fileInput.value.value = ''; await loadDetail(); search() }
  catch (e) { flash(e.response?.data?.error || 'Upload failed.') }
}
const remove = async (x) => {
  if (!confirm(`Delete ${x.original_name}?`)) return
  try { await axios.delete(`${EXT}/docs/files/${x.id}`, { params: { actor: me } }); await loadDetail(); search() }
  catch (e) { flash(e.response?.data?.error || 'Unable to delete.') }
}
onMounted(search)
</script>

<style scoped>
.tools { margin-top: 28px; background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 14px 18px; }
.filters, .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 10px 0; }
.wide { min-width: 300px; } input, select { padding: 7px; border: 1px solid #d5d8dc; border-radius: 6px; }
button { padding: 6px 12px; border: none; border-radius: 6px; background: #566573; color: white; cursor: pointer; font-weight: 600; margin-right: 4px; }
button.primary { background: #27ae60; } button.danger { background: #e74c3c; }
.count { color: #7f8c8d; font-size: 13px; }
.tbl { width: 100%; border-collapse: collapse; } .tbl th, .tbl td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eaeded; font-size: 13px; vertical-align: top; }
.r { text-align: right !important; } .btns { white-space: nowrap; } .empty { color: #95a5a6; font-style: italic; text-align: center; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.box { background: white; width: min(860px, 94vw); max-height: 90vh; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
.head { background: #2c3e50; color: white; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; }
.x { background: none; font-size: 22px; color: white; } .body { padding: 16px 18px; overflow: auto; }
.sealed { background: #fdf2f0; border: 1px solid #f5b7b1; border-radius: 6px; padding: 8px 12px; }
.hist { padding-left: 18px; line-height: 1.8; font-size: 14px; } .msg { margin-top: 12px; background: #eaf2f8; border-radius: 6px; padding: 8px 12px; }
</style>
