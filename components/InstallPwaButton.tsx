'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

function isStandaloneMode() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function isIosDevice() {
  if (typeof window === 'undefined') {
    return false
  }

  const userAgent = window.navigator.userAgent.toLowerCase()
  const touchMac =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1

  return /iphone|ipad|ipod/.test(userAgent) || touchMac
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    const updateInstalledState = () => {
      setIsInstalled(isStandaloneMode())
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      setShowHelp(false)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setShowHelp(false)
    }

    updateInstalledState()

    const displayModeQuery = window.matchMedia('(display-mode: standalone)')

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeQuery.addEventListener?.('change', updateInstalledState)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayModeQuery.removeEventListener?.('change', updateInstalledState)
    }
  }, [])

  if (isInstalled) {
    return null
  }

  const fallbackText = isIosDevice()
    ? 'On iPhone or iPad, tap Share, then choose Add to Home Screen.'
    : 'If the install prompt does not appear, open your browser menu and choose Install app.'

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowHelp((currentValue) => !currentValue)
      return
    }

    setIsInstalling(true)

    try {
      await deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice

      if (result.outcome === 'dismissed') {
        setShowHelp(true)
      }
    } finally {
      setDeferredPrompt(null)
      setIsInstalling(false)
    }
  }

  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center lg:items-start lg:text-left">
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100"
      >
        <Download className="h-4 w-4" />
        {deferredPrompt ? (isInstalling ? 'Opening prompt...' : 'Install Swiftdu app') : 'Install Swiftdu app'}
      </button>
      {showHelp ? (
        <p className="text-sm leading-6 text-gray-500">
          {fallbackText}
        </p>
      ) : null}
    </div>
  )
}
