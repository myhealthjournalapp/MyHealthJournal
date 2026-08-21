const CACHE_NAME = 'my-health-journal-v1.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './enhancements.js',
  './manifest.json'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching assets...');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request)
      .then(response => {
        if (response) return response;

        return fetch(e.request).then(fetchResponse => {
          // Cache new assets
          if (e.request.url.includes('googleapis.com')) return fetchResponse;

          return caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
      .catch(() => {
        // Offline fallback
        return new Response('Offline - My Health Journal', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});
