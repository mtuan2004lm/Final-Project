// Tự động dịch giao diện sang tiếng Việt khi người dùng chọn VI.
// Cách hoạt động: duyệt mọi đoạn chữ / placeholder / title trên trang và thay bằng bản dịch trong bảng
// `locales/domVi*.js` (khớp nguyên câu, hoặc khớp mẫu có {} cho phần số liệu). Chọn EN thì khôi phục chữ gốc.
// Không phải sửa từng file .vue, và các màn hình mới thêm sau vẫn dịch được chỉ cần bổ sung bảng dịch.
import { watch } from 'vue'
import { i18nState } from './i18n'
import vi1 from './locales/domVi1'
import vi2 from './locales/domVi2'
import vi3 from './locales/domVi3'
import vi4 from './locales/domVi4'

const norm = (s) => s.replace(/\s+/g, ' ').trim()
const dict = { ...vi1, ...vi2, ...vi3, ...vi4 }

const exact = new Map()
const patterns = []
for (const [en, vi] of Object.entries(dict)) {
  const key = norm(en)
  if (key.includes('{}')) {
    const re = new RegExp('^' + key.split('{}').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)') + '$')
    patterns.push({ re, vi, weight: key.replace(/\{\}/g, '').length })
  } else {
    exact.set(key, vi)
  }
}

patterns.sort((a, b) => b.weight - a.weight)   // mẫu cụ thể (nhiều chữ cố định) được thử trước

// Trả về bản dịch hoặc null nếu không có.
export function translateText(raw, depth = 0) {
  if (typeof raw !== 'string') return null
  const key = norm(raw)
  if (!key || !/[A-Za-z]/.test(key)) return null
  if (exact.has(key)) return exact.get(key)
  for (const { re, vi } of patterns) {
    const m = re.exec(key)
    if (!m) continue
    let i = 1
    return vi.replace(/\{\}/g, () => {
      const part = m[i++] ?? ''
      return (depth < 1 && translateText(part, depth + 1)) || part
    })
  }
  return null
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT'])
const ATTRS = ['placeholder', 'title', 'alt', 'aria-label']
const origText = new WeakMap()      // node -> chữ gốc (tiếng Anh)
const appliedText = new WeakMap()   // node -> chữ đã thay (để biết khi nào Vue ghi đè lại)
const origAttr = new WeakMap()      // element -> { attr: { orig, applied } }

const isVi = () => i18nState.lang === 'vi'
const skipped = (el) => !el || SKIP_TAGS.has(el.tagName) || !!(el.closest && el.closest('[data-no-translate]'))

function handleText(node) {
  if (skipped(node.parentElement)) return
  const cur = node.nodeValue
  if (!isVi()) {
    if (origText.has(node) && appliedText.get(node) === cur) {
      node.nodeValue = origText.get(node)
      origText.delete(node); appliedText.delete(node)
    }
    return
  }
  if (appliedText.get(node) === cur) return          // đã dịch rồi
  const tr = translateText(cur)
  if (tr === null) return
  const lead = cur.match(/^\s*/)[0]
  const trail = cur.match(/\s*$/)[0]
  const next = lead + tr + trail
  origText.set(node, cur)
  appliedText.set(node, next)
  node.nodeValue = next
}

function handleAttrs(el) {
  if (skipped(el)) return
  for (const a of ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue
    const cur = el.getAttribute(a)
    let rec = origAttr.get(el)
    const slot = rec && rec[a]
    if (!isVi()) {
      if (slot && slot.applied === cur) { el.setAttribute(a, slot.orig); delete rec[a] }
      continue
    }
    if (slot && slot.applied === cur) continue
    const tr = translateText(cur)
    if (tr === null) continue
    if (!rec) { rec = {}; origAttr.set(el, rec) }
    rec[a] = { orig: cur, applied: tr }
    el.setAttribute(a, tr)
  }
}

function walk(root) {
  if (!root) return
  if (root.nodeType === Node.TEXT_NODE) return handleText(root)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  handleAttrs(root)
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n = tw.nextNode()
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) handleText(n)
    else handleAttrs(n)
    n = tw.nextNode()
  }
}

let queued = new Set()
let scheduled = false
function flush() {
  scheduled = false
  const items = queued
  queued = new Set()
  items.forEach(walk)
}
function enqueue(node) {
  queued.add(node)
  if (!scheduled) { scheduled = true; requestAnimationFrame(flush) }
}

export function startAutoTranslate() {
  const observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') enqueue(m.target)
      else if (m.type === 'attributes') enqueue(m.target)
      else m.addedNodes.forEach(enqueue)
    }
  })
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ATTRS
  })

  // Đổi ngôn ngữ -> duyệt lại toàn trang
  watch(() => i18nState.lang, () => walk(document.body), { flush: 'post' })
  document.documentElement.lang = i18nState.lang
  walk(document.body)

  // Hộp thoại alert / confirm cũng được dịch
  const nativeAlert = window.alert.bind(window)
  const nativeConfirm = window.confirm.bind(window)
  window.alert = (msg) => nativeAlert(isVi() ? (translateText(String(msg)) ?? msg) : msg)
  window.confirm = (msg) => nativeConfirm(isVi() ? (translateText(String(msg)) ?? msg) : msg)
}
