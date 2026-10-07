'use client'

import { useEffect } from 'react'

// Production PWA testing should use a separate localhost port/browser profile.
export function DevelopmentWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !('serviceWorker' in navigator)) return
    if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return
    const knownWorker = (url: string) => {
      const parsed = new URL(url)
      return parsed.origin === location.origin && ['/sw.js', '/service-worker.js'].includes(parsed.pathname)
    }
    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      const controlled = navigator.serviceWorker.controller
      let removed = false
      for (const registration of registrations) {
        const worker = registration.active || registration.waiting || registration.installing
        if (registration.scope === location.origin + '/' && worker && knownWorker(worker.scriptURL)) {
          removed = (await registration.unregister()) || removed
        }
      }
      // Unregister alone does not release an already controlled development tab.
      if (removed && controlled && knownWorker(controlled.scriptURL)) location.reload()
    }).catch((error) => console.warn('[SwiftDU development worker cleanup]', error))
  }, [])
  return null
}
