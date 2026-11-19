<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue';
import { svg } from '../api/icons.js';
import { toast } from '../api/toast.js';
const props = defineProps({ menus: Array, active: String, svcBusy: String });
const visibleMenus = computed(() => (props.menus || []).filter(m => !m.hidden));
const emit = defineEmits(['update:active', 'add', 'del', 'reorder', 'toggle']);
const mini = ref(false);
// ---------- 开机自启动（从总览搬来，侧栏小按钮展开）----------
const suOpen = ref(false);
const suItems = ref([]);
const refreshMods = inject('ohRefreshMods', null);
async function loadSu() { try { const j = await (await fetch('/api/startup/list')).json(); suItems.value = j.items || [] } catch (e) {} }
function toggleSuPanel() { suOpen.value = !suOpen.value; if (suOpen.value) loadSu(); }
async function toggleSu(it) {
  try {
    const r = await fetch('/api/startup/toggle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: it.key, enabled: !it.enabled }) });
    const j = await r.json();
    toast(j.ok ? ('✅ ' + it.name + (j.enabled ? ' 已开启开机自启动' : ' 已关闭开机自启动')) : ('失败: ' + (j.error || '')), j.ok ? 'ok' : 'bad');
    loadSu();
    if (refreshMods) refreshMods();
  } catch (e) { toast('操作失败: ' + e.message, 'bad') }
}
function onDocClick(e) { if (!e.target.closest('.side')) { suOpen.value = false; return } }
// ---------- 模块排序模式（底部按钮开启 → 按住拖动换位 → 完成后保存 ✓）----------
const sortMode = ref(false);
let sortDrag = '';
function toggleSort() {
  sortMode.value = !sortMode.value;
  emit('reorder', { keys: visibleMenus.value.map(m => m.key), save: true });
}
function sortDown(m, e) { if (!sortMode.value) return; e.preventDefault(); sortDrag = m.key; }
function sortMove(e) {
  if (!sortDrag) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const nav = el && el.closest('.navitem');
  if (!nav) return;
  const overK = nav.getAttribute('data-key');
  if (!overK || overK === sortDrag) return;
  /* 按鼠标落在目标项的上半 / 下半决定插前还是插后，否则拖到后一项时会被算回原位 */
  const rect = nav.getBoundingClientRect();
  const after = e.clientY > rect.top + rect.height / 2;
  const keys = visibleMenus.value.map(m => m.key).filter(k => k !== sortDrag);
  const ti = keys.indexOf(overK); if (ti < 0) return;
  keys.splice(after ? ti + 1 : ti, 0, sortDrag);
  emit('reorder', { keys, save: false });
}
function sortUp() { sortDrag = ''; }
function onDocMove(e) { sortMove(e) }
function onDocUp() { sortDrag = '' }
function pick(k) { emit('update:active', k); }
function toggle(m) { emit('toggle', m.key); }
function add() { emit('add'); }
function del(m) { emit('del', m.key); }
onMounted(() => { document.addEventListener('click', onDocClick); document.addEventListener('mousemove', onDocMove); document.addEventListener('mouseup', onDocUp); });
onUnmounted(() => { document.removeEventListener('click', onDocClick); document.removeEventListener('mousemove', onDocMove); document.removeEventListener('mouseup', onDocUp); });
</script>
<template>
  <div class="side" :class="{ mini, sorting: sortMode }">
    <div class="brand">
      <div class="logo" :title="mini ? '打开侧栏' : ''" @click="mini = false">
        <img class="logo-img whale" src="/favicon.png" alt="ocean-hub" />
        <svg class="expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:18px;height:18px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
      </div>
      <div class="bt">ocean-hub</div>
      <div class="toggle-wrap" v-if="!mini" @click.stop="mini = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="width:16px;height:16px;cursor:pointer"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        <span class="tip">收起侧栏</span>
      </div>
    </div>
    <div class="oh-nav">
      <div class="navitem" v-for="m in visibleMenus" :key="m.key" :data-key="m.key" :class="{ active: active === m.key, sortDrag: sortDrag === m.key, 'is-svc': m.kind === 'svc' }" @mousedown="sortDown(m, $event)" @click="pick(m.key)">
        <span class="nico" v-if="m.iconUrl"><img class="nico-img" :src="m.iconUrl" alt="" /></span><span class="nico" v-else-if="m.ico" v-html="svg(m.ico)"></span><span class="nico mono-badge" v-else>{{ (m.name[0] || '模').toUpperCase() }}</span><span class="nlabel">{{ m.name }}</span><span class="nav-del" v-if="m.user" title="删除模块" @click.stop="del(m)">×</span><span class="nav-port2" v-if="m.kind === 'svc'" :title="'端口 ' + m.port">{{ m.port }}</span><span class="nav-sw" v-if="m.kind === 'svc'" :class="{ on: m.running, starting: m.starting, busy: svcBusy === m.key }" :title="m.running ? ('点击停止 · 端口 ' + m.port) : ('点击后台拉起 · ' + (m.path || '未填路径'))" @click.stop="toggle(m)"><i></i></span><span class="tip">{{ m.name }}{{ m.kind === 'svc' ? (' · ' + (svcBusy === m.key ? '切换中…' : (m.starting ? '启动中（后台）' : (m.running ? ('运行中 · 端口 ' + m.port) : '已停止')))) : '' }}</span>
      </div>
      <div class="oh-add" v-if="!mini && !sortMode" title="新增模块" @click="add">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" style="width:18px;height:18px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
    </div>
    <!-- 左下角一排纯图标小按钮，面板向上弹出 -->
    <div class="side-bottom">
      <div class="su-list" v-if="suOpen">
        <div class="su-row" v-for="it in suItems" :key="it.key">
          <span class="su-name">{{ it.name }}</span>
          <span class="su-sw" :class="{ on: it.enabled }" :title="it.enabled ? '点击关闭开机自启动' : '点击开启开机自启动'" @click="toggleSu(it)"><i></i></span>
        </div>
        <div class="su-empty" v-if="!suItems.length">暂无可配置项</div>
        <div class="su-note">开启后 Windows 登录时自动在后台拉起对应服务</div>
      </div>
      <div class="side-tools">
        <div class="sbtn" :class="{ on: sortMode }" :title="sortMode ? '完成排序' : '模块排序'" @click="toggleSort">
          <svg v-if="!sortMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M7 20l-3-3M17 20V4M17 4l3 3"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 7"/></svg>
        </div>
        <div class="sbtn" :class="{ on: suOpen }" title="开机自启动" @click="toggleSuPanel">⚡</div>
      </div>
    </div>
  </div>
</template>
<style scoped>
/* 左下角：一排无文字小按钮，面板向上弹出 */
.side-bottom{flex-shrink:0;margin-top:auto;border-top:1px solid var(--border);padding:8px 10px 10px;background:rgba(0,0,0,.18)}
.side-tools{display:flex;gap:6px}
.side.mini .side-bottom{padding:8px 6px 10px}
.sbtn{width:34px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;line-height:1;color:var(--muted);border:1px solid var(--border);border-radius:8px;cursor:pointer;background:rgba(255,255,255,.03);transition:all .15s}
.sbtn svg{width:15px;height:15px;display:block}
.sbtn:hover{color:var(--fg);border-color:var(--accent)}
.sbtn.on{color:var(--fg);border-color:var(--accent);background:rgba(56,189,248,.14)}
.side.mini .side-tools{flex-direction:column;gap:5px}
.side.mini .sbtn{width:100%}
.su-list{margin:0 0 8px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.04)}
.su-row{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px dashed rgba(255,255,255,.08)}
.su-row:last-of-type{border-bottom:none}
.su-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.su-sw{position:relative;width:30px;height:17px;border-radius:9999px;background:rgba(255,255,255,.14);border:1px solid var(--border);cursor:pointer;flex-shrink:0;transition:background .18s,border-color .18s}
.su-sw i{position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:50%;background:var(--muted);transition:transform .18s,background .18s}
.su-sw.on{background:rgba(52,211,153,.28);border-color:rgba(52,211,153,.5)}
.su-sw.on i{transform:translateX(13px);background:#34d399}
.su-empty{font-size:11px;color:var(--muted);padding:4px 0}
.su-note{font-size:10.5px;color:var(--muted);margin-top:6px;line-height:1.5}
/* 品牌图标：直接用 public 里的网页图标 */
.logo .logo-img{width:100%;height:100%;object-fit:cover;border-radius:10px;display:block}
/* 收起态：开机自启动面板只留开关，不留名称与说明文字 */
.side.mini .su-name,.side.mini .su-note,.side.mini .su-empty{display:none}
.side.mini .su-list{padding:6px 4px}
.side.mini .su-row{justify-content:center;gap:0;padding:5px 0;border-bottom:none}
/* 选项卡上的服务启停开关 */
.nav-sw{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:32px;height:18px;border-radius:9999px;background:rgba(255,255,255,.14);border:1px solid var(--border);cursor:pointer;transition:background .18s,border-color .18s}
.nico-img{width:26px;height:26px;object-fit:contain;display:block;border-radius:6px}
.navitem .nlabel{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.nav-sw i{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--muted);transition:transform .18s,background .18s}
.nav-sw.on{background:rgba(52,211,153,.28);border-color:rgba(52,211,153,.5)}
.nav-sw.on i{transform:translateX(14px);background:#34d399}
.nav-sw:hover{border-color:var(--accent)}
.nav-sw.busy{opacity:.5;pointer-events:none}
.nav-sw.busy i{animation:swpulse 1s infinite}
.nav-sw.starting i{animation:swpulse 1.2s infinite}
.nav-sw.starting{background:rgba(245,158,11,.26);border-color:rgba(245,158,11,.5)}
.nav-sw.starting i{transform:translateX(14px);background:#f59e0b}
@keyframes swpulse{50%{opacity:.35}}
.nav-port2{margin-left:auto;padding-left:6px;flex-shrink:0;font-size:10px;color:var(--muted);font-family:Consolas,monospace;opacity:.6;transition:opacity .15s}
.navitem:hover .nav-port2{opacity:0}
.navitem.is-svc{padding-right:46px}
.navitem.is-svc .nlabel{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.navitem.is-svc .nav-del{margin-left:0}
.side.mini .nav-port2{display:none}
.side.mini .nav-sw{display:none}
/* 收起态：服务模块那 46px 的右侧预留（给开关和端口）要一起清掉，否则图标整体左偏 */
.side.mini .navitem.is-svc{padding-right:0;justify-content:center}
.side.sorting .nav-sw{pointer-events:none;opacity:.4}
</style>
