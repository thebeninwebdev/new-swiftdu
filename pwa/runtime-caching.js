'use strict'

const defaultRuntimeCaching = require('next-pwa/cache')

const STATIC_CACHE_NAMES_TO_KEEP = new Set([
  'google-fonts-webfonts',
  'google-fonts-stylesheets',
  'static-font-assets',
  'static-image-assets',
  'next-image',
  'static-audio-assets',
  'static-video-assets',
  'static-js-assets',
  'static-style-assets',
  'next-data',
  'static-data-assets',
  'cross-origin',
])

// Page navigation must reach the server so operational redirects cannot be bypassed
// by a cached public page. The existing offline fallback handles network failures.
const pageNavigation = {
  urlPattern: ({ request, url }) =>
    request.mode === 'navigate' && self.origin === url.origin && !url.pathname.startsWith('/api/'),
  handler: 'NetworkOnly',
  // next-pwa adds its offline fallback plugin to this options object.
  options: {},
}

const brandAssetCaching = {
  urlPattern: ({ url }) =>
    url.origin === self.origin &&
    ['/logo.png', '/pwa-192x192.png', '/pwa-512x512.png', '/apple-icon.png'].includes(url.pathname),
  handler: 'NetworkFirst',
  options: {
    cacheName: 'brand-assets-symbol-v1',
    networkTimeoutSeconds: 3,
    expiration: {
      maxEntries: 8,
      maxAgeSeconds: 7 * 24 * 60 * 60,
    },
  },
}

module.exports = [
  brandAssetCaching,
  ...defaultRuntimeCaching.filter(({ options }) =>
    STATIC_CACHE_NAMES_TO_KEEP.has(options?.cacheName)
  ),
  pageNavigation,
]
