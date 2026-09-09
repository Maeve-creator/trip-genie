/* Trip Genie Service Worker
   策略：
   - 只處理「同源」請求；跨網域（Firebase Auth / Firestore / gstatic / fonts）一律放行不攔截，
     避免破壞登入與雲端即時同步。
   - navigation（開 App）→ network-first：優先拿最新 index.html（push 更新後手機能即時吃到新版），
     離線時 fallback 到快取，讓 App 殼仍可開啟。
   - 同源靜態資源（icons / manifest）→ cache-first。
*/
const CACHE = 'trip-genie-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // 只快取 GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // 跨網域（Firebase 等）不攔截，正常走網路

  // navigation：network-first，離線 fallback 快取
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 同源靜態資源：cache-first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
