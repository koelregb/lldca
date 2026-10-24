/* 浮乐 (fuley) — Service Worker（离线可用）
   策略：仅缓存本站静态资源（白名单）；所有跨域请求（腾讯行情/黄金K线/FRED 等）
   一律直连网络，绝不缓存 —— 否则行情会被首次响应冻结，后续刷新永远拿旧数据。 */
const CACHE = 'fuley-v1.4.1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './i18n.js',
  './license.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* 1) 跨域请求（行情 qt.gtimg.cn / K线 web.ifzq.gtimg.cn / FRED…）：不拦截，让浏览器直接走网络 */
  if (url.origin !== self.location.origin) return;

  /* 2) 同源请求只缓存白名单静态资源（导航到 ./ 也算） */
  const path = url.pathname === '/' ? './' : '.' + url.pathname;
  if (ASSETS.indexOf(path) < 0 && ASSETS.indexOf(url.pathname) < 0) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const cp = res.clone();
        caches.open(CACHE).then((c) => c.put(req, cp)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
