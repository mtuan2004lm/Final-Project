<template>
  <div class="login-container">
    <div class="login-box">
      <h2>{{ $t('login.title') }}</h2>

      <div class="form-group">
        <label>{{ $t('login.username') }}</label>
        <input v-model="username" type="text" :placeholder="$t('login.username_ph')" />
      </div>

      <div class="form-group">
        <label>{{ $t('login.password') }}</label>
        <input v-model="password" type="password" :placeholder="$t('login.password_ph')" @keyup.enter="handleLogin" />
      </div>

      <button @click="handleLogin">{{ $t('login.button') }}</button>

      <p style="margin-top: 14px; font-size: 14px;"><span @click="router.push('/forgot')" style="color: #2c5364; cursor: pointer; text-decoration: underline;">{{ $t('login.forgot') }}</span></p>

      <div class="link-switch" style="margin-top: 20px; font-size: 14px;">
        <p>{{ $t('login.no_account') }} <span @click="router.push('/register')" style="color: #2c5364; font-weight: bold; cursor: pointer; text-decoration: underline;">{{ $t('login.register_now') }}</span></p>
      </div>

      <p v-if="message" :class="{'success': isSuccess, 'error': !isSuccess}">
        {{ message }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { t } from '../i18n';

const username = ref('');
const password = ref('');
const message = ref('');
const isSuccess = ref(false);
const router = useRouter();

const handleLogin = async () => {
  if (!username.value || !password.value) {
    isSuccess.value = false;
    message.value = t('login.need_both');
    return;
  }

  try {
    const res = await axios.post('http://localhost:3000/api/auth/login', {
      username: username.value,
      password: password.value
    });

    const user = res.data.user;
    const role = user.role;

    isSuccess.value = true;
    message.value = t('login.welcome', { name: user.full_name || username.value });

    localStorage.setItem('role', role);
    localStorage.setItem('username', user.username);
    if(res.data.token) {
        localStorage.setItem('token', res.data.token);
    }

    // ĐIỀU HƯỚNG TỰ ĐỘNG KHỚP CÁC PHÒNG BAN VÀ THÊM QUYỀN KẾ TOÁN (ACC) + QUẢN TRỊ (ADMIN)
    setTimeout(() => {
        const checkRole = role.toUpperCase();
        if (checkRole === 'CUSTOMER') {
            router.push('/customer');
        } else if (checkRole === 'OMS') {
            router.push('/oms');
        } else if (checkRole === 'WMS') {
            router.push('/wms');
        } else if (checkRole === 'TMS') {
            router.push('/tms');
        } else if (checkRole === 'DOCS' || role === 'Docs') {
            router.push('/docs');
        } else if (checkRole === 'ACC') {
            router.push('/acc');
        } else if (checkRole === 'ADMIN') {
            router.push('/admin'); // <-- ĐƯỜNG DẪN MỚI THÊM ĐƯA QUẢN TRỊ VIÊN VÀO DASHBOARD TỔNG QUAN
        } else {
            router.push('/');
        }
    }, 1000);

  } catch (error) {
    isSuccess.value = false;
    message.value = error.response?.data?.message || t('login.server_error');
  }
};
</script>

<style scoped>
.login-container { display: flex; justify-content: center; align-items: center; height: 100vh; background: #eef2f6; }
.login-box { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.1); width: 350px; text-align: center;}
.form-group { text-align: left; margin-bottom: 15px; }
.form-group label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box;}
button { width: 100%; padding: 10px; background: #2c3e50; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 10px;}
button:hover { background: #42b883; }
.error { color: red; margin-top: 10px; font-weight: 500; }
.success { color: green; margin-top: 10px; font-weight: 500; }
</style>