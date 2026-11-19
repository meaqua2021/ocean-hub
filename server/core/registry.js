/* ocean-hub · 路由前缀表（core/registry.js）
   MAP：URL 前缀 → 模块；新模块在 MAP 加一行 + index.js 挂对应路由 ✓*/
const MAP = [
  ['/api/modules', 'system'],
  ['/api/svc', 'system'],
  ['/api/startup', 'system']
];

function moduleFor(p) { for (const [pre, mod] of MAP) { if (p === pre || p.startsWith(pre + '/')) return mod; } return null; }

module.exports = { MAP, moduleFor };
