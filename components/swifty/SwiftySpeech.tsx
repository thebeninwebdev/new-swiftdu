'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

const TYPEWRITER_INTERVAL_MS = 12
const TYPEWRITER_START_DELAY_MS = 700

export function SwiftySpeech({ message, compact = false }: { message: string; compact?: boolean }) {
  const reduceMotion = Boolean(useReducedMotion())
  const [visibleText, setVisibleText] = useState('')
  const [isTyping, setIsTyping] = useState(message.length > 0)

  useEffect(() => {
    if (reduceMotion || message.length === 0) return

    const characters = Array.from(message)
    let characterIndex = 0

    let typewriterTimer: number | undefined
    const startTimer = window.setTimeout(() => {
      typewriterTimer = window.setInterval(() => {
        characterIndex += 1
        setVisibleText(characters.slice(0, characterIndex).join(''))

        if (characterIndex >= characters.length) {
          window.clearInterval(typewriterTimer)
          setIsTyping(false)
        }
      }, TYPEWRITER_INTERVAL_MS)
    }, TYPEWRITER_START_DELAY_MS)

    return () => {
      window.clearTimeout(startTimer)
      if (typewriterTimer !== undefined) window.clearInterval(typewriterTimer)
    }
  }, [message, reduceMotion])

  return (
    <motion.div key={message} initial={reduceMotion ? false : { opacity: 0, y: 5, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, delay: reduceMotion ? 0 : 0.58 }} className={`relative rounded-2xl border border-violet-100 bg-white font-bold leading-snug text-slate-900 shadow-[0_8px_28px_-18px_rgba(76,29,149,0.35)] dark:border-slate-700 dark:bg-slate-900 dark:text-white ${compact ? 'max-w-48 px-3.5 py-2.5 text-sm' : 'max-w-60 px-4 py-3 text-sm sm:text-base'}`}>
      <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-violet-100 bg-white dark:border-slate-700 dark:bg-slate-900" />
      <span className="sr-only">{message}</span>
      <span aria-hidden="true" className="grid">
        <span className="invisible col-start-1 row-start-1">{message}</span>
        <span className="col-start-1 row-start-1">
          {reduceMotion ? message : visibleText}
          {!reduceMotion && isTyping ? <span className="ml-px inline-block animate-pulse font-normal">|</span> : null}
        </span>
      </span>
    </motion.div>
  )
}
