import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { startAutoTranslate } from './autoTranslate'

const app = createApp(App)

app.use(router)
app.use(i18n)

app.mount('#app')
startAutoTranslate() // dịch giao diện hiện có sang tiếng Việt khi chọn VI
