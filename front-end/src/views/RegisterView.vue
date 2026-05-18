<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="card-header">
        <h1>ĐĂNG KÝ TÀI KHOẢN</h1>
        <p>Dành cho Khách Hàng mới</p>
      </div>
      
      <div class="card-body">
        <div class="input-group">
          <label>Họ và Tên</label>
          <input v-model="fullName" type="text" placeholder="Ví dụ: Nguyễn Văn A" />
        </div>

        <div class="input-group">
          <label>Tên đăng nhập</label>
          <input v-model="username" type="text" placeholder="Chọn tên đăng nhập..." />
        </div>

        <div class="input-group">
          <label>Mật khẩu</label>
          <input v-model="password" type="password" placeholder="Nhập mật khẩu..." />
        </div>

        <button @click="handleRegister" class="btn-login">TẠO TÀI KHOẢN</button>
        
        <div class="link-switch">
            <p>Đã có tài khoản? <span @click="router.push('/')">Đăng nhập ngay</span></p>
        </div>

        <div v-if="message" class="alert" :class="isSuccess ? 'alert-success' : 'alert-error'">
          {{ message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';

const fullName = ref('');
const username = ref('');
const password = ref('');
const message = ref('');
const isSuccess = ref(false);
const router = useRouter();

const handleRegister = async () => {
    if(!fullName.value || !username.value || !password.value) {
        isSuccess.value = false;
        message.value = "Vui lòng nhập đủ 3 ô!";
        return;
    }

    try {
        message.value = "Đang xử lý...";
        // SỬA ĐƯỜNG DẪN: Đổi từ /api/register sang /api/auth/register cho khớp backend
        const res = await axios.post('http://localhost:3000/api/auth/register', {
            fullName: fullName.value,
            username: username.value,
            password: password.value
        });

        isSuccess.value = true;
        message.value = res.data?.message || "Đăng ký thành công! Đang chuyển về đăng nhập...";
        
        setTimeout(() => {
            router.push('/'); 
        }, 1500);

    } catch (error) {
        isSuccess.value = false;
        message.value = error.response?.data?.message || 'Lỗi kết nối Server!';
    }
};
</script>

<style scoped>
.login-wrapper {
  width: 100vw; height: 100vh; display: flex; justify-content: center; align-items: center;
  background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
}
.login-card { background: white; width: 450px; padding: 40px; border-radius: 12px; box-shadow: 0 15px 30px rgba(0,0,0,0.5); text-align: center; }
.card-header h1 { color: #2c3e50; font-size: 24px; font-weight: 800; }
.card-header p { color: #7f8c8d; font-size: 14px; margin-top: 5px; }
.card-body { margin-top: 25px; }
.input-group { text-align: left; margin-bottom: 15px; }
.input-group label { display: block; font-weight: 600; margin-bottom: 5px; font-size: 14px; }
.input-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; outline: none; }
.input-group input:focus { border-color: #2c5364; }
.btn-login { width: 100%; padding: 15px; background: #2c5364; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; text-transform: uppercase; margin-top: 10px; }
.btn-login:hover { background: #203a43; }
.link-switch { margin-top: 20px; font-size: 14px; }
.link-switch span { color: #2c5364; font-weight: bold; cursor: pointer; text-decoration: underline; }
.alert { margin-top: 20px; padding: 10px; border-radius: 5px; font-size: 14px; }
.alert-error { background-color: #ffebee; color: #c62828; }
.alert-success { background-color: #e8f5e9; color: #2e7d32; }
</style>