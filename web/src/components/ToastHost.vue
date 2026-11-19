<script setup>
import { toasts } from '../api/toast.js';
</script>
<template>
  <div style="position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:2000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none">
    <div v-for="t in toasts" :key="t.id" class="oh-toast" :class="t.kind" style="pointer-events:auto">{{ t.msg }}</div>
  </div>
</template>
<style scoped>
.oh-toast{background:linear-gradient(135deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.06) 42%,rgba(255,255,255,.03) 100%),rgba(30,32,36,.85);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(20px) saturate(1.5);-webkit-backdrop-filter:blur(20px) saturate(1.5);color:var(--fg);border-radius:10px;padding:9px 20px;font-size:12.5px;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 12px 36px rgba(0,0,0,.45);animation:toastin .25s cubic-bezier(.4,0,.2,1)}
.oh-toast.ok{border-left:3px solid var(--ok)}
.oh-toast.bad{background:linear-gradient(135deg,rgba(239,68,68,.45) 0%,rgba(185,28,28,.65) 100%),rgba(30,32,36,.82);border:1px solid rgba(239,68,68,.55);color:#fff}
.oh-toast.bad{border-left:3px solid var(--bad)}
@keyframes toastin{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
</style>
