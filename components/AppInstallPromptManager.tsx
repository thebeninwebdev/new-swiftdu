'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

import { usePwaInstall } from '@/components/PwaInstallProvider'
import { authClient } from '@/lib/auth-client'
import {
  CUSTOMER_INSTALL_SUGGESTION_KEY,
  shouldShowCustomerInstallSuggestion,
} from '@/lib/pwa-install'

export function AppInstallPromptManager() {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const {
    fallbackInstructions,
    install,
    isInstalled,
    isInstalling,
    isReady,
  } = usePwaInstall()
  const [showPrompt, setShowPrompt] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const isTasker = session?.user?.role === 'tasker'
  const isEligibleCustomer = isReady && !sessionPending && !isInstalled && !isTasker

  useEffect(() => {
    if (!isEligibleCustomer) return

    let lastShown: string | null = null
    try {
      lastShown = window.localStorage.getItem(CUSTOMER_INSTALL_SUGGESTION_KEY)
    } catch {
      // Without durable storage we cannot guarantee the seven-day limit.
      return
    }
    if (!shouldShowCustomerInstallSuggestion(lastShown)) return

    const timeoutId = window.setTimeout(() => {
      try {
        const latest = window.localStorage.getItem(CUSTOMER_INSTALL_SUGGESTION_KEY)
        if (!shouldShowCustomerInstallSuggestion(latest)) return
        window.localStorage.setItem(CUSTOMER_INSTALL_SUGGESTION_KEY, String(Date.now()))
      } catch {
        return
      }
      setShowPrompt(true)
    }, 1500)

    const handleStorage = (event: StorageEvent) => {
      if (event.key === CUSTOMER_INSTALL_SUGGESTION_KEY && event.newValue) {
        setShowPrompt(false)
      }
    }
    window.addEventListener('storage', handleStorage)

    return () => {
      window.clearTimeout(timeoutId)
      window.removeEventListener('storage', handleStorage)
    }
  }, [isEligibleCustomer])

  const dismiss = () => setShowPrompt(false)

  const handleInstall = async () => {
    const outcome = await install()
    if (outcome === 'accepted' || outcome === 'installed') {
      setShowPrompt(false)
      return
    }
    setShowHelp(true)
  }

  if (!showPrompt || !isEligibleCustomer) return null

  return (
    <div className="fixed inset-x-3 bottom-4 z-[90] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20 sm:bottom-6 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Install SwiftDU</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Add SwiftDU to your device for faster access and better order updates.
              </p>
            </div>
            <button type="button" onClick={dismiss} className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200" aria-label="Dismiss install suggestion">
              <X className="h-4 w-4" />
            </button>
          </div>
          {showHelp ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {fallbackInstructions}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void handleInstall()} disabled={isInstalling} className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100">
              {isInstalling ? 'Opening...' : 'Install app'}
            </button>
            <button type="button" onClick={dismiss} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
