'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

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

async function getVapidPublicKey() {
  const response = await fetch('/api/push/public-key', {
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as { publicKey?: string }
  return payload.publicKey || null
}

async function getReadyServiceWorkerRegistration() {
  const existingRegistration = await navigator.serviceWorker.getRegistration()

  if (existingRegistration?.active) {
    return existingRegistration
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('Service worker was not ready for push subscription.')),
        8000
      )
    }),
  ])
}

export function PushSubscriptionManager() {
  const { data: session, isPending } = authClient.useSession()
  const [showPrompt, setShowPrompt] = useState(false)
  const [isEnabling, setIsEnabling] = useState(false)

  const subscribeToPush = useCallback(async (requestPermission: boolean) => {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return
    }

    try {
      const publicKey = await getVapidPublicKey()

      if (!publicKey) {
        return
      }

      let permission = Notification.permission

      if (permission === 'default' && requestPermission) {
        permission = await Notification.requestPermission()
      }

      if (permission === 'default') {
        setShowPrompt(true)
        return
      }

      if (permission !== 'granted') {
        setShowPrompt(false)
        return
      }

      const registration = await getReadyServiceWorkerRegistration()
      const existingSubscription =
        await registration.pushManager.getSubscription()
      const subscription =
        existingSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }))

      const response = await fetch('/api/push/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })

      if (!response.ok) {
        throw new Error('Failed to save push subscription.')
      }

      setShowPrompt(false)
    } catch (error) {
      console.warn('[Push Subscription Manager]:', error)

      if (Notification.permission === 'granted') {
        setShowPrompt(false)
      }
    }
  }, [])

  useEffect(() => {
    if (isPending || !session?.user?.id) {
      return
    }

    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return
    }

    if (Notification.permission === 'default') {
      setShowPrompt(true)
      return
    }

    if (Notification.permission === 'granted') {
      void subscribeToPush(false)
    }
  }, [isPending, session?.user?.id, subscribeToPush])

  const handleEnableNotifications = async () => {
    setIsEnabling(true)

    try {
      await subscribeToPush(true)
    } finally {
      setIsEnabling(false)
    }
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
              <h2 className="text-sm font-semibold">Turn on notifications</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Get order updates instantly, including new tasks, accepted tasks, and completed orders.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPrompt(false)}
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
              onClick={() => setShowPrompt(false)}
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
