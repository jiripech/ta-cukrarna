const CACHE_NAME = 'ta-cukrarna-v9';
const urlsToCache = [
  '/',
  '/icon.ico',
  '/apple-touch-icon.png',
  '/img/favicon.png',
  '/img/favicon-mid.png',
  '/img/favicon.webp',
  '/img/logo.svg',
  '/img/header_bg.png',
  '/manifest.json',
];

// Install service worker
self.addEventListener('install', event => {
  self.skipWaiting(); // Instantly skips the waiting lifecycle phase
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache opened');
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch event - Network-First for the root and HTML, Cache-First for others
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Use Network-First for the root page and any HTML requests
  if (
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    event.request.headers.get('accept').includes('text/html')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Update the cache with the latest version
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }

  // Use Cache-First for static assets (images, fonts, manifest, etc.)
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then(networkResponse => {
          // Check if we received a valid response
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }

          // Only cache GET requests (prevents caching POST/PUT requests)
          if (event.request.method === 'GET') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // Return nothing if network fails and resource is missing in cache
        });
    })
  );
});

// Activate service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // claim all clients immediately
  );
});
