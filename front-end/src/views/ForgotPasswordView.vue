<template>
  <div class="wrap">
    <div class="box">
      <h2>{{ $t('forgot.title') }}</h2>

      <!-- Bước 1: nhập tên đăng nhập -->
      <div v-if="step === 1">
        <p class="hint">{{ $t('forgot.step1') }}</p>
        <input v-model="username" type="text" :placeholder="$t('login.username_ph')" @keyup.enter="sendCode" />
        <button @click="sendCode" :disabled="busy">{{ $t('forgot.send') }}</button>
      </div>

      <!-- Bước 2: nhập OTP -->
      <div v-else-if="step === 2">
        <p class="hint">{{ $t('forgot.step2') }}</p>
        <p v-if="devOtp" class="dev">{{ $t('forgot.dev_hint') }} <b>{{ devOtp }}</b></p>
        <input v-model="otp" type="text" inputmode="numeric" maxlength="6" :placeholder="$t('forgot.code')" @keyup.enter="verify" />
        <button @click="verify" :disabled="busy">{{ $t('forgot.verify') }}</button>
        <button class="link" @click="sendCode" :disabled="busy">{{ $t('forgot.resend') }}</button>
      </div>

      <!-- Bước 3: mật khẩu mới -->
      <div v-else-if="step === 3">
        <p class="hint">{{ $t('forgot.step3') }}</p>
        <input v-model="pw1" type="password" :placeholder="$t('forgot.new_password')" />
        <input v-model="pw2" type="password" :placeholder="$t('forgot.confirm_password')" @keyup.enter="reset" />
        <button @click="reset" :disabled="busy">{{ $t('forgot.change') }}</button>
      </div>

      <div v-else>
        <p class="ok">{{ $t('forgot.done') }}</p>
      </div>

      <p v-if="message" class="err">{{ message }}</p>
      <p class="back"><span @click="router.push('/')">← {{ $t('forgot.back_login') }}</span></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { t } from '../i18n'

const router = useRouter()
const API = 'http://localhost:3000/api/ext/auth'
const step = ref(1)
const username = ref('')
const otp = ref('')
const pw1 = ref('')
const pw2 = ref('')
const resetToken = ref('')
const devOtp = ref('')
const message = ref('')
const busy = ref(false)

const run = async (fn) => {
  busy.value = true; message.value = ''
  try { await fn() }
  catch (e) { message.value = e.response?.data?.error || t('common.error') }
  finally { busy.value = false }
}

const sendCode = () => run(async () => {
  if (!username.value.trim()) { message.value = t('login.need_both'); return }
  const r = await axios.post(`${API}/forgot`, { username: username.value.trim() })
  devOtp.value = r.data.dev_otp || ''
  otp.value = ''
  step.value = 2
})

const verify = () => run(async () => {
  const r = await axios.post(`${API}/verify-otp`, { username: username.value.trim(), otp: otp.value.trim() })
  resetToken.value = r.data.reset_token
  step.value = 3
})

const reset = () => run(async () => {
  if (pw1.value !== pw2.value) { message.value = t('forgot.mismatch'); return }
  await axios.post(`${API}/reset`, { username: username.value.trim(), reset_token: resetToken.value, new_password: pw1.value })
  step.value = 4
  setTimeout(() => router.push('/'), 2500)
})
</script>

<style scoped>
.wrap { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #eef2f6; }
.box { background: white; padding: 36px; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,.1); width: 360px; text-align: center; }
.hint { font-size: 14px; color: #566573; margin: 8px 0 14px; }
input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; margin-bottom: 10px; }
button { width: 100%; padding: 10px; background: #2c3e50; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; }
button:hover:not(:disabled) { background: #42b883; }
button:disabled { opacity: .6; cursor: default; }
button.link { background: none; color: #2c5364; margin-top: 8px; text-decoration: underline; font-weight: normal; }
.dev { background: #fff8e6; border: 1px dashed #e67e22; border-radius: 6px; padding: 8px; font-size: 13px; }
.err { color: #c0392b; margin-top: 12px; font-size: 14px; }
.ok { color: #27ae60; font-weight: 600; }
.back { margin-top: 18px; font-size: 14px; }
.back span { cursor: pointer; color: #2c5364; text-decoration: underline; }
</style>
