'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

const SESSION_DISMISS_KEY = 'swiftdu-install-prompt-dismissed'

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIosDevice() {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const touchMac =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1

  return /iphone|ipad|ipod/.test(userAgent) || touchMac
}

export function AppInstallPromptManager() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    if (isStandaloneMode()) {
      return
    }

    if (window.sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true') {
      return
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    const handleAppInstalled = () => {
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    if (isIosDevice()) {
      const timeoutId = window.setTimeout(() => setShowPrompt(true), 1500)

      return () => {
        window.clearTimeout(timeoutId)
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('appinstalled', handleAppInstalled)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const dismiss = () => {
    setShowPrompt(false)
    window.sessionStorage.setItem(SESSION_DISMISS_KEY, 'true')
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowIosHelp(true)
      return
    }

    setIsInstalling(true)

    try {
      await deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice

      if (result.outcome === 'accepted') {
        setShowPrompt(false)
      } else {
        setShowIosHelp(true)
      }
    } finally {
      setDeferredPrompt(null)
      setIsInstalling(false)
    }
  }

  if (!showPrompt) {
    return null
  }

  return (
    <div className="fixed inset-x-3 bottom-4 z-[90] mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20 sm:bottom-6 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Install Swiftdu</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Add the app to your device for faster access and better order updates.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {showIosHelp ? (
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              Use your browser menu to install Swiftdu. On iPhone or iPad, tap Share, then Add to Home Screen.
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              disabled={isInstalling}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              {isInstalling ? 'Opening...' : 'Install app'}
            </button>
            <button
              type="button"
              onClick={dismiss}
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
