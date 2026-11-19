/* 模块注册表：内置模块 + 用户自建模块（localStorage 持久化）*/
const DEFAULTS = [
  { key: 'overview', ico: 'grid', name: '总览' }
];
const LS = 'oh_user_modules';
const ICON_RULES = [
  [/数据|中台|统计|报表|分析/i, 'stats'],
  [/qq|聊天|chat|消息/i, 'qq'],
  [/记忆|mem|笔记|知识/i, 'mem'],
  [/视频|video|抖音|媒体|直播/i, 'video'],
  [/灵魂|soul|人格/i, 'soul'],
  [/备份|gitee|git|同步|仓库/i, 'gitee'],
  [/ai|助手|智能|模型/i, 'ai'],
  [/天气|weather|气候/i, 'soul'],
  [/日程|任务|todo|清单/i, 'grid']
];
export function autoIcon(name) {
  for (const [re, ico] of ICON_RULES) if (re.test(name)) return ico;
  return '';
}
const ORDER_LS = 'oh_sidebar_order';
export function applySidebarOrder(list) {
  try {
    const order = JSON.parse(localStorage.getItem(ORDER_LS) || '[]');
    if (!Array.isArray(order) || !order.length) return list;
    return [...list].sort((a, b) => {
      const ia = order.indexOf(a.key); const ib = order.indexOf(b.key);
      return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib);
    });
  } catch (e) { return list }
}
export function saveSidebarOrder(keys) { try { localStorage.setItem(ORDER_LS, JSON.stringify(keys)) } catch (e) {} }
export function loadModules() {
  let user = [];
  try { user = JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) {}
  const merged = [...DEFAULTS, ...user.filter(m => m && m.key && m.name).map(m => (!m.ico) ? Object.assign({}, m, { ico: autoIcon(m.name), mono: !autoIcon(m.name) }) : m)];
  return applySidebarOrder(merged);
}
/* 删除模块：直接移除登记，连同该模块的本地功能清单与设置 */
export function removeModuleEntry(key) {
  const cur = JSON.parse(localStorage.getItem(LS) || '[]').filter(m => m.key !== key);
  localStorage.setItem(LS, JSON.stringify(cur));
  try { localStorage.removeItem('oh_funcs_' + key); localStorage.removeItem('oh_mod_settings_' + key); } catch (e) {}
}
