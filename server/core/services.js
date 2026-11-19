/* ocean-hub · 服务模块层（core/services.js）
   一个服务模块 = 名称 + 本地路径 + 网页端口
   本地路径直接填要拉起的东西（exe / bat / cmd / ps1 / py / js / jar / lnk，也可以直接填它所在的文件夹）
   没有单独的启动命令：路径是什么就拉起什么
   启动一律后台静默（不弹 cmd 窗口），它的 stdout/stderr 写 data/logs/svc-<key>.log，面板上的「日志」就是这块屏 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const shared = require('./shared');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'data');
const STORE = path.join(DATA, 'services.json');
const LOGDIR = path.join(DATA, 'logs');

function load() {
  let list = [];
  try { const j = JSON.parse(fs.readFileSync(STORE, 'utf8')); list = Array.isArray(j) ? j : [] } catch (e) { return [] }
  /* 老记录（本地目录 + 启动命令）自动折算成一个本地路径 */
  let dirty = false;
  for (const s of list) {
    if (!s.path && (s.cmd || s.dir)) {
      const cmd = String(s.cmd || '').trim();
      const dir = String(s.dir || '').trim();
      if (cmd && /^[A-Za-z]:[\\/]/.test(cmd)) s.path = cmd;
      else if (cmd && dir) s.path = path.join(dir, cmd.replace(/^["']+|["']+$/g, ''));
      else s.path = cmd || dir;
      delete s.cmd; delete s.dir; dirty = true;
    }
  }
  /* 老记录 key 是 svc-时间戳：能按名称起名的都换成名称，地址栏直接显示模块名 */
  for (const s of list) {
    if (/^svc-\d+$/.test(String(s.key || ''))) {
      const nk = cleanKey(s.name);
      if (nk && !list.some(x => x !== s && x.key === nk)) { s.key = nk; dirty = true }
    }
  }
  if (dirty) save(list);
  return list;
}
function save(list) { try { fs.mkdirSync(path.dirname(STORE), { recursive: true }); fs.writeFileSync(STORE, JSON.stringify(list, null, 1)); return { ok: true } } catch (e) { return { ok: false, error: e.message } } }

function cleanKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) }
function logFile(key) { const k = cleanKey(key); return path.join(LOGDIR, (k.indexOf('svc-') === 0 ? k : 'svc-' + k) + '.log') }
/* 主日志被残留进程占用时退到 alt 日志，读的时候取更新的那个 */
function altLogFile(key) { return logFile(key) + '.1.log' }
function currentLogFile(key) {
  const a = logFile(key), b = altLogFile(key);
  let ta = 0, tb = 0;
  try { ta = fs.statSync(a).mtimeMs } catch (e) {}
  try { tb = fs.statSync(b).mtimeMs } catch (e) {}
  if (!ta && !tb) return a;
  return tb > ta ? b : a;
}
function openLog(key) {
  for (const [f, flag] of [[logFile(key), 'a'], [altLogFile(key), 'w']]) {
    try { return { fd: fs.openSync(f, flag), file: f } } catch (e) {}
  }
  return { fd: null, file: logFile(key) };
}

/* 启动记录 + 进程链识别：
   bat 启动器常常在几十秒后把自己交棒给 venv 里的 python，只记启动器 pid 会「启动中」一闪就没，
   所以按目录/命令行把属于这个服务的进程都认出来（一次 CIM 查询 + 3 秒缓存，给所有模块共用）*/
const RUNTIME = path.join(DATA, 'svc-runtime.json');
function rtLoad() { try { const j = JSON.parse(fs.readFileSync(RUNTIME, 'utf8')); return (j && typeof j === 'object') ? j : {} } catch (e) { return {} } }
function rtSet(key, pid) { const m = rtLoad(); if (pid) m[key] = { pid: Number(pid), at: Date.now() }; else delete m[key]; try { fs.writeFileSync(RUNTIME, JSON.stringify(m)) } catch (e) {} }
function pidAlive(pid) { if (!pid) return false; try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
function rtFresh(key, sec) { const r = rtLoad()[key]; return !!(r && r.at && (Date.now() - r.at < sec * 1000)) }

const SEP = '\u0001';
let procCache = { at: 0, list: null };
async function allProcs(force) {
  if (!force && procCache.list && Date.now() - procCache.at < 3000) return procCache.list;
  const script = "Get-CimInstance Win32_Process | ForEach-Object { [string]$_.ProcessId + '" + SEP + "' + [string]$_.Name + '" + SEP + "' + [string]$_.ExecutablePath + '" + SEP + "' + [string]$_.CommandLine }";
  const enc = Buffer.from(script, 'utf16le').toString('base64');
  const out = await shared.sh('powershell.exe -NoProfile -EncodedCommand ' + enc);
  const list = String(out.out || '').split(/\r?\n/).filter(x => x.indexOf(SEP) > 0).map(l => {
    const p = l.split(SEP);
    return { pid: Number(p[0]) || 0, name: p[1] || '', exe: p[2] || '', cmd: p.slice(3).join(SEP) || '' };
  }).filter(p => p.pid);
  procCache = { at: Date.now(), list };
  return list;
}
/* 属于这个服务的进程：命令行里带着它的路径，或者可执行文件就装在它那个目录下（venv python 之类）*/
const LAUNCHER = /^(cmd|powershell|pwsh|wscript|cscript|conhost)\.exe$/i;
function matchProcs(list, target) {
  if (!target) return [];
  const t = String(target).toLowerCase();
  const dir = (path.dirname(target) + path.sep).toLowerCase();
  const self = process.pid;
  return list.filter(p => {
    if (p.pid === self) return false;
    /* 只认两类：拿它当命令行跑的启动器，或者可执行文件本来就装在这个服务目录里（venv python 等） */
    if (p.cmd && LAUNCHER.test(p.name) && String(p.cmd).toLowerCase().indexOf(t) >= 0) return true;
    return !!(p.exe && String(p.exe).toLowerCase().startsWith(dir));
  });
}
async function serviceProcs(target, force) {
  try { return matchProcs(await allProcs(force), target) } catch (e) { return [] }
}

/* 字段归一 */
function norm(o) {
  o = o || {};
  const port = Number(o.port) || 0;
  /* 附加端口：RVC 这类主程序 + TTS 动态前端，会占多个端口 */
  let ports = [];
  if (Array.isArray(o.ports)) ports = o.ports;
  else if (typeof o.ports === 'string') { try { ports = JSON.parse(o.ports) } catch (e) { ports = o.ports.split(/[,，\s]+/).filter(Boolean) } }
  else if (o.ports !== undefined && o.ports !== null && o.ports !== '') ports = [o.ports];
  if (!Array.isArray(ports)) ports = [ports];
  ports = [...new Set(ports.map(Number).filter(n => n > 0 && n < 65536))].slice(0, 12);
  return {
    key: cleanKey(o.key) || cleanKey(o.name) || ('svc-' + Date.now()),
    name: String(o.name || '').trim().slice(0, 40),
    port: port > 0 && port < 65536 ? port : 0,
    ports: ports,
    path: String(o.path || '').trim().replace(/^["']+|["']+$/g, '').slice(0, 500),
    url: String(o.url || '').trim().slice(0, 300),
    ico: String(o.ico || '').trim().slice(0, 20) || 'svc',
    /* 图标：图片路径直接用，exe/lnk 抽系统图标；留空就走默认的 svc 图标 */
    icon: String(o.icon || '').trim().replace(/^[\"']+|[\"']+$/g, '').slice(0, 500)
  };
}
function valid(s) {
  if (!s.name) return '模块名称不能为空';
  if (!s.port) return '网页端口不能为空（靠它判断在不在运行、内嵌网页）';
  if (!s.path) return '本地路径不能为空（填要拉起的 exe / bat / 脚本 / 文件夹）';
  return '';
}
/* 一个模块占用的所有端口 = 主端口 + 附加端口 */
function allPorts(s) { return [...new Set([s.port, ...(Array.isArray(s.ports) ? s.ports : [])].filter(n => Number(n) > 0))].map(Number) }
function portsClash(list, self, s) {
  const mine = allPorts(s);
  for (const x of list) {
    if (self && x.key === self) continue;
    for (const p of allPorts(x)) if (mine.indexOf(p) >= 0) return p;
  }
  return 0;
}

/* ── 本地路径 → 真正要执行的程序 ── */
const TRY_EXT = ['.bat', '.cmd', '.exe', '.ps1', '.lnk', '.py', '.js', '.jar'];
const DIR_ENTRY = ['start.bat', 'run.bat', 'start.cmd', 'run.cmd', 'startup.bat', 'main.py', 'app.py', 'run.py', 'main.js', 'index.js', 'start.exe'];

function expand(p) {
  let s = String(p || '').trim().replace(/^["']+|["']+$/g, '').replace(/["']+$/g, '');
  if (!s) return '';
  if (s === '~') s = os.homedir();
  else if (s.slice(0, 2) === '~\\' || s.slice(0, 2) === '~/') s = path.join(os.homedir(), s.slice(2));
  return path.isAbsolute(s) ? path.normalize(s) : path.resolve(ROOT, s);
}
function isFile(f) { try { return fs.statSync(f).isFile() } catch (e) { return false } }
function isDir(f) { try { return fs.statSync(f).isDirectory() } catch (e) { return false } }
const NOISE = /unins|install|setup|update|detect|listgpu|test|readme/i;
function pickFromDir(d) {
  /* 1. 明确的启动脚本名 → 2. 任何 bat/cmd/exe 启动器 → 3. 任何 py/js 入口 */
  for (const n of DIR_ENTRY.slice(0, 5)) { const f = path.join(d, n); if (isFile(f)) return f }
  let names = [];
  try { names = fs.readdirSync(d) } catch (e) { return '' }
  const low = names.map(n => n.toLowerCase());
  for (const want of ['.bat', '.cmd', '.exe']) {
    const i = low.findIndex(n => n.endsWith(want) && !NOISE.test(n));
    if (i >= 0) return path.join(d, names[i]);
  }
  for (const want of ['.py', '.js']) {
    const i = low.findIndex(n => (n.endsWith(want) && !NOISE.test(n)) && /^(main|app|run|start|index|server)/.test(n));
    if (i >= 0) return path.join(d, names[i]);
  }
  return '';
}
function resolveTarget(raw) {
  const p = expand(raw);
  if (!p) return { ok: false, err: '本地路径为空' };
  if (isDir(p)) {
    const hit = pickFromDir(p);
    if (!hit) return { ok: false, err: '这个文件夹里没找到启动入口（bat/exe/py/js）：' + p };
    return { ok: true, file: hit, fromDir: true };
  }
  if (isFile(p)) return { ok: true, file: p };
  for (const e of TRY_EXT) { if (isFile(p + e)) return { ok: true, file: p + e }; }
  return { ok: false, err: '路径不存在：' + p };
}
function hasBin(name) {
  return String(process.env.PATH || '').split(path.delimiter).some(d => { try { return fs.statSync(path.join(d, name)).isFile() } catch (e) { return false } });
}
function pyFor(file) {
  const cand = [path.join(path.dirname(file), 'venv', 'Scripts', 'python.exe'), path.join(path.dirname(file), '..', 'venv', 'Scripts', 'python.exe')];
  for (const c of cand) { if (isFile(c)) return c }
  return hasBin('python.exe') ? 'python' : (hasBin('py.exe') ? 'py' : '');
}
function buildSpawn(file) {
  const ext = path.extname(file).toLowerCase();
  const q = '"' + file + '"';
  /* 注意：普通参数传原路径，Node 拼命令行时才需要加引号，自己加反而会变成路径的一部分 */
  if (ext === '.bat' || ext === '.cmd') return { cmd: 'cmd.exe', args: ['/d', '/c', file] };
  if (ext === '.exe') return { cmd: file, args: [] };
  if (ext === '.ps1') return { cmd: 'powershell.exe', args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file] };
  if (ext === '.lnk') return { cmd: 'powershell.exe', args: ['-NoProfile', '-Command', 'Start-Process -LiteralPath ' + q] };
  if (ext === '.py') { const py = pyFor(file); return py ? { cmd: py, args: [file] } : { err: '本机没找到 python，这个路径改成填 .bat 启动脚本' }; }
  if (ext === '.js') return { cmd: hasBin('node.exe') ? 'node' : 'node.exe', args: [file] };
  if (ext === '.jar') return hasBin('java.exe') ? { cmd: 'java', args: ['-jar', file] } : { err: '本机没找到 java' };
  return { cmd: 'cmd.exe', args: ['/d', '/c', 'start', '""', q] };
}

/* 列表是侧栏 + 每次点界面都要调的接口，这里只允许纯 TCP 探测：
   翻进程表（powershell）和 netstat 都是子进程，一轮一次，界面点几下窗口就闪几下 ✓
   「启动中」改用启动记录判断，进程表只在拨开关（start/stop）时才查 */
const STARTING_WINDOW = 120;
async function listAll() {
  const out = [];
  for (const s of load()) {
    /* 主端口没开但附加端口开了（如 RVC 只起了 TTS 前端）也算在运行 */
    const ps = allPorts(s);
    let open = false, openPorts = [], pid = null;
    for (const p of ps) {
      if (await shared.portOpen(p)) { open = true; openPorts.push(p); if (!pid) { try { pid = await shared.portPid(p) } catch (e) {} } }
    }
    const r = resolveTarget(s.path);
    const starting = !open && rtFresh(s.key, STARTING_WINDOW);
    let hasLog = false; try { hasLog = fs.statSync(logFile(s.key)).size > 0 } catch (e) {}
    out.push(Object.assign({}, s, {
      ports: ps.slice(1), openPorts,
      running: !!open || starting, open: !!open, starting,
      pid: pid ? Number(pid) : null, hasLog: !!hasLog,
      resolved: r.ok ? r.file : '', resolveErr: r.ok ? '' : r.err
    }));
  }
  return out;
}

/* ── 模块图标：icon 填图片路径（png/ico/jpg/webp/svg…）或 exe/lnk，exe 抽系统图标存成 png 缓存 ── */
const ICONDIR = path.join(DATA, 'icons');
const MIME_BY_EXT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml' };
const IMG_EXT = Object.keys(MIME_BY_EXT);
const EXE_EXT = ['.exe', '.lnk', '.dll'];
function iconCacheFile(key) { return path.join(ICONDIR, cleanKey(key) + '.png') }
async function iconFor(key) {
  const s = get(key);
  if (!s || !s.icon) return null;
  const p = expand(s.icon);
  const ext = path.extname(p).toLowerCase();
  if (isFile(p) && IMG_EXT.indexOf(ext) >= 0) return { file: p, mime: MIME_BY_EXT[ext] };
  if (isFile(p) && EXE_EXT.indexOf(ext) >= 0) {
    const cache = iconCacheFile(s.key);
    let cachedAt = 0, srcAt = 0;
    try { cachedAt = fs.statSync(cache).mtimeMs } catch (e) {}
    try { srcAt = fs.statSync(p).mtimeMs } catch (e) {}
    if (cachedAt && cachedAt >= srcAt) return { file: cache, mime: 'image/png' };
    try { fs.mkdirSync(ICONDIR, { recursive: true }) } catch (e) {}
    const q1 = p.replace(/'/g, "''"), q2 = cache.replace(/'/g, "''");
    const ps = "Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Icon]::ExtractAssociatedIcon('" + q1 + "'); if($i -ne $null){ $i.ToBitmap().Save('" + q2 + "',[System.Drawing.Imaging.ImageFormat]::Png) }";
    try { await shared.sh('powershell.exe -NoProfile -EncodedCommand ' + Buffer.from(ps, 'utf16le').toString('base64')) } catch (e) {}
    if (isFile(cache)) return { file: cache, mime: 'image/png' };
    return null;
  }
  return null;
}

function get(key) { return load().find(x => x.key === cleanKey(key)) || null }

function create(o) {
  const list = load(); const s = norm(o); const bad = valid(s);
  if (bad) return { ok: false, error: bad };
  /* 同名模块自动加编号，不让创建卡在「标识已存在」 */
  if (list.some(x => x.key === s.key)) {
    const base = s.key.replace(/-\d+$/, '');
    let n = 2; while (list.some(x => x.key === base + '-' + n)) n++;
    s.key = base + '-' + n;
  }
  const clash = portsClash(list, 0, s);
  if (clash) return { ok: false, error: '端口 ' + clash + ' 已被其他模块占用' };
  const r = resolveTarget(s.path);
  if (!r.ok) return { ok: false, error: r.err };
  s.createdAt = Date.now();
  const w = save(list.concat([s]));
  return w.ok ? { ok: true, mod: Object.assign({}, s, { resolved: r.file }) } : w;
}

function update(key, o) {
  const list = load(); const k = cleanKey(key); const i = list.findIndex(x => x.key === k);
  if (i < 0) return { ok: false, error: '模块不存在' };
  const s = norm(Object.assign({}, list[i], o, { key: k })); const bad = valid(s);
  if (bad) return { ok: false, error: bad };
  const clash = portsClash(list, k, s);
  if (clash) return { ok: false, error: '端口 ' + clash + ' 已被其他模块占用' };
  const r = resolveTarget(s.path);
  if (!r.ok) return { ok: false, error: r.err };
  s.createdAt = list[i].createdAt || Date.now();
  list[i] = s;
  const w = save(list);
  return w.ok ? { ok: true, mod: Object.assign({}, s, { resolved: r.file }) } : w;
}

function remove(key) {
  const k = cleanKey(key); const list = load();
  if (!list.some(x => x.key === k)) return { ok: true };
  const w = save(list.filter(x => x.key !== k));
  if (w.ok) { try { fs.unlinkSync(logFile(k)) } catch (e) {} rtSet(k, 0) }
  return w;
}

/* 启动：后台静默拉起本地路径（不弹 cmd 窗口），输出写进模块日志，工作目录取它自己所在目录 */
async function start(key) {
  const s = get(key);
  if (!s) return { ok: false, error: '模块不存在' };
  if (s.port && await shared.portOpen(s.port)) return { ok: false, error: '已在运行（端口 ' + s.port + ' 正在监听）', running: true, open: true };
  const r = resolveTarget(s.path);
  if (!r.ok) return { ok: false, error: r.err };
  /* 同一套文件已经在跑（冷启动中），不能再拉一份；刚按下开关 30 秒内进程表还没匹配上时拿启动记录兜一下 */
  const busy = await serviceProcs(r.file, true);
  if (busy.length || rtFresh(s.key, 30)) {
    const bp = busy.length ? busy[0].pid : (rtLoad()[s.key] || {}).pid;
    return { ok: false, error: '已经在后台启动了（PID ' + bp + '，端口 ' + s.port + ' 还没监听，再等会儿）', running: true, starting: true, pid: bp || null };
  }
  const b = buildSpawn(r.file);
  if (b.err) return { ok: false, error: b.err };
  const cwd = path.dirname(r.file);
  try { fs.mkdirSync(LOGDIR, { recursive: true }) } catch (e) {}
  const h = openLog(s.key);
  const fd = h.fd, lf = h.file;
  const mark = '\n[hub] ' + new Date().toLocaleString('sv-SE') + ' | start: ' + b.cmd + ' ' + (b.args || []).join(' ') + '\n[hub] cwd=' + cwd + '\n';
  try { if (fd !== null) fs.appendFileSync(fd, mark); else fs.appendFileSync(lf, mark) } catch (e) {}
  let child = null;
  try {
    /* 不能给 detached：windows 下 detached 等于 CREATE_NEW_CONSOLE，cmd.exe 一定会闪一个黑窗口，
       而 windowsHide 对已新建控制台的进程无效 ✓ 不带 detached 靠 stdout 重定向到日志也能常驻 */
    child = shared.spawn(b.cmd, b.args, { cwd: cwd, detached: false, windowsHide: true, stdio: fd === null ? 'ignore' : ['ignore', fd, fd] });
  } catch (e) {
    if (fd !== null) { try { fs.closeSync(fd) } catch (e2) {} }
    return { ok: false, error: '拉起失败：' + e.message };
  }
  if (fd !== null) { try { fs.closeSync(fd) } catch (e) {} }
  if (child && child.unref) child.unref();
  rtSet(s.key, child ? child.pid : 0);
  let up = false;
  if (s.port) { for (let i = 0; i < 16; i++) { await new Promise(r2 => setTimeout(r2, 500)); if (await shared.portOpen(s.port)) { up = true; break } } }
  else up = true;
  if (up) { rtSet(s.key, 0); return { ok: true, pid: child ? child.pid : null, target: r.file, running: true, open: true, starting: false, log: lf }; }
  /* 等了一轮端口还没开：看进程还在不在，不在就是起来就退了（路径/环境问题），把日志尾端带回去 */
  const alive = await serviceProcs(r.file, true);
  if (alive.length) return { ok: true, pid: child ? child.pid : null, target: r.file, running: true, open: false, starting: true, log: lf };
  rtSet(s.key, 0);
  const tail = decodeConsole(tailBuf(lf, 4000)).split('\n').filter(x => x.trim() && x.trim()[0] !== '[').slice(-3).join(' ');
  return { ok: false, exited: true, error: '拉起来就退出了，没等到端口 ' + s.port + (tail ? ('：' + tail.slice(0, 200)) : ''), log: lf };
}

async function stop(key) {
  const s = get(key);
  if (!s) return { ok: false, error: '模块不存在' };
  const open = s.port ? await shared.portOpen(s.port) : false;
  const r = resolveTarget(s.path);
  const target = r.ok ? r.file : '';
  const procs = target ? await serviceProcs(target, true) : [];
  if (!open && !procs.length) return { ok: false, error: '未在运行', notRunning: true };
  /* 所有端口的占用进程都要收：RVC 的 TTS 前端是运行时动态另开的端口 */
  const portPids = [];
  for (const p of allPorts(s)) { const pp = await shared.portPid(p); if (pp && portPids.indexOf(Number(pp)) < 0) portPids.push(Number(pp)); }
  /* 先杀端口占用进程（带整棵树），再把剩下的启动器 / venv 进程收掉（bat 末尾的 pause 会卡住 cmd）*/
  const killed = [];
  for (const pp of portPids) { await shared.sh('taskkill /F /T /PID ' + pp); killed.push(pp); }
  for (const p of procs.slice(0, 40)) {
    if (killed.indexOf(p.pid) >= 0) continue;
    await shared.sh('taskkill /F /T /PID ' + p.pid);
    killed.push(p.pid);
  }
  rtSet(s.key, 0);
  try { fs.appendFileSync(currentLogFile(s.key), '\n[hub] ' + new Date().toLocaleString('sv-SE') + ' | stop: ports ' + allPorts(s).join(',') + ' 已结束进程 ' + (killed.join(',') || portPids.join(',') || '?') + '\n') } catch (e) {}
  for (let i = 0; i < 6; i++) {
    let any = false; for (const p of allPorts(s)) if (await shared.portOpen(p)) { any = true; break }
    if (!any) break;
    await new Promise(r2 => setTimeout(r2, 400));
  }
  return { ok: true, pid: portPids[0] || (killed[0] || null), shell: killed };
}

/* 日志读出来要像 cmd 窗口：cmd 自己的消息是 GBK，脚本（PYTHONUTF8=1）吐的是 UTF-8，
   所以按行试解：整行能按 UTF-8 解开就算 UTF-8，解不开就按 GBK，ANSI 色码剥掉 */
function tailBuf(f, n) {
  try {
    const st = fs.statSync(f);
    const fd = fs.openSync(f, 'r');
    const len = Math.min(n, st.size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.size - len);
    fs.closeSync(fd);
    return buf;
  } catch (e) { return Buffer.alloc(0) }
}
const decU = new TextDecoder('utf-8', { fatal: true });
const decG = new TextDecoder('gbk');
function decodeLine(buf) {
  try { return decU.decode(buf) } catch (e) {}
  try { return decG.decode(buf) } catch (e2) { return buf.toString('latin1') }
}
function decodeConsole(buf) {
  if (!buf || !buf.length) return '';
  const out = [];
  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) { out.push(decodeLine(buf.subarray(start, i))); start = i + 1; }
  }
  return out.join('\n')
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-9;:?]*[ -/]*[@-~]/g, '')
    .replace(/\r/g, '')
    .replace(/\u0000/g, '');
}
function logs(key, n) {
  const f = currentLogFile(key);
  if (!fs.existsSync(f)) return '(无日志，尚未启动过)';
  return decodeConsole(tailBuf(f, n || 12000));
}

module.exports = { listAll, get, create, update, remove, start, stop, logs, logFile, cleanKey, resolveTarget, iconFor };
