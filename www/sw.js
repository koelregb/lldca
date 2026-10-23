/* 浮乐 (fuley) — Service Worker（离线可用） */
const CACHE = 'fuley-v1.3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
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
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const cp = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
