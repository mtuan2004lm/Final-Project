<template>
  <div>
    <header><h1>👥 User Management</h1></header>

    <div class="card">
      <h3>➕ Create account</h3>
      <div class="grid">
        <input v-model="form.username" placeholder="Username (3-40 characters)" />
        <input v-model="form.full_name" placeholder="Full name" />
        <select v-model="form.role"><option v-for="r in roles" :key="r" :value="r">{{ r }}</option></select>
        <input v-model="form.password" type="text" placeholder="Initial password (min 6)" />
        <button class="primary" @click="create">Create</button>
      </div>
    </div>

    <p v-if="loadError" class="msg" style="background:#fdf2f0;color:#922b21">⚠️ {{ loadError }}</p>
    <input v-model="filter" class="search" placeholder="🔍 Filter by name, username or role..." />
    <table class="tbl">
      <thead><tr><th>#</th><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="u in shown" :key="u.id" :class="{ off: !u.active }">
          <td>{{ u.id }}</td>
          <td><b>{{ u.username }}</b><small v-if="u.username === me"> (you)</small></td>
          <td>{{ u.full_name }}</td>
          <td>
            <select :value="u.role" :disabled="u.username === me" @change="update(u, { role: $event.target.value })">
              <option v-for="r in roles" :key="r" :value="r">{{ r }}</option>
            </select>
          </td>
          <td><span :class="['pill', u.active ? 'on' : 'off']">{{ u.active ? 'Active' : 'Disabled' }}</span></td>
          <td>{{ u.created_at ? new Date(u.created_at).toLocaleDateString() : '—' }}</td>
          <td class="actions">
            <button @click="update(u, { active: !u.active })" :disabled="u.username === me">{{ u.active ? '🔒 Disable' : '🔓 Enable' }}</button>
            <button @click="resetPw(u)">🔑 Reset password</button>
          </td>
        </tr>
        <tr v-if="shown.length === 0"><td colspan="7" class="empty">No users found.</td></tr>
      </tbody>
    </table>
    <p v-if="message" class="msg">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const EXT = 'http://localhost:3000/api/ext'
const me = localStorage.getItem('username') || ''  // đọc lúc mở trang; nhiều tài khoản chung 1 trình duyệt sẽ dùng chung giá trị này
const roles = ['CUSTOMER', 'OMS', 'WMS', 'TMS', 'ACC', 'DOCS', 'ADMIN']
const users = ref([])
const filter = ref('')
const message = ref('')
const form = ref({ username: '', full_name: '', role: 'OMS', password: '' })

const shown = computed(() => {
  const q = filter.value.trim().toLowerCase()
  return users.value.filter(u => !q || `${u.username} ${u.full_name} ${u.role}`.toLowerCase().includes(q))
})
const flash = (m) => { if (/Only an active Admin|Admin account required/.test(m)) m = 'You are signed in as "' + (localStorage.getItem('username') || '?') + '", not an Admin. Log out and sign in with the admin account (use a separate browser profile or incognito window for each role).'; alert(m); message.value = m; setTimeout(() => { if (message.value === m) message.value = '' }, 4500) }
const loadError = ref('')
const load = async () => {
  try { users.value = (await axios.get(`${EXT}/admin/users`)).data; loadError.value = '' }
  catch (e) { loadError.value = e.response?.data?.error || 'Unable to load users. Is the backend running?' }
}

const create = async () => {
  try {
    await axios.post(`${EXT}/admin/users`, { ...form.value, actor: me })
    flash(`Account ${form.value.username} created.`)
    form.value = { username: '', full_name: '', role: 'OMS', password: '' }
    await load()
  } catch (e) { flash(e.response?.data?.error || 'Error creating the account.') }
}
const update = async (u, patch) => {
  try { await axios.put(`${EXT}/admin/users/${u.id}`, { ...patch, actor: me }); await load() }
  catch (e) { flash(e.response?.data?.error || 'Error updating the user.'); await load() }
}
const resetPw = async (u) => {
  const pw = prompt(`New password for ${u.username} (min 6 characters):`)
  if (pw === null) return
  try { await axios.post(`${EXT}/admin/users/${u.id}/reset-password`, { new_password: pw, actor: me }); flash(`Password reset for ${u.username}.`) }
  catch (e) { flash(e.response?.data?.error || 'Error resetting the password.') }
}
onMounted(load)
</script>

<style scoped>
.card { background: white; border: 1px solid #e5e8ea; border-radius: 8px; padding: 14px 18px; margin: 14px 0; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
input, select { padding: 8px; border: 1px solid #d5d8dc; border-radius: 6px; }
.search { width: 340px; margin: 6px 0 12px; }
button { padding: 6px 12px; border: none; border-radius: 6px; background: #566573; color: white; cursor: pointer; font-weight: 600; margin-right: 6px; }
button.primary { background: #27ae60; } button:disabled { opacity: .4; cursor: default; }
.tbl { width: 100%; border-collapse: collapse; background: white; }
.tbl th, .tbl td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eaeded; font-size: 14px; }
tr.off td { color: #95a5a6; }
.pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; }
.pill.on { background: #d5f5e3; color: #1e8449; } .pill.off { background: #f2f3f4; color: #7f8c8d; }
.empty { text-align: center; color: #95a5a6; font-style: italic; }
.msg { margin-top: 12px; background: #eaf2f8; border-radius: 6px; padding: 8px 12px; }
</style>
