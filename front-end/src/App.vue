<template>
  <LangSwitch />
  <RouterView />
</template>

<script setup>
import { RouterView } from 'vue-router'
import LangSwitch from './components/LangSwitch.vue'
</script>
