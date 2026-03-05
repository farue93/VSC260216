// ═══════════════════════════════════════════════════
// OCTRION Lead-App — Service Worker (PWA Offline)
// ═══════════════════════════════════════════════════

const CACHE_NAME = 'octrion-lead-app-v6';

// Files to cache for full offline support
const PRECACHE_URLS = [
  './',
  './legacy-lead-app.html',
  './manifest.json',
  // Icons
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/icon-192-maskable.png',
  './assets/images/icon-512-maskable.png',
  // Logo images
  './assets/images/13459_OCTRION_Bildmarke_RGB_lila.png',
  './assets/images/ctrion_text.png',
  './assets/images/letter_c.png',
  './assets/images/letter_t.png',
  './assets/images/letter_r.png',
  './assets/images/letter_i.png',
  './assets/images/letter_o2.png',
  './assets/images/letter_n.png',
  // Tesseract OCR (offline)
  './assets/tesseract/tesseract.min.js',
  './assets/tesseract/worker.min.js',
  './assets/tesseract/tesseract-core-simd-lstm.wasm.js',
  './assets/tesseract/deu.traineddata.gz',
  './assets/tesseract/eng.traineddata.gz',
  // QR Code Scanner (offline)
  './assets/jsqr/jsQR.js',
  // Video (large — cached on first play)
  // './assets/video/OCTRION-Image-Video-04.mp4',  // 32MB — lazy-cached below
];

// Large files to cache lazily (on first request)
const LAZY_CACHE = [
  'assets/video/OCTRION-Image-Video-04.mp4'
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
          return caches.match('./legacy-lead-app.html');
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
