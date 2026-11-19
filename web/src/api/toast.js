import { ref } from 'vue';
export const toasts = ref([]);
let seq = 0;
export function toast(msg, kind = 'ok') {
  const id = ++seq;
  toasts.value.push({ id, msg, kind });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 4000);
}
