<script setup>
import { ref, watch } from 'vue';
import OhDialog from '../../components/OhDialog.vue';
import AppToolbar from '../../components/AppToolbar.vue';
import { svg } from '../../api/icons.js';
import { loadModSettings, saveModSettings, defaultSettings } from '../../api/settings.js';
import { loadModules } from '../../api/modules.js';
const props = defineProps({ module: Object });
const STATUSES = [
  { key: 'idle', label: '空闲', cls: 'idle' },
  { key: 'working', label: '工作中', cls: 'working' },
  { key: 'pending', label: '待决', cls: 'pending' },
  { key: 'done', label: '已完成', cls: 'done' }
];
const funcs = ref([]);
const showAdd = ref(false);
const cfg = ref(Object.assign(defaultSettings(), loadModSettings(props.module.key)));
function reloadAll() {
  try { funcs.value = JSON.parse(localStorage.getItem('oh_funcs_' + (props.module.key || 'x')) || '[]'); } catch (e) { funcs.value = []; }
  cfg.value = Object.assign(defaultSettings(), loadModSettings(props.module.key));
}
function saveFuncs() { localStorage.setItem('oh_funcs_' + (props.module.key || 'x'), JSON.stringify(funcs.value)); }
watch(() => props.module && props.module.key, () => reloadAll(), { immediate: true });
function setCfg(part) { try { if (part.cardShape) localStorage.setItem("oh_last_shape", part.cardShape) } catch (e) {} const apply = () => { cfg.value = Object.assign({}, cfg.value, part); saveModSettings(props.module.key, cfg.value); }; if (document.startViewTransition && part.cardsPerRow !== undefined) document.startViewTransition(apply); else apply(); }
function st(f) { return STATUSES.find(s => s.key === f.status) || STATUSES[0]; }
function addFunc(name) { if (funcs.value.length >= 9) return; funcs.value.push({ id: 'f' + Date.now(), name, status: 'idle' }); saveFuncs(); }
const showApplyAll = ref(false);
function onApplyAll() { showApplyAll.value = true }
const applyErr = ref('');
function onApplyAllConfirm(v, close) { if (v !== '000000') { applyErr.value = '密码错误'; return }
  const all = loadModules();
  for (const mm of all) { if (mm.key !== props.module.key) saveModSettings(mm.key, Object.assign(defaultSettings(), cfg.value)) }
  close();
}
</script>
<template>
  <div class="view mod-view" :class="['shape-' + cfg.cardShape, 'bg-' + cfg.bgMode]" :style="{ '--oh-cols': cfg.cardsPerRow, ...(cfg.bgMode === 'solid' && cfg.bgColor ? { background: cfg.bgColor } : {}) }">
    <div class="bg-layer" v-if="cfg.bgMode === 'flow'"><div class="bg-flow" :style="cfg.flowColor ? { backgroundImage: 'linear-gradient(120deg,' + cfg.flowColor + ' 0%,#151517 50%,' + cfg.flowColor + ' 100%)' } : {}"></div></div>
    <div class="view-head">
      <span class="view-ico"><span class="mono-badge" v-if="!module.ico">{{ (module.name[0] || '模').toUpperCase() }}</span><span v-else v-html="svg(module.ico)"></span></span>
      <span class="view-name">{{ module.name }}</span>
    </div>
    <div class="view-body">
      <div class="func-wrap" :class="{ nogrid: cfg.gridBg === false }">
        <div class="func-grid">
          <div class="func-card" v-for="f in funcs" :key="f.id" :class="st(f).cls" :style="{ viewTransitionName: 'vt-func-' + f.id }">
            <div class="func-name">{{ f.name }}</div>
            <div class="func-st"><span class="st-dot"></span>{{ st(f).label }}</div>
            <div class="func-desc">最近：一切正常</div>
          </div>
          <div class="func-add" v-if="funcs.length < 9" @click="showAdd = true">＋</div>
        </div>
      </div>
    </div>
    <AppToolbar :settings="cfg" :module-key="module.key" @change="setCfg" @apply-all="onApplyAll" />
    <OhDialog v-model="showApplyAll" title="应用到所有模块（高危）" placeholder="输入密码 000000 以应用" confirm-text="应用" :error="applyErr" danger @confirm="onApplyAllConfirm" />
    <OhDialog v-model="showAdd" title="新增功能" placeholder="功能名称" confirm-text="创建" @confirm="addFunc" />
  </div>
</template>
