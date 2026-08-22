/* VEGA service worker — PWA step 2 (offline shell).
 * Strategies:
 *  - Navigations: network-first with cached-shell fallback (drivers offline).
 *  - Static assets (_next/static, icons, fonts): cache-first (immutable).
 *  - /api/*: never cached.
 */
const VERSION = 'vega-sw-v1';
const CORE = ['./'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  // Immutable build output & icons: cache-first, refresh in background.
  if (url.pathname.includes('/_next/static/') || url.pathname.includes('/icons/')) {
    event.respondWith(
      caches.open(VERSION).then(async cache => {
        const cached = await cache.match(request);
        const network = fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Page navigations: try network, fall back to last-good shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(async () =>
        (await caches.match(request)) ||
        (await caches.match('./')) ||
        new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } })
      )
    );
  }
});
