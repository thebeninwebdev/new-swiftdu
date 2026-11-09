'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Download, Smartphone, X } from 'lucide-react'
import { usePwaInstall } from '@/components/PwaInstallProvider'

const DISMISSAL_KEY = 'swiftdu_tasker_pwa_dismissed_at'
const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function TaskerPwaPrompt({ className = '' }: { className?: string }) {
  const {
    fallbackInstructions,
    install,
    isInstalled,
    isInstalling,
    isInstallPromptAvailable,
    platform,
  } = usePwaInstall()

  const [dismissed, setDismissed] = useState(true)
  const [showInstructions, setShowInstructions] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    if (isInstalled) {
      setDismissed(true)
      return
    }

    try {
      const saved = localStorage.getItem(DISMISSAL_KEY)
      if (saved) {
        const elapsed = Date.now() - Number(saved)
        if (elapsed < DISMISSAL_DURATION_MS) {
          setDismissed(true)
          return
        }
      }
      setDismissed(false)
    } catch {
      setDismissed(false)
    }
  }, [isInstalled])

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSAL_KEY, Date.now().toString())
    } catch {
      // Ignore
    }
    setDismissed(true)
  }

  const handleInstallClick = async () => {
    if (isInstallPromptAvailable) {
      const outcome = await install()
      if (outcome === 'accepted') {
        setJustInstalled(true)
      } else if (outcome !== 'installed') {
        setShowInstructions(true)
      }
    } else {
      setShowInstructions(true)
    }
  }

  if (dismissed && !showInstructions && !justInstalled) {
    return null
  }

  if (justInstalled) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100 ${className}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold">SwiftDU installed successfully!</h3>
            <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-200">
              You can now launch SwiftDU from your home screen. Make sure to enable &ldquo;Available for Order Alerts&rdquo; below so you receive task alerts even when the app is closed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setJustInstalled(false)}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900"
            aria-label="Dismiss message"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`relative rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/70 to-indigo-50/50 p-4 shadow-sm dark:border-violet-900/40 dark:from-slate-900 dark:to-violet-950/30 ${className}`}>
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Install SwiftDU on your phone
              </h3>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Dismiss installation prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Get an app-like experience with quick home-screen access. (Web push works directly in supported browsers, but installing makes managing deliveries faster).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                disabled={isInstalling}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                {isInstallPromptAvailable ? 'Install App' : 'How to Install'}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>

      {showInstructions ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/50 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-white">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="pwa-install-title" className="font-bold text-base">
                      Install SwiftDU ({platform.toUpperCase()})
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {fallbackInstructions}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstructions(false)}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                    aria-label="Close instructions"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInstructions(false)}
                    className="h-10 flex-1 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
