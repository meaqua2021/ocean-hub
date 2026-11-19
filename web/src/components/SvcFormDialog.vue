<script setup>
/* 新增/编辑服务模块弹窗：名称 + 本地路径 + 网页端口 */
import { ref, watch } from 'vue';
const props = defineProps({ modelValue: Boolean, title: { type: String, default: '新增模块' }, error: String, data: Object, confirmText: { type: String, default: '创建' } });
const emit = defineEmits(['update:modelValue', 'confirm']);
const f = ref({ name: '', port: '', path: '', icon: '' });
watch(() => props.modelValue, v => {
  if (!v) return;
  const d = props.data || {};
  f.value = { name: d.name || '', port: d.port ? String(d.port) : '', path: d.path || '', icon: d.icon || '' };
});
function ok() {
  const name = f.value.name.trim();
  if (!name) return;
  emit('confirm', { name, port: f.value.port.trim(), path: f.value.path.trim(), icon: f.value.icon.trim() }, () => emit('update:modelValue', false));
}
</script>
<template>
  <Teleport to="body">
    <div v-if="modelValue" class="oh-dlg-mask" @click.self="emit('update:modelValue', false)">
      <div class="oh-dlg">
        <div class="oh-dlg-title">{{ title }}</div>
        <label class="svc-f"><span>模块名称<i>*</i></span><input class="oh-dlg-input" v-model="f.name" placeholder="例如：ComfyUI / 某个网页服务" @keyup.enter="ok" /></label>
          <label class="svc-f"><span>本地路径<i>*</i></span><input class="oh-dlg-input" v-model="f.path" placeholder="要拉起的东西：C:\work\comfyui-rocm\comfyui-user.bat，填文件夹 / exe / py 也行" @keyup.enter="ok" /></label>
          <label class="svc-f"><span>网页端口<i>*</i></span><input class="oh-dlg-input" v-model="f.port" inputmode="numeric" placeholder="8188" @keyup.enter="ok" /></label>
          <label class="svc-f"><span>图标路径（可选）</span>
            <div class="svc-icon-row">
              <input class="oh-dlg-input" v-model="f.icon" placeholder="图片路径，或直接填程序 exe / 快捷方式 lnk 抽它的图标" @keyup.enter="ok" />
              <img v-if="f.icon && data && data.key" class="svc-icon-pv" :src="'/api/svc/icon?key=' + encodeURIComponent(data.key) + '&v=' + Date.now()" alt="" />
            </div>
          </label>
          <div class="svc-tip">开关一拨就按路径后台静默拉起，不弹 cmd 窗口，控制台输出在这个模块的「日志」里看。端口用来判断在不在运行，并把它的网页直接内嵌进来。图标留空就是默认那个方块电脑图标。</div>
        <div class="oh-dlg-err" v-if="error">{{ error }}</div>
        <div class="oh-dlg-btns">
          <button class="oh-btn ghost" @click="emit('update:modelValue', false)">取消</button>
          <button class="oh-btn primary" @click="ok">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.oh-dlg{width:440px}
.svc-f{display:block;margin-bottom:10px}
.svc-f span{display:block;font-size:11.5px;color:var(--muted);margin-bottom:5px}
.svc-f span i{color:var(--bad);font-style:normal;margin-left:3px}
.svc-icon-row{display:flex;align-items:center;gap:8px}
.svc-icon-pv{width:26px;height:26px;object-fit:contain;border-radius:6px;flex-shrink:0;background:var(--panel2)}
.svc-tip{font-size:11px;color:var(--muted);margin:2px 0 12px;line-height:1.5}
</style>
