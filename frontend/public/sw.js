const CACHE_NAME = 'wk-factory-v3';
const PRECACHE_URLS = ['./'];

self.addEventListener('install', (event) => {
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
  // Network-first for navigation, cache-first for assets
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./'))
    );
  } else {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }))
    );
  }
});
