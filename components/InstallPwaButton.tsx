'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

import { usePwaInstall } from '@/components/PwaInstallProvider'

export default function InstallPwaButton({ variant = 'cta' }: { variant?: 'cta' | 'menu' }) {
  const {
    fallbackInstructions,
    install,
    isInstalled,
    isInstalling,
    isInstallPromptAvailable,
  } = usePwaInstall()
  const [showHelp, setShowHelp] = useState(false)

  if (isInstalled) return null

  const handleInstall = async () => {
    if (!isInstallPromptAvailable) {
      setShowHelp((current) => !current)
      return
    }

    const outcome = await install()
    setShowHelp(outcome !== 'accepted')
  }

  const menuStyle = variant === 'menu'

  return (
    <div className={menuStyle ? 'w-full' : 'flex max-w-md flex-col items-center gap-3 text-center lg:items-start lg:text-left'}>
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={isInstalling}
        className={menuStyle
          ? 'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
          : 'inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60'}
      >
        <Download className="h-4 w-4" />
        {isInstalling ? 'Opening prompt...' : menuStyle ? 'Install SwiftDU' : 'Install SwiftDU app'}
      </button>
      {showHelp ? (
        <p role="status" className={menuStyle ? 'px-4 pb-2 text-xs leading-5 text-slate-600 dark:text-slate-300' : 'text-sm leading-6 text-gray-500'}>{fallbackInstructions}</p>
      ) : null}
    </div>
  )
}
