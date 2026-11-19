<script setup>
import { ref, watch } from 'vue';
const props = defineProps({ modelValue: Boolean, title: { type: String, default: '' }, message: { type: String, default: '' }, placeholder: { type: String, default: '' }, confirmText: { type: String, default: '确认' }, danger: Boolean, error: String });
const emit = defineEmits(['update:modelValue', 'confirm']);
const val = ref('');
watch(() => props.modelValue, v => { if (v) val.value = ''; });
function ok() { if (!props.message && !val.value.trim()) return; emit('confirm', val.value.trim(), () => emit('update:modelValue', false)); }
</script>
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="oh-dlg-mask" @click.self="emit('update:modelValue', false)">
      <div class="oh-dlg">
        <div class="oh-dlg-title">{{ title }}</div>
        <div v-if="message" class="oh-dlg-msg">{{ message }}</div>
        <input v-else class="oh-dlg-input" :class="{ err: error }" v-model="val" :placeholder="placeholder" @keyup.enter="ok" />
        <div class="oh-dlg-err" v-if="error">{{ error }}</div>
        <div class="oh-dlg-btns">
          <button class="oh-btn ghost" @click="emit('update:modelValue', false)">取消</button>
          <button class="oh-btn" :class="danger ? 'danger' : 'primary'" @click="ok">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
