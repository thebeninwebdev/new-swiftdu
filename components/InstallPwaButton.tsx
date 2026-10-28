'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

import { usePwaInstall } from '@/components/PwaInstallProvider'

export default function InstallPwaButton() {
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

  return (
    <div className="flex max-w-md flex-col items-center gap-3 text-center lg:items-start lg:text-left">
      <button
        type="button"
        onClick={() => void handleInstall()}
        disabled={isInstalling}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="h-4 w-4" />
        {isInstalling ? 'Opening prompt...' : 'Install SwiftDU app'}
      </button>
      {showHelp ? (
        <p className="text-sm leading-6 text-gray-500">{fallbackInstructions}</p>
      ) : null}
    </div>
  )
}
