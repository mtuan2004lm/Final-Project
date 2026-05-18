<template>
  <div class="login-container">
    <div class="login-box">
      <h2>LOGISTICS COMPANY</h2>
      
      <div class="form-group">
        <label>Tài khoản:</label>
        <input v-model="username" type="text" placeholder="Nhập tên đăng nhập..." />
      </div>

      <div class="form-group">
        <label>Mật khẩu:</label>
        <input v-model="password" type="password" placeholder="Nhập mật khẩu..." />
      </div>

      <button @click="handleLogin">ĐĂNG NHẬP</button>
      
      <div class="link-switch" style="margin-top: 20px; font-size: 14px;">
        <p>Chưa có tài khoản? <span @click="router.push('/register')" style="color: #2c5364; font-weight: bold; cursor: pointer; text-decoration: underline;">Đăng ký ngay</span></p>
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

const username = ref('');
const password = ref('');
const message = ref('');
const isSuccess = ref(false);
const router = useRouter();

const handleLogin = async () => {
  if (!username.value || !password.value) {
    isSuccess.value = false;
    message.value = "Vui lòng nhập đầy đủ tài khoản và mật khẩu!";
    return;
  }

  try {
    // SỬA ĐƯỜNG DẪN: Thêm /auth/ trỏ đúng vào module xác thực của backend
    const res = await axios.post('http://localhost:3000/api/auth/login', {
      username: username.value,
      password: password.value
    });

    // Lấy thông tin từ phản hồi của server
    const user = res.data.user;
    const role = user.role; // Ví dụ: 'CUSTOMER', 'OMS', 'WMS', 'TMS', 'Docs'

    // Thông báo thành công
    isSuccess.value = true;
    message.value = `Xin chào ${user.full_name || username.value}! Đang chuyển vào hệ thống...`;
    
    // Lưu thông tin vào bộ nhớ trình duyệt
    localStorage.setItem('role', role);
    localStorage.setItem('username', user.username);
    if(res.data.token) {
        localStorage.setItem('token', res.data.token);
    }
    
    // ĐIỀU HƯỚNG TỰ ĐỘNG (Khớp chính xác với chuỗi hoa/thường quy định trong DB)
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
        } else {
            router.push('/');
        }
    }, 1000);

  } catch (error) {
    isSuccess.value = false;
    message.value = error.response?.data?.message || 'Lỗi kết nối Server!';
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