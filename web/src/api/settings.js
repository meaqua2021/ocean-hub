/* 模块级设置：每个模块独立配置（形状/背景/每行数量），localStorage 按模块键存储 */
const LS = k => 'oh_mod_settings_' + k;
export function defaultSettings() { return { cardShape: 'square', bgMode: 'solid', cardsPerRow: 3, gridBg: true, bgColor: '', flowColor: '' }; }
export function loadModSettings(key) {
  try { return Object.assign(defaultSettings(), JSON.parse(localStorage.getItem(LS(key)) || '{}')); } catch (e) { return defaultSettings(); }
}
export function saveModSettings(key, s) { try { localStorage.setItem(LS(key), JSON.stringify(s)); } catch (e) { console.warn('设置保存失败（存储空间不足），请删除部分自定义背景后重试', e) } }
