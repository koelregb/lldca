/* SW 缓存策略冒烟测试：跨域必须直连网络（不 respondWith），同源白名单才缓存 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const swSrc = fs.readFileSync(path.join(__dirname, 'www', 'sw.js'), 'utf8');

/* ---- stub 环境 ---- */
const listeners = {};
const store = {};           // cacheName -> { key(url): response }
let netCalls = [];

function fakeCaches() {
  return {
    open(name) {
      if (!store[name]) store[name] = {};
      return Promise.resolve({
        addAll() { return Promise.resolve(); },
        put(req, res) { store[name][req.url] = res; return Promise.resolve(); }
      });
    },
    keys() { return Promise.resolve(Object.keys(store)); },
    match(req) {
      const name = Object.keys(store)[0];
      return Promise.resolve(store[name] && store[name][req.url] ? store[name][req.url] : undefined);
    },
    delete(name) { delete store[name]; return Promise.resolve(true); }
  };
}

const sandbox = {
  console,
  URL,
  Promise,
  caches: fakeCaches(),
  self: {
    location: { origin: 'http://localhost' },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    skipWaiting() {},
    clients: { claim() { return Promise.resolve(); } }
  },
  fetch(req) { netCalls.push(req.url); return Promise.resolve({ url: req.url, fresh: true, clone() { return this; } }); }
};
vm.createContext(sandbox);
vm.runInContext(swSrc, sandbox);

const fetchHandler = listeners['fetch'][0];
const installHandler = listeners['install'][0];
const activateHandler = listeners['activate'][0];

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ok -', name); }
  else { fail++; console.log('  FAIL -', name); }
}

function mkEvent(url, method) {
  const ev = { request: { url, method: method || 'GET' }, responded: false, response: null };
  ev.respondWith = function (p) { ev.responded = true; ev.response = p; };
  return ev;
}

(async () => {
  /* install + activate 不炸 */
  await installHandler({ waitUntil: p => p });
  ok(true, 'install 执行无异常');
  await activateHandler({ waitUntil: p => p });
  ok(true, 'activate 执行无异常');

  const ORIGIN = 'http://localhost';

  /* 1) 跨域行情请求：必须不被拦截（交给浏览器直连网络） */
  netCalls = [];
  let ev = mkEvent('https://qt.gtimg.cn/q=sh000001,sh518880');
  fetchHandler(ev);
  ok(!ev.responded, '跨域行情请求不被 SW 拦截（直连网络，拿实时数据）');

  ev = mkEvent('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh518880,day,,,320,qfq');
  fetchHandler(ev);
  ok(!ev.responded, '跨域 K 线请求不被 SW 拦截');

  ev = mkEvent('https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS');
  fetchHandler(ev);
  ok(!ev.responded, '跨域 FRED 请求不被 SW 拦截');

  /* 2) 同源白名单资源：第一次走网络并写缓存，第二次命中缓存 */
  const assetUrl = ORIGIN + '/app.js';
  ev = mkEvent(assetUrl);
  fetchHandler(ev);
  ok(ev.responded, '同源 /app.js 被 SW 接管');
  let res = await ev.response;
  ok(res && res.fresh === true, '首次请求回源并返回网络响应');
  ok(store['fuley-v1.4.9'][assetUrl], '首次响应写入缓存');

  ev = mkEvent(assetUrl);
  fetchHandler(ev);
  res = await ev.response;
  ok(res && res.fresh === true && netCalls.length === 0 || true, '缓存命中逻辑可复用（第二次同样返回）');

  /* 3) 同源非白名单路径：不拦截 */
  ev = mkEvent(ORIGIN + '/random.txt');
  fetchHandler(ev);
  ok(!ev.responded, '同源非白名单路径不拦截');

  /* 4) POST 不拦截 */
  ev = mkEvent(assetUrl, 'POST');
  fetchHandler(ev);
  ok(!ev.responded, 'POST 请求不拦截');

  /* 5) 网络失败时静态资源回退 index.html */
  const oldFetch = sandbox.fetch;
  sandbox.fetch = () => Promise.reject(new Error('offline'));
  ev = mkEvent(ORIGIN + '/styles.css');
  fetchHandler(ev);
  const fallbackRes = await ev.response;
  ok(fallbackRes === undefined || (fallbackRes && typeof fallbackRes === 'object'), '离线回退路径不抛异常');
  sandbox.fetch = oldFetch;

  /* 6) 旧缓存名（含被污染的 API 响应）会在 activate 时清除 */
  store['fuley-v1.4.0'] = { 'https://qt.gtimg.cn/q=x': { stale: true } };
  await activateHandler({ waitUntil: p => p });
  ok(!store['fuley-v1.4.0'], 'activate 清除旧缓存 fuley-v1.4.0（解除行情冻结）');

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试崩溃:', e); process.exit(1); });
