/* 系统模块路由（模块清单/服务模块 CRUD 与启停/开机自启动）
   只保留前端真正调用到的接口 ✓*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const shared = require('../../core/shared');
const services = require('../../core/services');

const DATA = path.join(__dirname, '..', '..', '..', 'data');
const SEED = path.join(DATA, 'modules-seed.json');
const STARTUP_DIR = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');

function seedMods() { try { return JSON.parse(fs.readFileSync(SEED, 'utf8')) } catch (e) { return [] } }
function jres(res, obj) { res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); }
function remove(key) {
  const list = seedMods().filter(x => x.key !== key);
  try { fs.writeFileSync(SEED, JSON.stringify(list, null, 1)) } catch (e) { return { ok: false, error: e.message } }
  return { ok: true };
}

/* ── 开机自启动：不用 vbs，在「启动」文件夹建一个隐藏窗口的快捷方式指向 start.bat ✓ */
const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const STARTUP_ITEMS = [
  { key: 'hub', name: '主服务自启动', dst: 'ocean-hub.lnk', target: path.join(ROOT_DIR, 'start.bat'), workdir: ROOT_DIR }
];
/* 历史遗留的自启动文件名，读到一次就顺手清掉，免得和快捷方式重复拉起两份 */
const OLD_STARTUP_FILES = ['ocean-hub-service.vbs', 'OCEAN HUB.lnk'];
function psq(s) { return String(s).replace(/'/g, "''") }
/* WindowStyle=7 即隐藏窗口：开机时 cmd 不会闪黑框，靠 bat 自己把 node 静默拉起 */
function lnkScript(it) {
  const sc = "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('" + psq(path.join(STARTUP_DIR, it.dst)) + "');"
    + "$s.TargetPath='" + psq(it.target) + "';"
    + "$s.WorkingDirectory='" + psq(it.workdir) + "';"
    + "$s.WindowStyle=7;"
    + "$s.IconLocation='" + psq(path.join(ROOT_DIR, 'web', 'public', 'favicon.ico')) + ",0';"
    + "$s.Save()";
  const enc = Buffer.from(sc, 'utf16le').toString('base64');
  return shared.sh('powershell.exe -NoProfile -EncodedCommand ' + enc);
}
function cleanOldStartup() {
  let had = false;
  for (const n of OLD_STARTUP_FILES) { try { const f = path.join(STARTUP_DIR, n); if (fs.existsSync(f)) { fs.unlinkSync(f); had = true; } } catch (e) {} }
  return had;
}
async function startupList() {
  /* 改名/换路径前留下的旧启动项：清掉，并顺手按当前路径补建，别把用户已开的自启动弄丢 */
  const cleaned = cleanOldStartup();
  const items = [];
  for (const it of STARTUP_ITEMS) {
    let f = path.join(STARTUP_DIR, it.dst);
    if (cleaned && !fs.existsSync(f)) { try { await lnkScript(it); } catch (e) {} }
    items.push({ key: it.key, name: it.name, enabled: fs.existsSync(f) });
  }
  return items;
}

function match(url, method) {
  const p = url.split('?')[0];
  if (p === '/api/modules/list' && method === 'GET') return (req, res) => jres(res, { mods: seedMods() });
  if (p === '/api/modules/delete' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    jres(res, remove(q.key));
  };
  /* ── 服务模块：名称 + 本地路径 + 网页端口 ── */
  if (p === '/api/svc/list' && method === 'GET') return async (req, res) => {
    try { jres(res, { ok: true, mods: await services.listAll() }) } catch (e) { jres(res, { ok: false, error: e.message }) }
  };
  if (p === '/api/svc/create' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    jres(res, services.create(q));
  };
  if (p === '/api/svc/update' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    const k = q.key; delete q.key;
    jres(res, services.update(k, q));
  };
  if (p === '/api/svc/delete' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    jres(res, services.remove(q.key));
  };
  if (p === '/api/svc/start' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    try { jres(res, await services.start(q.key)) } catch (e) { jres(res, { ok: false, error: e.message }) }
  };
  if (p === '/api/svc/stop' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    try { jres(res, await services.stop(q.key)) } catch (e) { jres(res, { ok: false, error: e.message }) }
  };
  if (p === '/api/svc/status' && method === 'GET') return async (req, res) => {
    try { const j = await services.listAll(); const u = new URL(req.url, 'http://x'); const k = services.cleanKey(u.searchParams.get('key') || '');
      const one = j.find(x => x.key === k); jres(res, one ? { ok: true, running: one.running, open: one.open, starting: one.starting, pid: one.pid, openPorts: one.openPorts || [] } : { ok: false, error: 'unknown key' }) } catch (e) { jres(res, { ok: false, error: e.message }) }
  };
  if (p === '/api/svc/icon' && method === 'GET') return async (req, res) => {
    const u = new URL(req.url, 'http://x');
    let r = null;
    try { r = await services.iconFor(u.searchParams.get('key')) } catch (e) { r = null }
    if (!r || !r.file) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('no icon'); }
    try {
      const buf = fs.readFileSync(r.file);
      res.writeHead(200, { 'content-type': r.mime || 'application/octet-stream', 'cache-control': 'public, max-age=120' });
      res.end(buf);
    } catch (e) { res.writeHead(404); res.end('no icon'); }
  };
  if (p === '/api/svc/logs' && method === 'GET') return (req, res) => {
    const u = new URL(req.url, 'http://x');
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(services.logs(u.searchParams.get('key'), 16000));
  };
  if (p === '/api/startup/list' && method === 'GET') return async (req, res) => jres(res, { items: await startupList() });
  if (p === '/api/startup/toggle' && method === 'POST') return async (req, res) => {
    const b = await shared.readBody(req); let q = {}; try { q = JSON.parse(b || '{}') } catch (e) {}
    const it = STARTUP_ITEMS.find(x => x.key === q.key);
    if (!it) { jres(res, { ok: false, error: '未知启动项' }); return; }
    const f = path.join(STARTUP_DIR, it.dst);
    try {
      if (q.enabled) { await lnkScript(it); cleanOldStartup(); }
      else if (fs.existsSync(f)) fs.unlinkSync(f);
      jres(res, { ok: true, enabled: fs.existsSync(f) });
    } catch (e) { jres(res, { ok: false, error: e.message }); }
  };
  return null;
}
module.exports = { match, remove };
