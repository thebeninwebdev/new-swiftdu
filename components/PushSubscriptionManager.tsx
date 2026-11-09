'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

import { authClient } from '@/lib/auth-client'

const DISMISSAL_KEY = 'swiftdu_push_prompt_dismissed_at'
const DISMISSAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

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
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return false
  }

  try {
    const publicKey = await getVapidPublicKey()
    if (!publicKey) {
      console.warn('[SwiftDU Push] VAPID public key unavailable')
      return false
    }

    let permission = Notification.permission
    if (permission === 'default' && requestPermission) {
      permission = await Notification.requestPermission()
    }

    if (permission !== 'granted') {
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

export function PushSubscriptionManager() {
  const { data: session, isPending } = authClient.useSession()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isEnabling, setIsEnabling] = useState(false)

  const checkAndSync = useCallback(async () => {
    if (isPending || !session?.user?.id) return
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return
    }

    const permission = Notification.permission

    if (permission === 'denied') {
      setShowPrompt(false)
      return
    }

    if (permission === 'granted') {
      setShowPrompt(false)
      void syncPushSubscriptionWithBackend(false)
      return
    }

    // Permission is 'default' - check if user recently dismissed
    const dismissedAt = localStorage.getItem(DISMISSAL_KEY)
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt)
      if (elapsed < DISMISSAL_DURATION_MS) {
        setShowPrompt(false)
        return
      }
    }

    setShowPrompt(true)
  }, [isPending, session?.user?.id])

  useEffect(() => {
    void checkAndSync()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkAndSync()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [checkAndSync])

  const handleEnableNotifications = async () => {
    setIsEnabling(true)
    try {
      const ok = await syncPushSubscriptionWithBackend(true)
      if (ok) {
        setShowPrompt(false)
      }
    } finally {
      setIsEnabling(false)
    }
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSAL_KEY, Date.now().toString())
    } catch {
      // Ignore storage errors
    }
    setShowPrompt(false)
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-[100] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20 sm:bottom-6 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Turn on tasker notifications</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Get new SwiftDU task alerts instantly on this device, even when the browser is closed.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              aria-label="Dismiss notification prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleEnableNotifications}
              disabled={isEnabling}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {isEnabling ? 'Enabling...' : 'Enable notifications'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
