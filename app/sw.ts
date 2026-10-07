import { CacheFirst, CacheableResponsePlugin, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from 'serwist'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}
declare const self: ServiceWorkerGlobalScope

const DAY = 24 * 60 * 60
const networkOnly = () => new NetworkOnly({
  fetchOptions: { cache: 'no-store' },
  // Serwist intentionally ignores fetchOptions for navigations, so put the
  // cache mode on the Request itself as well.
  plugins: [{ requestWillFetch: async ({ request }) => new Request(request, { cache: 'no-store' }) }],
})
const isSocket = (url: URL) => url.pathname === '/socket.io' || url.pathname.startsWith('/socket.io/')
const isStaticImage = (url: URL) =>
  /^\/(?:logo(?:-white)?|pwa-192x192|pwa-512x512|apple-icon)\.png$/.test(url.pathname) ||
  /^\/mascot\/[^/]+\.(?:png|webp|svg|jpg)$/.test(url.pathname) ||
  /^\/(?:sign-up|support|earn|learn|tasker-signup|Western_Delta_University)\.(?:png|jpe?g)$/.test(url.pathname)

const serwist = new Serwist({
  cacheId: 'swiftdu',
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cacheName: 'swiftdu-precache-v1-' + self.registration.scope,
    // Built-in cleanup matches unrelated precache names too. Exact legacy cleanup
    // below plus Serwist's own revision pruning is sufficient.
    cleanupOutdatedCaches: false,
    cleanURLs: false,
    directoryIndex: null,
    // The fallback logo uses a branding query string; its revision remains build-driven.
    ignoreURLParametersMatching: [/^v$/],
  },
  skipWaiting: true,
  clientsClaim: true,
  // Disabled deliberately: all navigations use fetch(cache: no-store). Preload
  // cannot carry that fetch option and could reuse the HTTP navigation cache.
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => !isSocket(url) && request.mode === 'navigate',
      handler: networkOnly(),
    },
    {
      matcher: ({ request, url }) => !isSocket(url) && (
        url.pathname === '/api' || url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/_next/data/') ||
        request.headers.has('RSC') || url.searchParams.has('_rsc')
      ),
      handler: networkOnly(),
    },
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && /^\/_next\/static\/.*\.(?:js|css|woff2?|ttf|otf)$/.test(url.pathname),
      handler: new CacheFirst({
        cacheName: 'swiftdu-static-v1',
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 192, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
        ],
      }),
    },
    {
      matcher: ({ sameOrigin, url }) => {
        if (!sameOrigin) return false
        if (isStaticImage(url)) return true
        if (url.pathname !== '/_next/image') return false
        const source = new URL(url.searchParams.get('url') || '/', self.location.origin)
        return source.origin === self.location.origin && isStaticImage(source)
      },
      handler: new StaleWhileRevalidate({
        cacheName: 'swiftdu-images-v1',
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true }),
        ],
      }),
    },
    // All remaining GETs (including external payments and unlisted data) are
    // network-only. Socket.IO polling is left to the browser unchanged.
    { matcher: ({ url }) => !isSocket(url), handler: networkOnly() },
    ...(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const).map((method) => ({
      method,
      matcher: ({ url }: { url: URL }) => !isSocket(url),
      handler: networkOnly(),
    })),
  ],
  fallbacks: {
    entries: [{
      url: '/offline',
      matcher: ({ request }) => {
        const url = new URL(request.url)
        return request.mode === 'navigate' && url.origin === self.location.origin &&
          url.pathname !== '/api' && !url.pathname.startsWith('/api/') && !isSocket(url)
      },
    }],
  },
})

// Exact cache names from the audited SwiftDU next-pwa configuration. Never
// delete arbitrary caches by a broad workbox-/serwist- prefix.
const legacyRuntimeCaches = new Set([
  'brand-assets-symbol-v1', 'google-fonts-webfonts', 'google-fonts-stylesheets',
  'static-font-assets', 'static-image-assets', 'next-image', 'static-audio-assets',
  'static-video-assets', 'static-js-assets', 'static-style-assets', 'next-data',
  'static-data-assets', 'cross-origin',
])
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Explicitly undo next-pwa/previous navigation-preload settings.
    await self.registration.navigationPreload?.disable()
    const names = await caches.keys()
    const legacyPrecache = 'workbox-precache-v2-' + self.registration.scope
    await Promise.all(names.filter((name) => name === legacyPrecache || legacyRuntimeCaches.has(name))
      .map((name) => caches.delete(name)))
  })())
})

type PushPayload = {
  title?: string; body?: string; icon?: string; badge?: string
  image?: string; tag?: string; url?: string
}
function notificationTarget(value?: string) {
  try {
    const url = new URL(value || '/tasker-dashboard', self.location.origin)
    if (url.origin === self.location.origin) return url.href
  } catch { /* Use the existing tasker destination for malformed payloads. */ }
  return new URL('/tasker-dashboard', self.location.origin).href
}
function showSwiftDUNotification(payload: PushPayload) {
  const asset = (value: string) => new URL(value, self.location.origin).href
  const options: NotificationOptions & { image: string } = {
    body: payload.body || 'You have a new update.',
    icon: asset(payload.icon || '/pwa-512x512.png?v=swiftdu-symbol-v1'),
    badge: asset(payload.badge || '/pwa-192x192.png?v=swiftdu-symbol-v1'),
    image: asset(payload.image || '/logo.png?v=swiftdu-symbol-v1'),
    tag: payload.tag || 'swiftdu-update',
    data: { url: notificationTarget(payload.url) },
  }
  return self.registration.showNotification(payload.title || 'SwiftDU', options)
}
self.addEventListener('push', (event) => {
  let payload: PushPayload = {}
  try {
    const data: unknown = event.data?.json()
    if (data && typeof data === 'object') {
      // Ignore non-string fields rather than dropping the notification.
      payload = Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === 'string'))
    }
  } catch { /* A malformed push still gets a visible default notification. */ }
  event.waitUntil(showSwiftDUNotification(payload))
})
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SWIFTDU_SHOW_TEST_NOTIFICATION') return
  event.waitUntil(showSwiftDUNotification({
    title: 'Swift DU Local Test',
    body: 'SwiftDU can display notifications from this service worker.',
    url: '/tasker-dashboard',
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = notificationTarget(event.notification.data?.url)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const exact = windows.find((client) => client.url === target)
    if (exact) { await exact.focus(); return }
    await self.clients.openWindow(target)
  })())
})

serwist.addEventListeners()
