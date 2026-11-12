'use client'

import { useCallback, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

export const ORDER_ALERTS_CHANGED_EVENT = 'swiftdu-order-alerts-changed'

export type PushSyncResult = {
  ok: boolean
  message?: string
}

export type PushSetupState = {
  supported: boolean
  permission: NotificationPermission | 'unsupported'
  hasBrowserSubscription: boolean
  hasBackendSubscription: boolean
}
export function isPushSetupComplete(preferenceEnabled: boolean, setup: PushSetupState) {
  return preferenceEnabled && setup.permission === 'granted' && setup.hasBrowserSubscription && setup.hasBackendSubscription
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let index = 0; index < rawData.length; index += 1) outputArray[index] = rawData.charCodeAt(index)
  return outputArray
}

function arrayBufferEquals(left: ArrayBuffer | null, right: Uint8Array) {
  if (!left || left.byteLength !== right.byteLength) return false
  const leftView = new Uint8Array(left)
  return leftView.every((value, index) => value === right[index])
}

function supportsPush() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getVapidPublicKey() {
  try {
    const response = await fetch('/api/push/public-key', { cache: 'no-store' })
    if (!response.ok) return null
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

  if (existingRegistration && existingRegistration.active?.scriptURL !== expectedWorkerUrl) {
    existingRegistration = await navigator.serviceWorker.register(expectedWorkerPath, { scope: '/', updateViaCache: 'none' })
  }
  if (!existingRegistration) {
    existingRegistration = await navigator.serviceWorker.register(expectedWorkerPath, { scope: '/', updateViaCache: 'none' })
  }
  await existingRegistration.update().catch(() => {})

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('Service worker was not ready for push subscription.')), 8000)
    }),
  ])
}

export async function syncPushSubscription(requestPermission = false): Promise<PushSyncResult> {
  if (!supportsPush()) {
    return { ok: false, message: 'Push notifications are not supported in this browser. Try an up-to-date version of Chrome, Edge, or Safari.' }
  }

  try {
    let permission = Notification.permission
    if (permission === 'default' && requestPermission) permission = await Notification.requestPermission()
    if (permission === 'denied') {
      return { ok: false, message: 'Notifications are blocked. Open this site’s browser settings, allow notifications, then try again.' }
    }
    if (permission !== 'granted') {
      return { ok: false, message: 'Notification permission was not granted. Tap the switch when you are ready to allow alerts.' }
    }

    const publicKey = await getVapidPublicKey()
    if (!publicKey) return { ok: false, message: 'Notification setup is temporarily unavailable. Please try again.' }

    const registration = await getReadyServiceWorkerRegistration()
    const applicationServerKey = urlBase64ToUint8Array(publicKey)
    let subscription = await registration.pushManager.getSubscription()
    if (subscription && !arrayBufferEquals(subscription.options.applicationServerKey, applicationServerKey)) {
      await subscription.unsubscribe().catch(() => {})
      subscription = null
    }
    subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })

    // Preserve local PWA development without persisting test endpoints.
    if (process.env.NODE_ENV === 'development') return { ok: true }

    const response = await fetch('/api/push/save-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    })
    if (!response.ok) return { ok: false, message: 'SwiftDU could not save this device for notifications. Please try again.' }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not enable notifications on this device.',
    }
  }
}

/** Kept as the boolean compatibility wrapper used by existing background sync tests. */
export async function syncPushSubscriptionWithBackend(requestPermission = false): Promise<boolean> {
  return (await syncPushSubscription(requestPermission)).ok
}

export async function getPushSetupState(): Promise<PushSetupState> {
  if (!supportsPush()) {
    return { supported: false, permission: 'unsupported', hasBrowserSubscription: false, hasBackendSubscription: false }
  }

  const permission = Notification.permission
  if (permission !== 'granted') {
    return { supported: true, permission, hasBrowserSubscription: false, hasBackendSubscription: false }
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) {
      return { supported: true, permission, hasBrowserSubscription: false, hasBackendSubscription: false }
    }
    const response = await fetch('/api/push/subscriptions', {
      cache: 'no-store',
      headers: { 'X-SwiftDU-Push-Endpoint': subscription.endpoint },
    })
    const payload = response.ok ? await response.json() as { hasCurrentSubscription?: boolean } : null
    return {
      supported: true,
      permission,
      hasBrowserSubscription: true,
      hasBackendSubscription: payload?.hasCurrentSubscription === true,
    }
  } catch {
    return { supported: true, permission, hasBrowserSubscription: false, hasBackendSubscription: false }
  }
}

/** Silently repairs existing granted subscriptions; it never renders onboarding UI. */
export function PushSubscriptionManager() {
  const { data: session, isPending } = authClient.useSession()
  const checkAndSync = useCallback(async (requestPermission = false) => {
    if (isPending || !session?.user?.id || !supportsPush()) return false
    if (Notification.permission !== 'granted' && !requestPermission) return false
    const synced = await syncPushSubscriptionWithBackend(requestPermission)
    if (synced && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new Event(ORDER_ALERTS_CHANGED_EVENT))
    }
    return synced
  }, [isPending, session?.user?.id])

  useEffect(() => {
    void checkAndSync(false)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void checkAndSync(false)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [checkAndSync])

  return null
}
