<script setup>
import { ref, computed, watch, provide, onMounted, onUnmounted } from 'vue';
import AppSidebar from './components/AppSidebar.vue';
import OhDialog from './components/OhDialog.vue';
import Overview from './views/overview/Overview.vue';
import Placeholder from './views/shared/Placeholder.vue';
import ToastHost from './components/ToastHost.vue';
import ModuleView from './views/shared/ModuleView.vue';
import ServiceView from './views/shared/ServiceView.vue';
import SvcFormDialog from './components/SvcFormDialog.vue';
import { loadModules, removeModuleEntry, saveSidebarOrder, applySidebarOrder } from './api/modules.js';
import { listServices, createService, deleteService, startService, stopService, toModule } from './api/services.js';
import { toast } from './api/toast.js';

const compMap = { overview: Overview };
const cardMods = ref(loadModules());
const svcMods = ref([]);
const mods = computed(() => applySidebarOrder([...cardMods.value, ...svcMods.value]));
const savedKey = (() => { try { return localStorage.getItem('oh_active') || '' } catch (e) { return '' } })();
const pathMod = ((location.pathname.match(/^\/([^/]+)/) || [])[1]) || "";
function keyExists(k) { try { return JSON.parse(localStorage.getItem('oh_user_modules') || '[]').some(m => m && m.key === k) } catch (e) { return false } }
const active = ref(cardMods.value.some(x => x.key === pathMod) ? pathMod : (cardMods.value.some(x => x.key === savedKey) || keyExists(savedKey) ? savedKey : (cardMods.value[0] ? cardMods.value[0].key : 'overview')));
/* 服务模块要等接口回来才在清单里：首轮校正优先级 路径 > 上次停留 > 第一个 */
let booted = false;
function normalizeActive() {
  const list = mods.value;
  if (!list.length) return;
  if (!booted) {
    booted = true;
    if (pathMod && list.some(x => x.key === pathMod)) { active.value = pathMod; return; }
    if (savedKey && list.some(x => x.key === savedKey)) { active.value = savedKey; return; }
  }
  if (list.some(x => x.key === active.value)) return;
  const a = list.find(x => x.key === savedKey) || list.find(x => keyExists(savedKey)) || list[0];
  if (a) active.value = a.key;
}
watch(mods, normalizeActive);
/* 停留位置持久化：切模块就写本地 + 同步地址栏路径，刷新/重进都能回到原来那页 */
function persistActive(k) {
  try { if (k) localStorage.setItem('oh_active', k) } catch (e) {}
  const want = k && k !== 'overview' ? '/' + k : '/';
  try { if (location.pathname !== want) history.replaceState(null, '', want) } catch (e) {}
}
watch(active, persistActive, { immediate: true });
function onPopState() {
  const k = ((location.pathname.match(/^\/([^/]+)/) || [])[1]) || '';
  if (k && mods.value.some(x => x.key === k)) active.value = k;
  else if (!k) active.value = 'overview';
}
window.addEventListener('popstate', onPopState);
const showAdd = ref(false);
const addErr = ref('');
const navParam = ref(null);
function ohNav(moduleKey, param) { const from = active.value; active.value = moduleKey; navParam.value = { module: moduleKey, param: param || null, from: from, t: Date.now() }; try { if (from !== moduleKey) sessionStorage.setItem('oh_nav_from', from) } catch (e) {} }
provide('ohNav', ohNav);
provide('ohRefreshMods', refreshAll);
/* 侧栏那一份排好序的模块清单，总览直接复用，避免两边顺序/图标各算各的 */
provide('ohMods', mods);
provide('ohActive', active);
let svcTimer = null;

/* 侧栏数据来源：localStorage 的卡片模块 + 服务端的服务模块 */
function syncCards() { cardMods.value = loadModules(); }
async function refreshServices() { svcMods.value = (await listServices()).map(toModule); }
async function refreshAll() { syncCards(); try { await refreshServices() } catch (e) {} }

async function onAddSvc(form, close) {
  addErr.value = '';
  const j = await createService(form).catch(e => ({ ok: false, error: e.message }));
  if (!j.ok) { addErr.value = j.error || '创建失败'; return; }
  await refreshServices();
  active.value = j.mod.key;
  close();
  toast('✅ 模块已创建：' + j.mod.name, 'ok');
}
/* 侧栏开关：拨一下直接拉起 / 停掉，服务状态由 15 秒轮询 + 这里的手动刷新兜住 */
const svcBusy = ref('');
async function onToggleSvc(key) {
  const m = svcMods.value.find(x => x.key === key);
  if (!m) return;
  if (svcBusy.value) return;
  svcBusy.value = key;
  const j = await (m.running ? stopService(key) : startService(key)).catch(e => ({ ok: false, error: e.message }));
  if (m.running) {
    toast(j.ok ? ('✅ 已停止：' + m.name) : (j.notRunning ? m.name + ' 本来就没在跑' : ('停止失败：' + (j.error || ''))), j.ok || j.notRunning ? 'ok' : 'bad');
  } else if (j.ok) {
    toast('✅ 已后台拉起：' + m.name + (j.running ? '（端口已监听）' : '（服务还在初始化，控制台里有输出）'), 'ok');
  } else if (j.starting || j.running) {
    toast(m.name + ' 已经在后台启动了，再等会儿', 'ok');
  } else if (j.exited) {
    toast('⚠ ' + (j.error || '拉起来就退出了'), 'bad');
  } else {
    toast('启动失败：' + (j.error || ''), 'bad');
  }
  await refreshServices().catch(() => {});
  setTimeout(() => { svcBusy.value = ''; refreshServices().catch(() => {}) }, 2000);
}
onMounted(async () => {
  await refreshAll();
  if (!mods.value.some(x => x.key === active.value)) active.value = mods.value[0] ? mods.value[0].key : 'overview';
  svcTimer = setInterval(() => { refreshServices().catch(() => {}) }, 15000);
});
onUnmounted(() => { clearInterval(svcTimer); window.removeEventListener('popstate', onPopState) });
// 种子模块合并（服务端清单为准 ✓）
onMounted(async () => {
  try {
    const j = await (await fetch("/api/modules/list")).json(); let ch = false;
    for (const sm of (j.mods || [])) { if (!sm.key || mods.value.some(x => x.key === sm.key)) continue; cardMods.value.push(Object.assign({ user: true, seed: true }, sm)); ch = true }
    for (const sm of (j.mods || [])) { const fk = "oh_funcs_" + sm.key; if (sm.funcs && sm.funcs.length && (sm.seed || !localStorage.getItem(fk))) { localStorage.setItem(fk, JSON.stringify(sm.funcs.map((n2, ix) => ({ id: "f" + Date.now() + ix, name: n2, status: "idle" })))) } }
    if (ch) { localStorage.setItem("oh_user_modules", JSON.stringify(cardMods.value.filter(m => m.user || m.seed))) }
  } catch (e) {}
});
const delPending = ref('');
const delName = ref('');
const delIsSvc = ref(false);
const showConfirm = ref(false);
function onDel(key) {
  delPending.value = key;
  const m = mods.value.find(x => x.key === key);
  delName.value = m ? m.name : '';
  delIsSvc.value = !!(m && m.kind === 'svc');
  showConfirm.value = true;
}
async function onDelConfirm(v, close) {
  const key = delPending.value;
  const m = mods.value.find(x => x.key === key);
  if (delIsSvc.value) {
    const j = await deleteService(key).catch(e => ({ ok: false, error: e.message }));
    if (!j.ok) { toast('删除失败：' + (j.error || ''), 'bad'); close(); return; }
    await refreshServices();
  } else {
    removeModuleEntry(key); syncCards();
    if (m && m.seed) { try { await fetch('/api/modules/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) }) } catch (e) {} }
  }
  if (active.value === key) active.value = mods.value[0] ? mods.value[0].key : 'overview';
  close();
}
// 拖动排序：按侧栏传回的新顺序重排模块并持久化 ✓
function onReorder(p) {
  const order = p.keys || [];
  if (!order.length) return;
  const sorted = [...mods.value].sort((a, b) => { const ia = order.indexOf(a.key); const ib = order.indexOf(b.key); return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib) });
  cardMods.value = sorted.filter(m => m.kind !== 'svc');
  svcMods.value = sorted.filter(m => m.kind === 'svc');
  saveSidebarOrder(order);
}
/* 服务内嵌页要常驻：所有模块视图一次性挂进 DOM，切换只用 v-show。
   KeepAlive 切走会把组件 DOM 搬进隐藏容器，iframe 跟着被移动就会重新加载 */
function viewFor(m) {
  return m.kind === 'svc' ? ServiceView : (compMap[m.key] || (m.user ? ModuleView : Placeholder));
}
</script>
<template>
  <ToastHost />
  <div class="shell">
    <AppSidebar :menus="mods" v-model:active="active" :svc-busy="svcBusy" @add="showAdd = true" @del="onDel" @reorder="onReorder" @toggle="onToggleSvc" />
    <template v-for="m in mods" :key="m.key">
      <component v-show="active === m.key" :is="viewFor(m)" :module="m" :nav-param="navParam" />
    </template>
  </div>
  <SvcFormDialog v-model="showAdd" :error="addErr" confirm-text="创建" @confirm="onAddSvc" />
  <OhDialog v-model="showConfirm" title="删除模块" :message="delIsSvc ? ('删除服务模块「' + delName + '」？只删除登记信息，不会动本地文件和进程。') : ('删除「' + delName + '」？该模块的本地数据会一并清除。')" :confirm-text="delIsSvc ? '删除' : '删除'" danger @confirm="onDelConfirm" />
</template>

