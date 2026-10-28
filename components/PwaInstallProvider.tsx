'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

export type PwaInstallPlatform = 'ios' | 'android' | 'desktop'
export type PwaInstallOutcome =
  | 'accepted'
  | 'dismissed'
  | 'unavailable'
  | 'installed'
  | 'error'

interface PwaInstallContextValue {
  isReady: boolean
  isInstalled: boolean
  isIos: boolean
  platform: PwaInstallPlatform
  isInstallPromptAvailable: boolean
  isInstalling: boolean
  fallbackInstructions: string
  install: () => Promise<PwaInstallOutcome>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

function getPlatform(): PwaInstallPlatform {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const touchMac =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1

  if (/iphone|ipad|ipod/.test(userAgent) || touchMac) return 'ios'
  if (/android/.test(userAgent)) return 'android'
  return 'desktop'
}

function getFallbackInstructions(platform: PwaInstallPlatform) {
  if (platform === 'ios') {
    return 'Tap the Share button in your browser, then choose Add to Home Screen. If that option is unavailable, open SwiftDU in Safari and try again.'
  }

  if (platform === 'android') {
    return 'Open your browser menu, then choose Install app or Add to Home screen. If that option is missing, open SwiftDU in Chrome and try again.'
  }

  return 'Use the install icon in your browser address bar, or choose Install app from its menu. In Safari on Mac, choose File, then Add to Dock. If no install option is available, use a supported browser or bookmark SwiftDU.'
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [platform, setPlatform] = useState<PwaInstallPlatform>('desktop')
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    const updateInstalledState = () => setIsInstalled(isStandaloneMode())
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setIsInstalling(false)
    }

    setPlatform(getPlatform())
    updateInstalledState()
    setIsReady(true)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeQuery.addEventListener?.('change', updateInstalledState)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayModeQuery.removeEventListener?.('change', updateInstalledState)
    }
  }, [])

  const install = useCallback(async (): Promise<PwaInstallOutcome> => {
    if (isInstalled) return 'installed'
    if (!deferredPrompt) return 'unavailable'

    setIsInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return choice.outcome
    } catch {
      setDeferredPrompt(null)
      return 'error'
    } finally {
      setIsInstalling(false)
    }
  }, [deferredPrompt, isInstalled])

  const value = useMemo<PwaInstallContextValue>(() => ({
    isReady,
    isInstalled,
    isIos: platform === 'ios',
    platform,
    isInstallPromptAvailable: deferredPrompt !== null,
    isInstalling,
    fallbackInstructions: getFallbackInstructions(platform),
    install,
  }), [deferredPrompt, install, isInstalled, isInstalling, isReady, platform])

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
    </PwaInstallContext.Provider>
  )
}

export function usePwaInstall() {
  const context = useContext(PwaInstallContext)
  if (!context) throw new Error('usePwaInstall must be used within PwaInstallProvider')
  return context
}
