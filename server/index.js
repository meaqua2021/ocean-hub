/* ocean-hub · 服务端入口
   职责：托管 web/dist 静态产物 + 系统级路由（模块清单 / 服务启停 / 开机自启动）
   说明：无登录门禁，本机打开即是控制台 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const registry = require('./core/registry');
const systemRoutes = require('./modules/system/system.routes');

const PORT = process.env.PORT || 5200;
const DIST = path.join(__dirname, '..', 'web', 'dist');
const PUB = path.join(__dirname, '..', 'web', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };

function proxyNotFound(res) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"ok":false,"err":"not found"}'); }

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const pathOnly = req.url.split('?')[0];
    const mod = registry.moduleFor(pathOnly);
    if (mod === 'system') {
      let h = null;
      try {
        h = systemRoutes.match(pathOnly, req.method);
      } catch (e) { return sendErr(res, e); }
      if (h) { Promise.resolve(h(req, res)).catch(e8 => sendErr(res, e8)); return; }
    }
    return proxyNotFound(res);
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let file = path.join(DIST, p);
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end('forbidden'); }
  /* dist 里没带的静态资源（图标等）回落 web/public，避免同一份文件存两处 */
  if (!fs.existsSync(file) && p !== '/index.html') {
    const alt = path.join(PUB, p);
    if (alt.startsWith(PUB) && fs.existsSync(alt)) file = alt;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { fs.readFile(path.join(DIST, 'index.html'), (e2, idx) => { if (e2) { res.writeHead(404); return res.end('not found'); } res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }); res.end(idx); }); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': p.startsWith('/assets/') ? 'public,max-age=86400' : 'no-store' });
    res.end(buf);
  });
});
function sendErr(res, e) { try { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) })); } catch (e2) {} }
server.listen(PORT, '0.0.0.0', () => console.log('ocean-hub http://127.0.0.1:' + PORT));
