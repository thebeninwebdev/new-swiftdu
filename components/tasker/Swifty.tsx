'use client'

import { useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { SWIFTY_ALT, SWIFTY_ASSETS, type SwiftyMood } from '@/components/swifty/swifty-config'

export function TaskerSwifty({ state = 'idle', large = false }: { state?: SwiftyMood; large?: boolean }) {
  const reduced = useReducedMotion()
  const [failed, setFailed] = useState(false)
  const className = large ? 'mx-auto h-48 w-48 object-contain sm:h-56 sm:w-56' : 'h-24 w-24 shrink-0 object-contain'
  return state === 'idle' && reduced === false && !failed ? (
    <video src="/mascot/idle.webm" poster={SWIFTY_ASSETS.idle} autoPlay loop muted playsInline aria-label={SWIFTY_ALT.idle} onError={() => setFailed(true)} className={className} />
  ) : (
    // Existing transparent mascot assets; retain their intrinsic proportions.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SWIFTY_ASSETS[state]} alt={SWIFTY_ALT[state]} className={className} />
  )
}
