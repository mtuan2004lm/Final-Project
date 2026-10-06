<template>
  <div class="lang-switch">
    <button :class="{ on: i18nState.lang === 'en' }" @click="setLang('en')">EN</button>
    <button :class="{ on: i18nState.lang === 'vi' }" @click="setLang('vi')">VI</button>
  </div>
</template>

<script setup>
import { i18nState, setLang } from '../i18n'
</script>

<style scoped>
.lang-switch { position: fixed; top: 10px; right: 12px; z-index: 2000; display: flex; background: white; border: 1px solid #d5d8dc; border-radius: 20px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
.lang-switch button { border: none; background: transparent; padding: 5px 12px; font-size: 12px; font-weight: bold; cursor: pointer; color: #566573; width: auto; margin: 0; }
.lang-switch button.on { background: #2c3e50; color: white; }
</style>
