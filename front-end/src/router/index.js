import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import CustomerView from '../views/CustomerView.vue'
import OmsView from '../views/OmsView.vue'
import WmsView from '../views/WmsView.vue'
import TmsView from '../views/TmsView.vue'
import DocsView from '../views/DocsView.vue'
import AccView from '../views/AccView.vue'

const routes = [
  { path: '/', component: LoginView },
  { path: '/customer', component: CustomerView },
  { path: '/oms', component: OmsView },
  { path: '/wms', component: WmsView },
  { path: '/tms', component: TmsView },
  { path: '/docs', component: DocsView },
  {
    path: '/acc',
    component: () => import('../views/AccView.vue') // Tải bất đồng bộ giao diện Phê duyệt tiền của phòng Kế toán
  },
  {
    path: '/admin',
    component: () => import('../views/AdminView.vue') // Tải bất đồng bộ giao diện Tổng quan Quản trị viên
  },
  {
    // ĐÃ THÊM: LoginView.vue có nút "Đăng ký ngay" gọi router.push('/register')
    // nhưng route này chưa từng được khai báo -> bấm vào sẽ báo "No match found".
    path: '/register',
    component: () => import('../views/RegisterView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router