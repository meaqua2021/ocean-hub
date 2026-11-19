/* 服务模块：一个模块 = 名称 + 本地路径 + 网页端口（服务端 data/services.json）*/
const B = '/api/svc/';
async function call(action, body) {
  const r = await fetch(B + action, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok && j.ok === undefined) throw new Error('http ' + r.status);
  return j;
}
export async function listServices() { try { const j = await call('list'); return j.mods || [] } catch (e) { return [] } }
export async function createService(o) { return call('create', o) }
export async function updateService(o) { return call('update', o) }
export async function deleteService(key) { return call('delete', { key }) }
export async function startService(key) { return call('start', { key }) }
export async function stopService(key) { return call('stop', { key }) }
export async function serviceState(key) { try { return (await (await fetch(B + 'status?key=' + encodeURIComponent(key))).json()) } catch (e) { return { ok: false } } }
export function svcDisplayUrl(s) { return (s && s.port) ? ('http://127.0.0.1:' + s.port) : (s && s.url) || ''; }
export async function serviceLogs(key) { try { const r = await fetch(B + 'logs?key=' + encodeURIComponent(key)); return await r.text() } catch (e) { return '' } }
/* 服务端记录 → 侧栏模块项 */
export function toModule(s) {
  return { key: s.key, name: s.name, ico: s.ico || 'svc', icon: s.icon || '', iconUrl: s.icon ? ('/api/svc/icon?key=' + encodeURIComponent(s.key) + '&v=' + (s.createdAt || 0)) : '', kind: 'svc', user: true, port: s.port || 0, path: s.path || '', url: s.url || '', resolved: s.resolved || '', resolveErr: s.resolveErr || '', running: !!s.running, open: !!s.open, starting: !!s.starting, pid: s.pid || null };
}
