const CACHE_NAME = 'wk-factory-v4';
const PRECACHE_URLS = ['./'];

self.addEventListener('install', (event) => {
  // Force immediate activation — don't wait for old SW to release
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Don't cache API calls or uploads
  if (request.url.includes('/api/') || request.url.includes('/uploads/')) return;
  // Network-first for everything — always serve fresh content, fall back to cache offline
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match('./')))
  );
});
