'use client'

import { motion } from 'framer-motion'
import { Swifty, type SwiftyProps } from './swifty/Swifty'

export type { SwiftyMood as MascotMood, SwiftyInteraction as MascotInteraction } from './swifty/swifty-config'

export function OrderMascot(props: SwiftyProps) { return <Swifty {...props} /> }

export function OrderFlowProgress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-48 items-center" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }).map((_, index) => (
        <div key={index} className="flex flex-1 items-center last:flex-none">
          <motion.span animate={{ scale: index + 1 === step ? 1.15 : 1, backgroundColor: index + 1 <= step ? '#5b3df5' : '#e3e5f3' }} className="h-2 w-2 rounded-full ring-4 ring-white dark:ring-slate-950" />
          {index < total - 1 ? <span className={`h-0.5 flex-1 transition-colors duration-300 ${index + 1 < step ? 'bg-[#5b3df5]' : 'bg-[#e3e5f3]'}`} /> : null}
        </div>
      ))}
    </div>
  )
}
