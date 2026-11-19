<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
const props = defineProps({ settings: Object, moduleKey: String });
const emit = defineEmits(['change', 'applyAll']);
const pop = ref('');
function onDocClick(e) { if (!e.target.closest('.oh-toolbar')) pop.value = '' }
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));
function set(part) { emit('change', Object.assign({}, props.settings, part)); }
const shapeIco = computed(() => props.settings.cardShape === 'square' ? 'M4 4h16v16H4z' : 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0');
const bgOptions = [
  { k: 'solid', n: '纯色', color: props.settings.bgColor || '#151517' },
  { k: 'flow', n: '流光', color: props.settings.flowColor || '#1d1b2e' }
];
const shapeOptions = [{ k: 'square', n: '方形' }, { k: 'round', n: '圆形' }];
function onColsV(v) { set({ cardsPerRow: Number(v) }); }
function onColor(o, e) { e.stopPropagation(); const v = e.target.value; if (o.k === 'solid') set({ bgMode: 'solid', bgColor: v }); else set({ bgMode: 'flow', flowColor: v }); }

</script>
<template>
  <div class="oh-toolbar">
    <button class="tb" @click="pop = pop === 'shape' ? '' : 'shape'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path :d="shapeIco"/></svg>
    </button>
    <button class="tb" @click="pop = pop === 'bg' ? '' : 'bg'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 14l4-4 4 4 3-3 5 5"/></svg>
    </button>
    <button class="tb" @click="pop = pop === 'cols' ? '' : 'cols'">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="display:block"><rect x="1.5" y="5" width="6" height="6" rx="1"/><rect x="9" y="5" width="6" height="6" rx="1"/><rect x="16.5" y="5" width="6" height="6" rx="1"/><rect x="1.5" y="13" width="6" height="6" rx="1"/><rect x="9" y="13" width="6" height="6" rx="1"/><rect x="16.5" y="13" width="6" height="6" rx="1"/></svg>
    </button>
    <button class="tb" title="应用到所有模块" @click="emit('applyAll')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/></svg>
    </button>
    <div class="tb-pop" v-if="pop === 'shape'">
      <div class="tb-opt" v-for="o in shapeOptions" :key="o.k" :class="{ sel: settings.cardShape === o.k }" @click="set({ cardShape: o.k })">{{ o.n }}</div>
    </div>
    <div class="tb-pop" v-if="pop === 'bg'">
      <div class="tb-opt" v-for="o in bgOptions" :key="o.k" :class="{ sel: settings.bgMode === o.k }" @click="set({ bgMode: o.k })">
        <span class="opt-name">{{ o.n }}</span>
        <span class="opt-mark" v-if="settings.bgMode === o.k">✓</span>
        <span class="opt-color" :style="{ background: o.color }" title="选择颜色" @click.stop>
          <input type="color" :value="o.color" @input="onColor(o, $event)" @click.stop />
        </span>
      </div>
    </div>
    <div class="tb-pop" v-if="pop === 'cols'">
      <div class="tb-sliderwrap">
        <div class="tb-fill" :style="{ width: 'calc(10px + (100% - 20px) * ' + ((settings.cardsPerRow - 1) / 4) + ')' }"></div>
        <div class="tb-ticks"><i v-for="i in 5" :key="i"></i></div>
        <div class="tb-ball" :style="{ left: 'calc((100% - 20px) * ' + ((settings.cardsPerRow - 1) / 4) + ')' }"></div>
        <input type="range" min="1" max="5" :value="settings.cardsPerRow" @input="onColsV($event.target.value)" class="tb-slider" />
      </div>
    </div>
  </div>
</template>
