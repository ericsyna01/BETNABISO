const CACHE_NAME = 'betnabiso-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
];

// Installation : mise en cache des ressources statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : stratégie Network-first pour l'API, Cache-first pour les assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes API
  if (url.port === '8888' || url.pathname.startsWith('/api')) return;

  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache les nouvelles ressources statiques
        if (response.ok && (url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Hors ligne : servir depuis le cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback sur index.html pour les routes Angular
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          return new Response('Hors ligne', { status: 503 });
        });
      })
  );
});
