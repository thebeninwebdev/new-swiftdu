'use client'

import { useEffect, useRef, useState } from 'react'
import { SWIFTY_ALT, SWIFTY_ASSETS } from './swifty-config'
import { useLowDataMode } from '@/hooks/use-network-state'

const REPLAY_DELAY_MS = 4000

export function SwiftyIdle({ reducedMotion }: { reducedMotion: boolean }) {
  const lowData = useLowDataMode()
  const [videoFailed, setVideoFailed] = useState(false)
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (replayTimer.current !== null) {
        clearTimeout(replayTimer.current)
        replayTimer.current = null
      }
    }
  }, [reducedMotion, videoFailed])

  if (reducedMotion || lowData || videoFailed) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={SWIFTY_ASSETS.idle} alt={SWIFTY_ALT.idle} draggable={false} className="h-full w-full object-contain" />
  }

  return (
    <video
      src="/mascot/idle.webm"
      autoPlay
      muted
      playsInline
      poster={SWIFTY_ASSETS.idle}
      aria-label={SWIFTY_ALT.idle}
      onEnded={(event) => {
        const video = event.currentTarget
        if (replayTimer.current !== null) clearTimeout(replayTimer.current)
        replayTimer.current = setTimeout(() => {
          replayTimer.current = null
          if (!video.isConnected) return
          video.currentTime = 0
          void video.play().catch(() => setVideoFailed(true))
        }, REPLAY_DELAY_MS)
      }}
      onError={() => setVideoFailed(true)}
      className="h-full w-full object-contain"
    />
  )
}
