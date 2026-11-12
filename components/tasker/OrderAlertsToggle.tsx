'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPushSetupState,
  isPushSetupComplete,
  ORDER_ALERTS_CHANGED_EVENT,
  syncPushSubscription,
  type PushSetupState,
} from '@/components/PushSubscriptionManager'

type OrderAlertsToggleProps = {
  className?: string
  mode?: 'onboarding' | 'settings'
}

const EMPTY_SETUP: PushSetupState = {
  supported: true,
  permission: 'default',
  hasBrowserSubscription: false,
  hasBackendSubscription: false,
}

function setupProblem(setup: PushSetupState) {
  if (!setup.supported) return 'This browser does not support push notifications. Try an up-to-date version of Chrome, Edge, or Safari.'
  if (setup.permission === 'denied') return 'Notifications are blocked. Open this site’s browser settings, allow notifications, then retry.'
  if (setup.permission !== 'granted') return 'Enable notifications to receive new task alerts on this device.'
  if (!setup.hasBrowserSubscription) return 'This browser is not currently subscribed. Tap the switch to repair notification setup.'
  if (!setup.hasBackendSubscription) return 'This device needs to be reconnected to SwiftDU. Tap the switch to repair it.'
  return null
}

export function OrderAlertsToggle({ className = '', mode = 'settings' }: OrderAlertsToggleProps) {
  const onboarding = mode === 'onboarding'
  const [alertsEnabled, setAlertsEnabled] = useState<boolean | null>(null)
  const [setup, setSetup] = useState<PushSetupState>(EMPTY_SETUP)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const [response, currentSetup] = await Promise.all([
        fetch('/api/taskers/preferences', { cache: 'no-store' }),
        getPushSetupState(),
      ])
      if (!response.ok) throw new Error('Could not load notification preferences.')
      const data = (await response.json()) as { orderAlertsEnabled?: boolean }
      setAlertsEnabled(data.orderAlertsEnabled === true)
      setSetup(currentSetup)
      setError(null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load notification settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchState()
    const reconcile = () => void fetchState()
    window.addEventListener(ORDER_ALERTS_CHANGED_EVENT, reconcile)
    return () => window.removeEventListener(ORDER_ALERTS_CHANGED_EVENT, reconcile)
  }, [fetchState])

  const configured = isPushSetupComplete(alertsEnabled === true, setup)

  const handleToggle = async () => {
    if (updating || alertsEnabled === null) return
    const previous = alertsEnabled
    const nextState = onboarding ? true : !alertsEnabled
    setAlertsEnabled(nextState)
    setUpdating(true)
    setError(null)

    try {
      if (nextState) {
        const result = await syncPushSubscription(true)
        if (!result.ok) throw new Error(result.message || 'Could not enable notifications.')
      }

      const response = await fetch('/api/taskers/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderAlertsEnabled: nextState }),
      })
      const data = await response.json().catch(() => ({})) as { error?: string; orderAlertsEnabled?: boolean }
      if (!response.ok || data.orderAlertsEnabled !== nextState) {
        throw new Error(data.error || 'Failed to update alert preference.')
      }

      const currentSetup = await getPushSetupState()
      if (nextState && !isPushSetupComplete(true, currentSetup)) {
        throw new Error('Notification setup could not be verified. Please try again.')
      }
      setSetup(currentSetup)
      setAlertsEnabled(nextState)
      window.dispatchEvent(new CustomEvent(ORDER_ALERTS_CHANGED_EVENT, { detail: { enabled: nextState } }))
      toast.success(nextState ? 'Order alerts are enabled on this device.' : 'Order alerts are paused. You can enable them again at any time.')
    } catch (toggleError) {
      setAlertsEnabled(previous)
      const message = toggleError instanceof Error ? toggleError.message : 'Could not update alert preferences.'
      setError(message)
      toast.error(message)
    } finally {
      setUpdating(false)
    }
  }

  if (onboarding && (loading || configured)) return null

  if (loading && alertsEnabled === null) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-slate-400" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          Loading notification preferences...
        </div>
      </div>
    )
  }

  const switchEnabled = onboarding ? updating || configured : alertsEnabled === true
  const problem = error || (alertsEnabled ? setupProblem(setup) : null)

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${switchEnabled ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
            {switchEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Available for Order Alerts</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${switchEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {updating ? 'ENABLING' : switchEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {onboarding ? 'Turn on push notifications for eligible new tasks on this device.' : alertsEnabled ? 'Order alerts are enabled in your SwiftDU preferences.' : 'General new-order alerts are paused.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={switchEnabled}
          aria-label={onboarding ? 'Enable order alerts' : 'Toggle availability for order alerts'}
          onClick={() => void handleToggle()}
          disabled={updating || alertsEnabled === null}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 disabled:cursor-not-allowed disabled:opacity-60 ${switchEnabled ? 'bg-violet-600' : 'bg-slate-300 dark:bg-slate-700'}`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ${switchEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      {problem ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">{problem}</p> : null}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
        <Info className="h-4 w-4 shrink-0 text-violet-500" />
        <span><strong>How it works:</strong> Alerts can notify you about matching tasks, but you must still check in before accepting one.</span>
      </div>
    </div>
  )
}
