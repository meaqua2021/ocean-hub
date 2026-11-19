/* ocean-hub · 公共能力层（core/shared.js）
   只留进程 / 端口 / HTTP 工具，模板自带的 SnowLuma 登录与路径配置已摘除 ✓*/
const { exec, spawn } = require('child_process');
const net = require('net');

/* ── 进程/端口 ── */
/* 所有子进程一律隐藏控制台：中枢自己是没有控制台的后台进程，
   exec 不带 windowsHide 就会每调一次闪一个 cmd 黑窗（面板轮询全靠这几个查询）✓ */
const EXEC_OPT = { windowsHide: true, maxBuffer: 16 * 1024 * 1024 };
const sh = cmd => new Promise(res => exec(cmd, EXEC_OPT, (e, so, se) => res({ code: e ? e.code : 0, out: (so || '').toString('utf8'), err: (se || '').toString('utf8') })));
const portOpen = p => new Promise(res => { const s = net.connect(p, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true) }); s.on('error', () => res(false)); setTimeout(() => { try { s.destroy() } catch (e) {}; res(false) }, 1500); });
async function portPid(port) { const { out } = await sh('netstat -ano'); for (const line of out.split('\n')) { if (line.includes('LISTENING') && line.includes(':' + port + ' ')) { const t = line.trim().split(/\s+/); return t[t.length - 1]; } } return null; }
/* ── HTTP 工具 ── */
async function readBody(req) { const chunks = []; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString('utf8'); }

module.exports = { sh, spawn, portOpen, portPid, readBody };
