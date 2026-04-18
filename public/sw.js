const APP_VERSION = 'swiftdu-pwa-v1';
const STATIC_CACHE = `${APP_VERSION}-static`;
const PAGE_CACHE = `${APP_VERSION}-pages`;
const ASSET_CACHE = `${APP_VERSION}-assets`;
const OFFLINE_URL = '/offline.html';

const PUBLIC_PAGES = new Set([
  '/',
  '/about-us',
  '/contact-us',
  '/reviews',
  '/signup',
  '/tasker-signup',
  '/terms',
]);

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/',
  '/about-us',
  '/contact-us',
  '/reviews',
  '/signup',
  '/tasker-signup',
  '/terms',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-icon.png',
  '/favicon.ico',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((cacheName) => !cacheName.startsWith(APP_VERSION))
          .map((cacheName) => caches.delete(cacheName))
      );

      if ('navigationPreload' in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/tasker-dashboard')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (shouldCacheAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

function shouldCacheAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(?:css|js|png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?)$/i.test(url.pathname)
  );
}

async function handleNavigationRequest(event) {
  const { request } = event;
  const url = new URL(request.url);

  try {
    const preloadResponse = await event.preloadResponse;

    if (preloadResponse) {
      return preloadResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok && PUBLIC_PAGES.has(url.pathname)) {
      const pageCache = await caches.open(PAGE_CACHE);
      pageCache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    const pageCache = await caches.open(PAGE_CACHE);
    const cachedPage = await pageCache.match(request, { ignoreSearch: true });

    if (cachedPage) {
      return cachedPage;
    }

    const staticCache = await caches.open(STATIC_CACHE);
    const offlineResponse = await staticCache.match(OFFLINE_URL);

    if (offlineResponse) {
      return offlineResponse;
    }

    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
}
