// Đa ngôn ngữ EN / VI cho web. Dùng trong template: {{ $t('key') }}; trong script: import { t } from '../i18n'.
// Thiếu khóa ở tiếng Việt thì tự rơi về tiếng Anh; thiếu cả hai thì hiện chính khóa đó.
import { reactive } from 'vue'
import en from './locales/en'
import vi from './locales/vi'

const messages = { en, vi }

const state = reactive({
  lang: (() => { try { return localStorage.getItem('lang') || 'en' } catch { return 'en' } })()
})
if (!messages[state.lang]) state.lang = 'en'

export function t(key, params) {
  let s = (messages[state.lang] && messages[state.lang][key]) || messages.en[key] || key
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v)
  return s
}

export function setLang(l) {
  if (!messages[l]) return
  state.lang = l
  try { localStorage.setItem('lang', l) } catch { /* bỏ qua */ }
  document.documentElement.lang = l
}

export const i18nState = state
export default { install(app) { app.config.globalProperties.$t = t } }
