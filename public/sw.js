const CACHE_NAME = 'ta-cukrarna-v6';
const urlsToCache = [
  '/',
  '/icon.ico',
  '/apple-touch-icon.png',
  '/img/favicon.png',
  '/img/logo.svg',
  '/img/header_bg.png',
  '/manifest.json',
];

// Install service worker
self.addEventListener('install', event => {
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
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

// Activate service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
