<template>
    <div class="dashboard-container">
      <div class="sidebar">
        <div class="brand">LOGISTICS PRO</div>
        <div class="user-info">
          <div class="avatar">{{ userRole ? userRole.charAt(0) : '' }}</div>
          <div>
             <h3>{{ userRole }}</h3>
             <small>Đang online</small>
          </div>
        </div>
        <button @click="logout" class="btn-logout">Đăng Xuất</button>
      </div>
  
      <div class="main-content">
        <header>
          <h1>QUẢN LÝ CÔNG VIỆC</h1>
        </header>
        
        <div class="content-body">
          <slot></slot>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  
  const router = useRouter();
  const userRole = ref('');
  
  onMounted(() => {
      userRole.value = localStorage.getItem('role') || '';
      const token = localStorage.getItem('token');
      
      if (!token) {
          router.push('/');
      }
  });
  
  const logout = () => {
      localStorage.clear();
      router.push('/');
  };
  </script>
  
  <style scoped>
  .dashboard-container { display: flex; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f2f5;}
  .sidebar { width: 240px; background: #2c3e50; color: white; padding: 20px; display: flex; flex-direction: column; }
  .brand { font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 30px; letter-spacing: 1px; }
  .user-info { display: flex; align-items: center; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid #34495e; margin-bottom: 20px; }
  .avatar { width: 40px; height: 40px; background: #e67e22; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; }
  .btn-logout { margin-top: auto; padding: 10px; background: #c0392b; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
  .main-content { flex: 1; padding: 30px; overflow-y: auto; }
  h1 { color: #2c3e50; margin-bottom: 20px; font-size: 24px; }
  </style>