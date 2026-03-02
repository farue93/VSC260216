// ═══════════════════════════════════════════════════
// OCTRION Lead-App — Service Worker (PWA Offline)
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'octrion-lead-app-v3';

// Files to cache for full offline support
const PRECACHE_URLS = [
  './',
  './oktopus-lead-app.html',
  './manifest.json',
  // Icons
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png',
  // Logo images
  './13459_OCTRION_Bildmarke_RGB_lila.png',
  './ctrion_text.png',
  './letter_c.png',
  './letter_t.png',
  './letter_r.png',
  './letter_i.png',
  './letter_o2.png',
  './letter_n.png',
  // Tesseract OCR (offline)
  './tesseract/tesseract.min.js',
  './tesseract/worker.min.js',
  './tesseract/tesseract-core-simd-lstm.wasm.js',
  './tesseract/deu.traineddata.gz',
  './tesseract/eng.traineddata.gz',
  // Video (large — cached on first play)
  // './OCTRION-Image-Video-04.mp4',  // 32MB — lazy-cached below
];

// Large files to cache lazily (on first request)
const LAZY_CACHE = [
  'OCTRION-Image-Video-04.mp4'
];

// ─── INSTALL: Pre-cache essential files ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Pre-caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: Clean up old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Removing old cache:', key);
              return caches.delete(key);
            })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: Serve from cache, fallback to network ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // Check if this is a lazy-cache file (video)
  const isLazy = LAZY_CACHE.some(f => url.pathname.endsWith(f));

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      // Not in cache — fetch from network
      return fetch(event.request).then(response => {
        // Don't cache bad responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Cache the response (including lazy files like video)
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
          if (isLazy) console.log('[SW] Lazy-cached:', url.pathname);
        });

        return response;
      }).catch(() => {
        // Offline and not in cache — return offline fallback for HTML
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./oktopus-lead-app.html');
        }
      });
    })
  );
});

// ─── MESSAGE: Handle update commands from app ───
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
