// Bump this whenever the app shell changes so clients cannot keep an
// incompatible runtime from a previous deployment.
const CACHE_NAME = 'webnote-shell-v3';
const APP_SHELL = ['./', './index.html', './favicon.svg', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Let the active page decide when to activate a waiting worker. This avoids
// replacing the application while the user is typing in the editor.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        try {
          return await caches.match('./index.html') || Response.error();
        } catch {
          return Response.error();
        }
      }
    })());
    return;
  }

  event.respondWith((async () => {
    let cached;
    try { cached = await caches.match(request); } catch { cached = undefined; }
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      try {
        const copy = response.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, copy);
      } catch {
        // Cache storage is optional; a successful network response is enough.
      }
    }
    return response;
  })());
});
