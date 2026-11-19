<script setup>
/* 总览：模块状态（顺序/图标完全复用侧栏那一份清单），自启动管理已搬到侧栏小按钮 */
import { ref, computed, inject } from 'vue';
import { svg } from '../../api/icons.js';

/* 侧栏 → 总览：同一份已排序模块，避免两边各算一套 */
const sidebarMods = inject('ohMods', ref([]));
const ohNav = inject('ohNav', null);
const activeKey = inject('ohActive', ref(''));
const mods = computed(() => (sidebarMods.value || []).filter(m => !m.hidden && m.key !== 'overview'));

/* 图标规则与侧栏严格一致：自定义图标 → 内置 svg → 名称首字母 */
function iconOf(m) { return m && m.iconUrl ? 'img' : ((m && m.ico) ? 'svg' : 'letter'); }
/* 快速导航：点卡片跳到侧栏对应模块 */
function go(m) { if (ohNav) ohNav(m.key); }
function isOn(m) { return activeKey.value === m.key; }
</script>
<template>
  <div class="view">
    <!-- 头部栏与模块页同一套 view-head：60px + 底部分隔线，顶边完全对齐 -->
    <div class="view-head">
      <span class="view-ico" v-html="svg('grid')"></span>
      <span class="view-name">总览</span>
      <span class="nav-hint">点模块卡片可直接跳转</span>
    </div>
    <div class="view-body">
      <div class="cards">
        <div class="mcard" v-for="m in mods" :key="m.key" :class="{ on: isOn(m) }" @click="go(m)" :title="'跳转到 ' + m.name">
          <div class="mico">
            <img v-if="iconOf(m) === 'img'" class="mico-img" :src="m.iconUrl" alt="" />
            <span v-else-if="iconOf(m) === 'svg'" v-html="svg(m.ico)"></span>
            <span v-else class="mono-badge">{{ (m.name[0] || '模').toUpperCase() }}</span>
          </div>
          <div class="mtxt">
            <div class="mname">{{ m.name }}</div>
            <div class="mdesc" v-if="m.kind === 'svc'">{{ m.port ? ('端口 ' + m.port) : '未填端口' }}</div>
            <div class="mpid" v-if="m.kind === 'svc' && m.pid">PID {{ m.pid }}</div>
            <div class="mdesc" v-else>本地模块</div>
          </div>
          <div class="state" v-if="m.kind === 'svc'"><span class="dot" :class="m.running ? 'on' : 'off'"></span>{{ m.open ? '运行中' : (m.starting ? '启动中' : '离线') }}</div>
          <div class="state" v-else><span class="dot on"></span>内置</div>
          <span class="jump">›</span>
        </div>
        <div class="mdesc" v-if="!mods.length" style="padding:6px 2px">还没有模块，点左侧「+」添加一个（名称 + 本地路径 + 端口）</div>
      </div>
    </div>
  </div>
</template>
<style scoped>
/* 卡片列表交给 view-body 统一滚动，避免两层滚动条吃掉间距 */
.cards{flex:none;overflow:visible}
.nav-hint{font-size:11px;color:var(--muted);margin-left:6px}
.mcard{cursor:pointer;transition:transform .15s,border-color .15s,background .15s}
.mcard:hover{transform:translateY(-2px);border-color:var(--accent)}
.mcard.on{border-color:var(--accent);background:rgba(56,189,248,.08)}
/* 卡片高度锁定 + 内容垂直居中，运行/停止切换时不再整体上跳 */
.mcard{min-height:82px;align-content:center}
.mtxt{flex:1 1 120px}
.mpid{font-size:11px;line-height:1.2;color:var(--muted);opacity:.82;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:.2px}
.mico-img{width:26px;height:26px;object-fit:contain;display:block;border-radius:5px}
.jump{font-size:18px;color:var(--muted);opacity:0;transition:opacity .15s;margin-left:2px}
.mcard:hover .jump{opacity:.85}
</style>
