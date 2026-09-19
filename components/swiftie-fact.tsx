'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { STUDENT_FACTS, type StudentFact } from '@/lib/did-you-know-facts'

const ROTATION_MS = 14_000

function shuffledFacts(orderId: string): StudentFact[] {
  // Order IDs already vary per request. A seeded shuffle is random-looking and
  // produces the same first fact during server rendering and hydration.
  let seed = Array.from(orderId).reduce(
    (hash, character) => (Math.imul(hash, 31) + character.charCodeAt(0)) | 0,
    0,
  ) >>> 0
  const facts = [...STUDENT_FACTS]
  for (let index = facts.length - 1; index > 0; index--) {
    seed += 0x6d2b79f5
    let random = seed
    random = Math.imul(random ^ (random >>> 15), random | 1)
    random ^= random + Math.imul(random ^ (random >>> 7), random | 61)
    const swapIndex = Math.floor((((random ^ (random >>> 14)) >>> 0) / 4294967296) * (index + 1))
    ;[facts[index], facts[swapIndex]] = [facts[swapIndex], facts[index]]
  }
  return facts
}

export function SwiftieFact({ orderId }: { orderId: string }) {
  const facts = useMemo(() => shuffledFacts(orderId), [orderId])
  const [index, setIndex] = useState(0)
  const reducedMotion = Boolean(useReducedMotion())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((previous) => (previous + 1) % facts.length)
    }, ROTATION_MS)
    return () => window.clearInterval(interval)
  }, [facts])

  const fact = facts[index % facts.length]

  return (
    <aside aria-label="Swiftie fact" aria-live="off" className="mx-auto w-full max-w-sm text-center">
      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Swiftie says...</p>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Did you know?</p>
      <div className="relative mt-2 min-h-24 [@media(max-height:540px)]:min-h-20">
        <AnimatePresence initial={false}>
          <motion.p
            key={fact.id}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3 }}
            className="absolute inset-0 flex items-center justify-center text-sm leading-6 text-slate-700 dark:text-slate-200 [@media(max-height:540px)]:text-xs [@media(max-height:540px)]:leading-4"
          >
            {fact.text}
          </motion.p>
        </AnimatePresence>
      </div>
    </aside>
  )
}
