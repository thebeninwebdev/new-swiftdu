'use client'

import { SWIFTY_ALT, SWIFTY_ASSETS } from './swifty-config'

export function SwiftyIdle() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={SWIFTY_ASSETS.idle} alt={SWIFTY_ALT.idle} draggable={false} className="h-full w-full object-contain" />
}
