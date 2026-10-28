'use client'

import { useState } from 'react'
import { CheckCircle2, Download, X } from 'lucide-react'

import { usePwaInstall } from '@/components/PwaInstallProvider'

export function TaskerInstallPwaAction({ compact = false }: { compact?: boolean }) {
  const {
    fallbackInstructions,
    install,
    isInstalled,
    isInstalling,
    isInstallPromptAvailable,
  } = usePwaInstall()
  const [showHelp, setShowHelp] = useState(false)

  const handleInstall = async () => {
    if (isInstalled || !isInstallPromptAvailable) {
      setShowHelp(true)
      return
    }

    const outcome = await install()
    setShowHelp(outcome !== 'accepted')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={isInstalling}
        className={compact
          ? 'flex min-h-14 w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 text-left text-sm font-medium disabled:opacity-60 dark:bg-slate-900'
          : 'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-600 transition-all duration-300 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}
      >
        <Download className="h-5 w-5 shrink-0" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Install SwiftDU</span>
          {!compact ? (
            <span className="block truncate text-xs text-slate-400">
              {isInstalled ? 'Installed on this device' : 'Add SwiftDU to your device'}
            </span>
          ) : null}
        </span>
      </button>

      {showHelp ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tasker-install-title">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-white">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {isInstalled ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="tasker-install-title" className="font-bold">
                      {isInstalled ? 'SwiftDU is installed' : 'Install SwiftDU'}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {isInstalled
                        ? 'Open SwiftDU from your home screen, app launcher, or desktop.'
                        : fallbackInstructions}
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowHelp(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Close install instructions">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <button type="button" onClick={() => setShowHelp(false)} className="mt-5 h-11 w-full rounded-2xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700">
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
