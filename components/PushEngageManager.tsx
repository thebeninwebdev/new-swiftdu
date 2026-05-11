'use client'

import { useEffect } from 'react'

import { authClient } from '@/lib/auth-client'

const PUSHENGAGE_APP_ID =
  process.env.NEXT_PUBLIC_PUSHENGAGE_APP_ID ||
  'f2aeb4c8-3643-4a2e-a58e-41e09f5ab63a'
const TASKER_SEGMENT =
  process.env.NEXT_PUBLIC_PUSHENGAGE_TASKER_SEGMENT || 'Taskers'

declare global {
  interface Window {
    PushEngage?: unknown[]
    _peq?: unknown[]
    __swiftduPushEngageInitialized?: boolean
  }
}

function loadPushEngageSdk() {
  if (!PUSHENGAGE_APP_ID || typeof window === 'undefined') {
    return
  }

  window.PushEngage = window.PushEngage || []
  window._peq = window._peq || []

  if (!window.__swiftduPushEngageInitialized) {
    window.__swiftduPushEngageInitialized = true
    window.PushEngage.push([
      'init',
      {
        appId: PUSHENGAGE_APP_ID,
      },
    ])
  }

  if (
    document.querySelector(
      'script[src="https://clientcdn.pushengage.com/sdks/pushengage-web-sdk.js"]'
    )
  ) {
    return
  }

  const script = document.createElement('script')
  script.src = 'https://clientcdn.pushengage.com/sdks/pushengage-web-sdk.js'
  script.async = true
  script.type = 'text/javascript'
  script.dataset.swiftduPushengage = 'true'
  document.head.appendChild(script)
}

export function PushEngageManager() {
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    loadPushEngageSdk()
  }, [])

  useEffect(() => {
    if (isPending || !session?.user?.id || typeof window === 'undefined') {
      return
    }

    window._peq = window._peq || []

    const isTasker = session.user.role === 'tasker' || Boolean(session.user.taskerId)

    if (isTasker) {
      window._peq.push(['add-to-segment', TASKER_SEGMENT])
    }
  }, [isPending, session?.user?.id, session?.user?.role, session?.user?.taskerId])

  return null
}
