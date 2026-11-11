'use client'

import { useCallback, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}

function arrayBufferEquals(left: ArrayBuffer | null, right: Uint8Array) {
  if (!left || left.byteLength !== right.byteLength) {
    return false
  }

  const leftView = new Uint8Array(left)

  for (let index = 0; index < leftView.length; index += 1) {
    if (leftView[index] !== right[index]) {
      return false
    }
  }

  return true
}

export async function getVapidPublicKey() {
  try {
    const response = await fetch('/api/push/public-key', {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as { publicKey?: string }
    return payload.publicKey || null
  } catch {
    return null
  }
}

export async function getReadyServiceWorkerRegistration() {
  const expectedWorkerPath = '/sw.js'
  const expectedWorkerUrl = new URL(expectedWorkerPath, window.location.origin).href
  let existingRegistration = await navigator.serviceWorker.getRegistration()

  if (
    existingRegistration &&
    existingRegistration.active?.scriptURL !== expectedWorkerUrl
  ) {
    // Update in place: unregistering can discard an existing push subscription.
    existingRegistration = await navigator.serviceWorker.register(expectedWorkerPath, {
      scope: '/',
      updateViaCache: 'none',
    })
  }

  if (!existingRegistration) {
    try {
      existingRegistration = await navigator.serviceWorker.register(expectedWorkerPath, {
        scope: '/',
        updateViaCache: 'none',
      })
      console.info('[SwiftDU Push] service worker registered', {
        scriptURL: existingRegistration.active?.scriptURL,
      })
    } catch (error) {
      throw new Error(
        `Service worker registration failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      )
    }
  } else {
    console.info('[SwiftDU Push] service worker registered', {
      scriptURL: existingRegistration.active?.scriptURL,
      reused: true,
    })
  }

  if (existingRegistration) {
    await existingRegistration.update().catch(() => {})
  }

  const readyRegistration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('Service worker was not ready for push subscription.')),
        8000
      )
    }),
  ])

  console.info('[SwiftDU Push] service worker ready', {
    scriptURL: readyRegistration.active?.scriptURL,
  })

  return readyRegistration
}

/**
 * Synchronize or renew current browser push subscription with SwiftDU backend.
 */
export async function syncPushSubscriptionWithBackend(requestPermission = false): Promise<boolean> {
  // Service workers are deliberately disabled in local development.
  if (process.env.NODE_ENV !== 'production') return false
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return false
  }

  try {
    // Ask while the click's user activation is still available (especially on iOS).
    // Fetching the VAPID key before requestPermission may lose that activation.
    let permission = Notification.permission
    if (permission === 'default' && requestPermission) {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') return false

    const publicKey = await getVapidPublicKey()
    if (!publicKey) {
      console.warn('[SwiftDU Push] VAPID public key unavailable')
      return false
    }

    const registration = await getReadyServiceWorkerRegistration()
    const applicationServerKey = urlBase64ToUint8Array(publicKey)
    let existingSubscription = await registration.pushManager.getSubscription()

    // If subscription exists but key is different or near expiration, renew
    if (
      existingSubscription &&
      !arrayBufferEquals(
        existingSubscription.options.applicationServerKey,
        applicationServerKey
      )
    ) {
      await existingSubscription.unsubscribe().catch(() => {})
      existingSubscription = null
    }

    const subscription =
      existingSubscription &&
      arrayBufferEquals(
        existingSubscription.options.applicationServerKey,
        applicationServerKey
      )
        ? existingSubscription
        : await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          })

    // Synchronize with backend (restoring missing backend record if deleted or renewing)
    const response = await fetch('/api/push/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    })

    if (!response.ok) {
      throw new Error(`Failed to save push subscription: ${response.status}`)
    }

    console.info('[SwiftDU Push] subscription synchronized with backend')
    return true
  } catch (error) {
    console.warn('[SwiftDU Push Sync Error]:', error)
    return false
  }
}

/**
 * Headless synchronization for taskers who have ALREADY granted notifications.
 * The dashboard's OrderAlertsToggle is the only permission/onboarding UI.
 * Never prompt automatically when the dashboard mounts or regains focus.
 */
export function PushSubscriptionManager() {
  const { data: session, isPending } = authClient.useSession()

  const syncGrantedSubscription = useCallback(async () => {
    if (isPending || !session?.user?.id || typeof window === 'undefined') return false
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    return syncPushSubscriptionWithBackend(false)
  }, [isPending, session?.user?.id])

  useEffect(() => {
    if (isPending || !session?.user?.id) return

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void syncGrantedSubscription()
    }

    // Restore subscriptions after browser storage/server record changes, without a UI prompt.
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [isPending, session?.user?.id, syncGrantedSubscription])

  return null
}
