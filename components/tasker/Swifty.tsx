'use client'

import { SWIFTY_ALT, SWIFTY_ASSETS, type SwiftyMood } from '@/components/swifty/swifty-config'

export function TaskerSwifty({ state = 'idle', large = false }: { state?: SwiftyMood; large?: boolean }) {
  const className = large ? 'mx-auto h-48 w-48 object-contain sm:h-56 sm:w-56' : 'h-24 w-24 shrink-0 object-contain'
  return (
    // Existing transparent mascot assets; retain their intrinsic proportions.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={SWIFTY_ASSETS[state]} alt={SWIFTY_ALT[state]} className={className} />
  )
}
