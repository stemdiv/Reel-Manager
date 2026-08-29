// ============================================================================
// Reel / Playlist Manager — Service Worker
// Strategy: Cache-first for static assets, network-first for API calls
// ============================================================================

const CACHE_NAME = 'reel-manager-v26';
const STATIC_ASSETS = [
  'youtube-playlist-manager.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Network-only for YouTube API calls and Google OAuth
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('accounts.google.com') ||
      url.hostname.includes('youtube.com')) {
    return; // Let the browser handle it normally
  }

  // Network-first for HTML documents: stale-while-revalidate served the PREVIOUS
  // version on every visit, so an edited page only appeared on the next reload.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))   // offline: fall back to cache
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached, but update cache in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        }).catch(() => {}); // Ignore network errors for background update
        return cached;
      }
      // Not cached: fetch from network and cache
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});
