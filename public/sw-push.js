const SWIFTDU_NOTIFICATION_ICON = '/pwa-512x512.png'
const SWIFTDU_NOTIFICATION_BADGE = '/pwa-192x192.png'
const SWIFTDU_NOTIFICATION_IMAGE = '/logo.png?v=20260826'

function getNotificationAssetUrl(path) {
  return new URL(path, self.location.origin).href
}

function showSwiftDUNotification(payload) {
  const title = payload.title || 'SwiftDU'
  const options = {
    body: payload.body || 'You have a new update.',
    icon: getNotificationAssetUrl(payload.icon || SWIFTDU_NOTIFICATION_ICON),
    badge: getNotificationAssetUrl(payload.badge || SWIFTDU_NOTIFICATION_BADGE),
    image: getNotificationAssetUrl(payload.image || SWIFTDU_NOTIFICATION_IMAGE),
    tag: payload.tag || 'swiftdu-update',
    data: {
      url: payload.url || '/tasker-dashboard',
    },
  }

  return self.registration
    .showNotification(title, options)
    .then(() => {
      console.log('[SwiftDU SW] notification displayed', {
        title,
        url: options.data.url,
      })
    })
    .catch((error) => {
      console.error('[SwiftDU SW] notification display failed', error)
      throw error
    })
}

self.addEventListener('push', (event) => {
  console.log('[SwiftDU SW] push received')

  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch (error) {
    console.warn('[SwiftDU SW] push payload parse failed', error)
    payload = {}
  }

  event.waitUntil(showSwiftDUNotification(payload))
})

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'SWIFTDU_SHOW_TEST_NOTIFICATION') {
    return
  }

  console.log('[SwiftDU SW] local notification test received')
  event.waitUntil(
    showSwiftDUNotification({
      title: 'Swift DU Local Test',
      body: 'Firefox can display notifications from this service worker.',
      url: '/tasker-dashboard',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  console.log('[SwiftDU SW] notification clicked')
  event.notification.close()

  const targetUrl = new URL(
    event.notification.data?.url || '/tasker-dashboard',
    self.location.origin
  ).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus()
          }
        }

        return self.clients.openWindow(targetUrl)
      })
  )
})
