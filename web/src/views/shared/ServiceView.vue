<script setup>
/* 服务模块视图：本地路径后台静默拉起 + 网页内嵌显示（启停开关在左侧选项卡上）
   下方「控制台」就是那个 cmd 窗口的内容，不弹窗，直接在这里看 */
import { ref, computed, watch, nextTick, inject, onMounted, onUnmounted } from 'vue';
import SvcFormDialog from '../../components/SvcFormDialog.vue';
import { toast } from '../../api/toast.js';
import { serviceState, serviceLogs, svcDisplayUrl, svcPorts, updateService } from '../../api/services.js';

const props = defineProps({ module: Object });
const ohRefreshMods = inject('ohRefreshMods', () => Promise.resolve());
const showEdit = ref(false);
const editErr = ref('');
const open = ref(false);      // 端口已监听 → 网页可内嵌
const starting = ref(false);  // 已拉起但端口还没起来
const pid = ref(null);
const log = ref('');
/* 控制台每次进来都默认收起，手动展开只在本次有效，不再记住 */
const showLog = ref(false);
function toggleLog() { showLog.value = !showLog.value; if (showLog.value) loadLog(); }
const logBox = ref(null);
const frameKey = ref(0);
const curPort = ref(0);   // 当前内嵌的端口，0=用主端口
const ports = computed(() => svcPorts(props.module || {}));
function pickPort(p) { curPort.value = p; frameKey.value++; }
watch(ports, list => { if (!list.includes(curPort.value)) curPort.value = list[0] || 0; }, { immediate: true });
let timer = null;

async function onSaveEdit(form, close) {
  editErr.value = '';
  const j = await updateService(Object.assign({ key: props.module.key }, form)).catch(e => ({ ok: false, error: e.message }));
  if (!j.ok) { editErr.value = j.error || '保存失败'; return; }
  close();
  await ohRefreshMods();
  frameKey.value++; log.value = '';
  toast('✅ 已保存，重新拨一下开关生效', 'ok');
}

const url = computed(() => svcDisplayUrl(props.module || {}, curPort.value));
async function refresh() {
  const j = await serviceState(props.module.key);
  if (j && j.ok) { open.value = !!j.open; starting.value = !!j.starting; pid.value = j.pid || null; if (props.module) props.module.openPorts = j.openPorts || []; }
}
async function loadLog(toBottom) {
  const t = await serviceLogs(props.module.key);
  if (t != null) log.value = t;
  if (toBottom !== false) await nextTick(() => { const el = logBox.value; if (el) el.scrollTop = el.scrollHeight; });
}
function reloadFrame() { frameKey.value++; toast('已刷新页面', 'ok'); }
/* 路径填错时的提示（比如文件不存在） */
const hint = computed(() => (props.module && props.module.resolveErr) || '');
watch(() => props.module && props.module.key, () => {
  log.value = '';
  showLog.value = false;
  open.value = !!(props.module && props.module.open);
  starting.value = !!(props.module && props.module.starting);
  refresh(); loadLog();
}, { immediate: true });
watch(open, (v, o) => { if (v !== o) { frameKey.value++; loadLog(); } });
onMounted(() => { timer = setInterval(() => { refresh(); if (showLog.value) loadLog(false); }, 5000) });
onUnmounted(() => clearInterval(timer));
</script>
<template>
  <div class="view">
    <div class="view-head">
      <span class="view-ico"><img v-if="module.iconUrl" :src="module.iconUrl" style="width:20px;height:20px;object-fit:contain;display:block" alt="" /><span class="mono-badge" v-else-if="!module.ico">{{ (module.name[0] || '模').toUpperCase() }}</span><svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;width:20px;height:20px"><path d="M4 7h16v10H4zM8 21h8M9 11l2 2 4-4"/></svg></span>
      <span class="view-name">{{ module.name }}</span>
      <span class="svc-chip" :class="{ on: open, ing: starting }">{{ open ? '运行中' : (starting ? '启动中' : '离线') }}<b v-if="pid"> · PID {{ pid }}</b></span>
      <span class="svc-portpick" v-if="ports.length"><button v-for="p in ports" :key="p" class="svc-portchip" :class="{ on: (curPort || ports[0]) === p, live: (module.openPorts||[]).includes(p) }" @click="pickPort(p)" :title="'内嵌端口 ' + p + ((module.openPorts||[]).includes(p) ? ' · 运行中' : ' · 未监听')">{{ p }}</button></span>
      <span style="flex:1"></span>
      <button class="qq-btn" @click="reloadFrame" :disabled="!open">↻ 刷新页面</button>
      <button class="qq-btn" @click="showEdit = true">✎ 编辑</button>
      <button class="qq-btn" :class="{ act: showLog }" @click="toggleLog">{{ showLog ? '收起控制台' : '控制台' }}</button>
    </div>
    <div class="view-body svc-body">
      <div class="svc-main">
        <iframe v-if="open" class="frame svc-frame" :key="frameKey" :src="url"></iframe>
        <div class="svc-off" v-else>
          <div class="svc-off-t" v-if="starting">{{ module.name }} 正在后台起来，端口 {{ module.port }} 还没监听</div>
          <div class="svc-off-t" v-else>{{ module.name }} 没在跑</div>
          <div class="svc-off-s">{{ starting ? '起来之后网页自动嵌进来，下面能看它的输出' : ('把左边选项卡上的开关拨开就后台静默拉起' + (module.port ? '（端口 ' + module.port + '）' : '')) }}</div>
          <div class="svc-off-s bad" v-if="hint">⚠ {{ hint }}</div>
        </div>
      </div>
      <div class="svc-cons" v-if="showLog">
        <div class="svc-cons-bar">
          <span>控制台 · 后台静默运行（不弹 cmd 窗口），这里就是它的输出</span>
          <span style="flex:1"></span>
          <button class="svc-mini" @click="loadLog()">↻ 刷新</button>
        </div>
        <pre class="svc-cons-body" ref="logBox">{{ log || '（暂无输出，拨开左边开关后台拉起后这里就有）' }}</pre>
      </div>
    </div>
    <SvcFormDialog v-model="showEdit" title="编辑模块" :data="module" :error="editErr" confirm-text="保存" @confirm="onSaveEdit" />
  </div>
</template>
<style scoped>
.svc-body{padding:0;display:flex;flex-direction:column}
.svc-main{flex:1;min-height:0;display:flex}
.svc-frame{flex:1;min-height:0;border:none;border-radius:0;background:#fff}
.svc-chip{margin-left:6px;padding:3px 11px;border-radius:9999px;border:1px solid var(--border);background:var(--panel2);color:var(--muted);font-size:11px;white-space:nowrap}
.svc-chip.on{color:#34d399;border-color:rgba(52,211,153,.4)}
.svc-chip.ing{color:#f59e0b;border-color:rgba(245,158,11,.45)}
.svc-chip b{font-weight:600}
.svc-addr{font-size:11px;color:var(--muted);font-family:Consolas,monospace;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.svc-portpick{display:inline-flex;gap:4px;margin-left:8px}
.svc-portchip{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:6px;color:var(--muted);font-family:Consolas,monospace;font-size:10.5px;padding:3px 8px;cursor:pointer;transition:all .15s}
.svc-portchip:hover{border-color:var(--accent)}
.svc-portchip.live{color:#34d399;border-color:rgba(52,211,153,.4)}
.svc-portchip.on{color:var(--fg);border-color:var(--accent);background:rgba(56,189,248,.16)}
.qq-btn{background:linear-gradient(135deg,rgba(255,255,255,.14) 0%,rgba(255,255,255,.055) 42%,rgba(255,255,255,.025) 100%),rgba(30,32,36,.55);border:1px solid rgba(255,255,255,.12);color:var(--fg);border-radius:9px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;backdrop-filter:blur(18px) saturate(1.4);box-shadow:inset 0 1px 0 rgba(255,255,255,.1);flex-shrink:0}
.qq-btn:hover:not(:disabled){border-color:rgba(255,255,255,.25)}
.qq-btn:disabled{opacity:.4;cursor:not-allowed}
.qq-btn.act{border-color:var(--accent);color:var(--accent)}
.svc-off{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--muted);padding:20px;text-align:center}
.svc-off-t{font-size:15px;font-weight:700;color:var(--fg)}
.svc-off-s{font-size:12px}
.svc-off-s.bad{color:#f59e0b}
/* 控制台 = 静默 cmd 的输出 */
.svc-cons{flex-shrink:0;height:34vh;min-height:130px;display:flex;flex-direction:column;border-top:1px solid var(--border);background:rgba(8,9,11,.75)}
.svc-cons-bar{display:flex;align-items:center;gap:10px;padding:6px 14px;font-size:11px;color:var(--muted);border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}
.svc-mini{background:none;border:1px solid var(--border);border-radius:6px;color:var(--muted);font-size:11px;padding:2px 10px;cursor:pointer;flex-shrink:0}
.svc-mini:hover{color:var(--fg);border-color:var(--accent)}
.svc-cons-body{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.15) transparent;flex:1;min-height:0;margin:0;padding:10px 14px;font-family:Consolas,'Courier New',monospace;font-size:11.5px;line-height:1.55;color:#c7d0d9;white-space:pre-wrap;word-break:break-all;overflow:auto}
</style>
