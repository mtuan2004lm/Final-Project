<template>
  <div class="tools">
    <h2>{{ titles[tab] }}</h2>

    <!-- ================= CÔNG NỢ ================= -->
    <div v-if="tab === 'recv'">
      <div class="tiles">
        <div class="tile"><b>{{ money(recv.total_receivable) }}</b><span>Total receivable (USD)</span></div>
        <div class="tile bad"><b>{{ money(recv.total_overdue) }}</b><span>Overdue more than {{ recv.overdue_days }} days (USD)</span></div>
      </div>
      <p v-if="!recv.customers.length" class="empty">No outstanding invoices.</p>
      <div v-for="c in recv.customers" :key="c.username || c.customer_name" class="cust">
        <div class="cust-head">
          <div><b>{{ c.customer_name || c.username }}</b> <small>({{ c.username }})</small></div>
          <div>Outstanding <b>{{ money(c.total) }}</b> · Overdue <b :class="{ red: c.overdue_total > 0 }">{{ money(c.overdue_total) }}</b></div>
          <div class="btns">
            <button v-if="c.overdue_total > 0" class="warn" @click="remind(c)">🔔 Send reminder</button>
            <input type="month" v-model="stmtMonth[c.username]" />
            <button @click="openStatement(c)">📄 Statement</button>
          </div>
        </div>
        <table class="tbl"><tbody>
          <tr v-for="o in c.orders" :key="o.id" :class="{ overdue: o.overdue }">
            <td>#{{ o.id }}</td><td>{{ o.status }}</td><td>{{ o.age_days }} days old</td><td class="r">{{ money(o.amount) }}</td><td><span v-if="o.overdue" class="tag">OVERDUE</span></td>
          </tr>
        </tbody></table>
      </div>
    </div>

    <!-- ================= HÓA ĐƠN ================= -->
    <div v-if="tab === 'inv'">
      <div class="bar">
        <input v-model.number="invOrder" type="number" min="1" placeholder="Order ID (e.g. 12)" />
        <button class="primary" @click="issue">🧾 Issue VAT invoice</button>
        <small>The order must be paid or delivered. VAT and numbering follow Admin settings.</small>
      </div>
      <table class="tbl">
        <thead><tr><th>Invoice no.</th><th>Order</th><th>Customer</th><th class="r">Subtotal</th><th class="r">VAT</th><th class="r">Total</th><th>Status</th><th>Issued</th><th></th></tr></thead>
        <tbody>
          <tr v-for="i in invoices" :key="i.id" :class="{ cancelled: i.status === 'CANCELLED' }">
            <td><b>{{ i.invoice_no }}</b></td><td>#{{ i.order_id }}</td><td>{{ i.customer_name }}</td>
            <td class="r">{{ money(i.subtotal) }}</td><td class="r">{{ money(i.vat_amount) }}</td><td class="r"><b>{{ money(i.total) }}</b></td>
            <td>{{ i.status }}</td><td>{{ new Date(i.issued_at).toLocaleDateString() }}</td>
            <td class="btns"><button @click="openInvoice(i)">👁️ View</button><button v-if="i.status === 'ISSUED'" class="danger" @click="cancelInvoice(i)">✖ Cancel</button></td>
          </tr>
          <tr v-if="!invoices.length"><td colspan="9" class="empty">No invoices yet.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- ================= ĐỐI SOÁT ================= -->
    <div v-if="tab === 'rec'">
      <p class="hint">Upload a bank statement (CSV) with columns <b>date</b>, <b>amount</b> and <b>description</b>. Rows are matched to unpaid orders by the package code in the description (e.g. PKG-60023) and the amount.</p>
      <input type="file" accept=".csv,text/csv" @change="onStatement" />
      <div v-if="recResults.length">
        <p><b>{{ matchedCount }}</b> of {{ recResults.length }} rows matched.</p>
        <table class="tbl">
          <thead><tr><th></th><th>Row</th><th>Description</th><th class="r">Amount</th><th>Order</th><th>Result</th></tr></thead>
          <tbody>
            <tr v-for="r in recResults" :key="r.row" :class="r.status">
              <td><input v-if="r.status === 'matched'" type="checkbox" v-model="picked" :value="r.order_id" /></td>
              <td>{{ r.row }}</td><td>{{ r.description }}</td><td class="r">{{ money(r.amount) }}</td>
              <td>{{ r.order_id ? '#' + r.order_id : '—' }}</td>
              <td>{{ statusText(r) }}</td>
            </tr>
          </tbody>
        </table>
        <button class="primary" :disabled="!picked.length" @click="confirmRec">✔ Mark {{ picked.length }} order(s) as paid</button>
      </div>
    </div>

    <!-- ================= XUẤT FILE ================= -->
    <div v-if="tab === 'exp'">
      <div class="bar">
        <label>From <input type="date" v-model="from" /></label>
        <label>To <input type="date" v-model="to" /></label>
      </div>
      <div class="btns big">
        <button v-for="e in exports" :key="e.kind" @click="download(e.kind)">⬇️ {{ e.label }}</button>
      </div>
      <p class="hint">Files are CSV (UTF-8). In Excel use Data → From Text/CSV, or just double-click the file.</p>
    </div>

    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

const HOST = 'http://localhost:3000'
const EXT = `${HOST}/api/ext`
const me = localStorage.getItem('username') || 'ACC'
// Tab hiện tại do menu bên trái của trang Kế toán chọn (AccView truyền xuống qua prop)
const props = defineProps({ tab: { type: String, default: 'recv' } })
const titles = { recv: '💳 Receivables', inv: '🧾 VAT Invoices', rec: '🏦 Bank reconciliation', exp: '⬇️ Export' }
const exports = [
  { kind: 'orders', label: 'Orders' }, { kind: 'refunds', label: 'Refunds' }, { kind: 'claims', label: 'Claims' },
  { kind: 'invoices', label: 'Invoices' }, { kind: 'fleet-costs', label: 'Fleet costs' }
]
const message = ref('')
const money = (n) => Number(n || 0).toFixed(2)
const flash = (m) => { message.value = m; setTimeout(() => { if (message.value === m) message.value = '' }, 5000) }
const err = (e, fb) => flash(e.response?.data?.error || fb)

// --- công nợ ---
const recv = ref({ overdue_days: 7, customers: [], total_receivable: 0, total_overdue: 0 })
const stmtMonth = ref({})
const loadRecv = async () => { try { recv.value = (await axios.get(`${EXT}/acc/receivables`)).data } catch (e) { /* bỏ qua */ } }
const remind = async (c) => {
  try { const r = await axios.post(`${EXT}/acc/receivables/remind`, { username: c.username, actor: me }); flash(r.data.message) }
  catch (e) { err(e, 'Unable to send the reminder.') }
}
const openStatement = (c) => {
  const month = stmtMonth.value[c.username] || new Date().toISOString().slice(0, 7)
  window.open(`${EXT}/documents/statement?username=${encodeURIComponent(c.username)}&month=${month}`, '_blank')
}

// --- hóa đơn ---
const invoices = ref([])
const invOrder = ref(null)
const loadInvoices = async () => { try { invoices.value = (await axios.get(`${EXT}/acc/invoices`)).data } catch (e) { /* bỏ qua */ } }
const issue = async () => {
  try {
    const r = await axios.post(`${EXT}/acc/invoices`, { order_id: invOrder.value, issued_by: me })
    flash(`Invoice ${r.data.invoice_no} issued (total ${money(r.data.total)} USD).`); invOrder.value = null; await loadInvoices()
  } catch (e) { err(e, 'Unable to issue the invoice.') }
}
const openInvoice = (i) => window.open(`${EXT}/documents/invoice-official/${i.id}`, '_blank')
const cancelInvoice = async (i) => {
  const reason = prompt(`Reason for cancelling ${i.invoice_no}:`)
  if (!reason) return
  try { await axios.post(`${EXT}/acc/invoices/${i.id}/cancel`, { reason, actor: me }); await loadInvoices() }
  catch (e) { err(e, 'Unable to cancel the invoice.') }
}

// --- đối soát ---
const recResults = ref([])
const picked = ref([])
const matchedCount = computed(() => recResults.value.filter(r => r.status === 'matched').length)
const STATUS = {
  matched: '✓ Matches an unpaid order', amount_mismatch: '⚠ Amount differs from the order', already_paid: 'Already paid',
  no_order: 'Order not found', no_code: 'No package code in the description', duplicate: 'Duplicate of an earlier row'
}
const statusText = (r) => r.status === 'amount_mismatch' ? `${STATUS.amount_mismatch} (expected ${money(r.expected)})` : STATUS[r.status] || r.status

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const first = text.split(/\r?\n/)[0] || ''
  const d = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ','
  const out = []; let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true
    else if (c === d) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim())) out.push(row); row = [] }
    else cell += c
  }
  row.push(cell); if (row.some(x => x.trim())) out.push(row)
  return out
}
const onStatement = async (ev) => {
  const file = ev.target.files[0]; if (!file) return
  const table = parseCsv(await file.text())
  if (table.length < 2) return flash('The file needs a header row and at least one data row.')
  const h = table[0].map(x => x.trim().toLowerCase())
  const find = (names) => h.findIndex(x => names.some(n => x.includes(n)))
  const iDate = find(['date', 'ngày']), iAmt = find(['amount', 'credit', 'số tiền', 'có']), iDesc = find(['description', 'content', 'memo', 'nội dung', 'detail'])
  if (iAmt < 0 || iDesc < 0) return flash('Could not find the "amount" and "description" columns.')
  const rows = table.slice(1, 1001).map(r => ({ date: iDate >= 0 ? r[iDate] : '', amount: r[iAmt], description: r[iDesc] }))
  try {
    const r = await axios.post(`${EXT}/acc/reconcile`, { rows })
    recResults.value = r.data.results; picked.value = r.data.results.filter(x => x.status === 'matched').map(x => x.order_id)
  } catch (e) { err(e, 'Reconciliation failed.') }
}
const confirmRec = async () => {
  try { const r = await axios.post(`${EXT}/acc/reconcile/confirm`, { order_ids: picked.value, actor: me }); flash(r.data.message); recResults.value = []; picked.value = []; loadRecv() }
  catch (e) { err(e, 'Unable to confirm.') }
}

// --- xuất file ---
const from = ref(''); const to = ref('')
const download = (kind) => {
  const q = new URLSearchParams(); if (from.value) q.set('from', from.value); if (to.value) q.set('to', to.value)
  window.open(`${EXT}/acc/export/${kind}?${q}`, '_blank')
}

onMounted(() => { loadRecv(); loadInvoices() })
watch(() => props.tab, () => { loadRecv(); loadInvoices() })
</script>

<style scoped>
.tools { margin-top: 28px; background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 14px 18px; }
.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 16px; }
.tabs button { padding: 8px 14px; border: 1px solid #d5d8dc; background: white; color: #2c3e50; border-radius: 6px; cursor: pointer; font-weight: 600; }
.tabs button.on { background: #2c3e50; color: white; border-color: #2c3e50; }
.tiles { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.tile { border: 1px solid #e5e8ea; border-left: 4px solid #27ae60; border-radius: 8px; padding: 8px 16px; display: flex; flex-direction: column; }
.tile.bad { border-left-color: #e74c3c; } .tile b { font-size: 22px; } .tile span { font-size: 12px; color: #7f8c8d; }
.cust { border: 1px solid #e5e8ea; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
.cust-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; background: #f8f9f9; padding: 8px 12px; }
.red { color: #c0392b; } .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
.btns { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; } .btns.big button { padding: 12px 18px; }
input, select { padding: 7px; border: 1px solid #d5d8dc; border-radius: 6px; }
button { padding: 6px 12px; border: none; border-radius: 6px; background: #566573; color: white; cursor: pointer; font-weight: 600; }
button.primary { background: #27ae60; } button.warn { background: #e67e22; } button.danger { background: #e74c3c; } button:disabled { opacity: .4; cursor: default; }
.tbl { width: 100%; border-collapse: collapse; } .tbl th, .tbl td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #eaeded; font-size: 14px; }
.r { text-align: right !important; } tr.overdue td { background: #fdf2f0; } tr.cancelled td { color: #95a5a6; text-decoration: line-through; }
tr.matched td { background: #eafaf1; } tr.amount_mismatch td { background: #fef9e7; } tr.no_order td, tr.no_code td { color: #95a5a6; }
.tag { background: #e74c3c; color: white; border-radius: 10px; font-size: 11px; padding: 2px 8px; font-weight: 700; }
.empty { color: #95a5a6; font-style: italic; text-align: center; } .hint { color: #7f8c8d; font-size: 13px; }
.msg { margin-top: 12px; background: #eaf2f8; border-radius: 6px; padding: 8px 12px; }
</style>
