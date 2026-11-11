'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { syncPushSubscriptionWithBackend } from '@/components/PushSubscriptionManager'

export function OrderAlertsToggle({ className = '' }: { className?: string }) {
  const [alertsEnabled, setAlertsEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/taskers/preferences', {
        cache: 'no-store',
      })
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as { orderAlertsEnabled?: boolean }
      setAlertsEnabled(Boolean(data.orderAlertsEnabled))
    } catch {
      // Best-effort load
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPreferences()
  }, [fetchPreferences])

  const handleToggle = async () => {
    if (updating || alertsEnabled === null) return

    const previousState = alertsEnabled
    const nextState = !previousState
    let sentPreferenceUpdate = false

    // Give immediate feedback, but treat browser permission + server response as authoritative.
    setAlertsEnabled(nextState)
    setUpdating(true)

    try {
      if (nextState) {
        const supported = typeof window !== 'undefined' &&
          'Notification' in window &&
          'PushManager' in window &&
          'serviceWorker' in navigator

        if (!supported) {
          const isIos = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
          throw new Error(isIos
            ? 'On iPhone, open SwiftDU in Safari, add it to your Home Screen, and enable notifications from the installed app.'
            : 'This browser cannot receive SwiftDU push notifications. Open SwiftDU in a supported browser.')
        }

        if (Notification.permission === 'denied') {
          throw new Error('Notifications are blocked. Allow SwiftDU notifications in your browser or device settings, then try again.')
        }

        // Permission is requested synchronously from this click before network awaits.
        const subscribed = await syncPushSubscriptionWithBackend(true)
        if (!subscribed) {
          throw new Error(Notification.permission !== 'granted'
            ? 'Notifications were not permitted. Enable notifications for SwiftDU and try again.'
            : 'SwiftDU could not activate push notifications on this device. Please try again.')
        }
      }

      sentPreferenceUpdate = true
      const response = await fetch('/api/taskers/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderAlertsEnabled: nextState }),
      })
      const data = await response.json().catch(() => ({})) as {
        error?: string
        orderAlertsEnabled?: boolean
      }
      if (!response.ok) throw new Error(data.error || 'Failed to update alert preference.')
      if (data.orderAlertsEnabled !== nextState) {
        throw new Error('SwiftDU did not confirm the new alert setting. Please try again.')
      }

      setAlertsEnabled(data.orderAlertsEnabled)
      toast.success(nextState
        ? 'Order alerts enabled. You can receive notifications for eligible tasks.'
        : 'Order alerts paused. You will not receive general new-order notifications.')
    } catch (error) {
      setAlertsEnabled(previousState)
      toast.error(error instanceof Error ? error.message : 'Could not update alert preferences.')
      // A timed-out write could have reached the server. Reconcile with the source of truth.
      if (sentPreferenceUpdate) void fetchPreferences()
    } finally {
      setUpdating(false)
    }
  }

  if (loading && alertsEnabled === null) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          Loading notification preferences...
        </div>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              alertsEnabled
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {alertsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Available for Order Alerts
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  alertsEnabled
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {updating ? (alertsEnabled ? 'ENABLING...' : 'DISABLING...') : alertsEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {updating
                ? 'Saving your notification preference...'
                : alertsEnabled
                  ? 'Receive eligible order notifications, even when the website is closed.'
                  : 'Do not receive general new-order push notifications.'}
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(alertsEnabled)}
          aria-label="Toggle availability for order alerts"
          aria-busy={updating}
          onClick={handleToggle}
          disabled={updating || alertsEnabled === null}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:opacity-50 ${
            alertsEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out dark:bg-slate-100 ${
              alertsEnabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        <Info className="h-4 w-4 shrink-0 text-violet-500" />
        <span>
          <strong>How it works:</strong> Enabling alerts lets SwiftDU notify you about tasks matching your gender and mode. To accept and deliver an errand, you must still check in.
        </span>
      </div>
    </div>
  )
}
