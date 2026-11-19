/* 单色线性图标库（统一视觉 ✓）*/
const P = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  ai: 'M9 3h6v2H9zM3 9h2v6H3zM19 9h2v6h-2zM5 5h14v14H5zM9 9h6v6H9z',
  soul: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z',
  mem: 'M12 3c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3zM3 6v12c0 1.66 4.03 3 9 3s9-1.34 9-3V6',
  video: 'M3 5h18v14H3zM7 5v14M17 5v14M7 10h10M7 14h10',
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  qq: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  gitee: 'M6 3v12M6 15a3 3 0 1 0 .01 0M18 6a3 3 0 1 0-.01 0M6 18c6 0 9-3.5 12-9',
  stats: 'M3 3v18h18M7 15v-5M12 15V7M17 15v-3',
  svc: 'M4 7h16v10H4zM8 21h8M9 11l2 2 4-4'
};
export function svg(n) {
  const d = P[n] || P.grid;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px"><path d="' + d + '"/></svg>';
}
