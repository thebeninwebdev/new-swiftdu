'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function CompletionBurst() {
  const reduced = useReducedMotion()
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setFinished(true), 2800)
    return () => window.clearTimeout(timer)
  }, [])
  if (reduced !== false || finished) return null
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
    {Array.from({ length: 22 }, (_, i) => <motion.span
      key={i}
      className={`absolute left-1/2 top-24 h-2 w-1.5 rounded-sm ${['bg-violet-500', 'bg-fuchsia-400', 'bg-amber-300', 'bg-violet-300'][i % 4]}`}
      initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
      animate={{ opacity: [0, 1, 1, 0], x: ((i * 73) % 340) - 170, y: [0, -55 - (i % 5) * 14, 220], rotate: (i % 2 ? 1 : -1) * 260 }}
      transition={{ duration: 2.3, delay: (i % 4) * 0.08, ease: 'easeOut' }}
    />)}
  </div>
}
