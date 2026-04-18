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

const publicPageCaching = {
  urlPattern: ({ request, url }) => {
    if (request.mode !== 'navigate') return false
    if (self.origin !== url.origin) return false

    const pathname = url.pathname

    if (
      pathname.startsWith('/api/') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/tasker-dashboard')
    ) {
      return false
    }

    return true
  },
  handler: 'NetworkFirst',
  options: {
    cacheName: 'public-pages',
    expiration: {
      maxEntries: 32,
      maxAgeSeconds: 24 * 60 * 60,
    },
    networkTimeoutSeconds: 10,
  },
}

module.exports = [
  ...defaultRuntimeCaching.filter(({ options }) =>
    STATIC_CACHE_NAMES_TO_KEEP.has(options?.cacheName)
  ),
  publicPageCaching,
]
