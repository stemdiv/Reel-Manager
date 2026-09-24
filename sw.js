// ============================================================================
// Reel / Playlist Manager — Service Worker
// Strategy: Cache-first for static assets, network-first for API calls
// ============================================================================

// AUD-30 — the cache is named after the release that registered this worker:
// the app registers sw.js?v=<APP_VERSION>, so each release gets its own cache
// and activate drops the previous one. It was a hand-bumped 'reel-manager-v32'
// that had no link to APP_VERSION.
const RELEASE = new URL(self.location).searchParams.get('v') || 'dev';
const CACHE_NAME = 'reel-manager-' + RELEASE;
// Same-origin only. The Google Fonts stylesheet used to be listed here: one
// failed cross-origin request makes cache.addAll() reject and the whole install
// with it, and the fetch handler never served that entry anyway (googleapis.com
// goes straight to the network). shared/core.js is needed to boot offline.
const STATIC_ASSETS = [
  'youtube-playlist-manager.html',
  'reel-studio.html',
  'shared/core.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
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

// The page to show when the local server does not answer and the page was
// never cached. Without it the fallback resolved to undefined and Chrome showed
// a bare ERR_FAILED, which reads like a broken app rather than a stopped server.
function serverDownPage() {
  const body = '<!doctype html><meta charset="utf-8"><title>Reel Manager</title>'
    + '<body style="font-family:system-ui,sans-serif;background:#111;color:#eee;padding:48px;line-height:1.5">'
    + '<h1 style="font-size:20px">Le serveur local ne r\u00e9pond pas \u00b7 The local server is not answering</h1>'
    + '<p>Relancez <code>LANCER-APP.bat</code>, puis rechargez cette page.<br>'
    + 'Run <code>LANCER-APP.bat</code> again, then reload this page.</p></body>';
  return new Response(body, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

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
  // AUD-30 — also for same-origin scripts and JSON (shared/core.js,
  // changelog.json): a fresh page must not run against a stale shared script.
  // Offline, the query string is ignored: ?bookmark=… and reel-studio.html?v=…
  // are the cached page, not a miss.
  const sameOrigin = url.origin === self.location.origin;
  if (event.request.mode === 'navigate' || event.request.destination === 'document'
      || (sameOrigin && (event.request.destination === 'script' || url.pathname.endsWith('.json')))) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request, { ignoreSearch: true })   // offline: fall back to cache
        .then(cached => cached
          || (event.request.mode === 'navigate' ? serverDownPage() : Response.error())))
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
