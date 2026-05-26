const CACHE_NAME = 'aurx-ai-v9';

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// INSTALL
self.addEventListener('install', (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache opened');

        return cache.addAll(URLS_TO_CACHE);
      })
      .catch((err) => {
        console.error('[SW] Cache failed:', err);
      })
  );
});

// ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Delete old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// FETCH
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API → NETWORK ONLY
  if (url.hostname.includes('aur-x-backend.vercel.app')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'Backend offline'
          }),
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      })
    );

    return;
  }

  // CACHE FIRST
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {

      // RETURN CACHE
      if (cachedResponse) {
        return cachedResponse;
      }

      // FETCH NETWORK
      return fetch(event.request)
        .then((networkResponse) => {

          // INVALID RESPONSE
          if (
            !networkResponse ||
            networkResponse.status !== 200
          ) {
            return networkResponse;
          }

          // CLONE RESPONSE
          const responseClone = networkResponse.clone();

          // SAVE CACHE
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });

          return networkResponse;
        })
        .catch(() => {

          // OFFLINE FALLBACK
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});