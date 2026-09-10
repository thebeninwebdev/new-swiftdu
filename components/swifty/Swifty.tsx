'use client'

import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { SWIFTY_ALT, SWIFTY_ASSETS, SWIFTY_SIZES, type SwiftyInteraction, type SwiftyMood } from './swifty-config'
import { SwiftySpeech } from './SwiftySpeech'

export interface SwiftyProps { mood: SwiftyMood; interaction?: SwiftyInteraction; size?: keyof typeof SWIFTY_SIZES; message?: string; compactSpeech?: boolean; className?: string }

const entranceByMood: Record<SwiftyMood, TargetAndTransition> = {
  idle: { opacity: 1, x: 0, y: [8, -2, 0], scale: [0.94, 1.02, 1], transition: { duration: 0.48 } },
  thinking: { opacity: 1, y: 0, rotate: [0, -1.5, 0], scale: 1, transition: { duration: 0.45 } },
  searching: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0.3 } },
  matched: { opacity: 1, y: [8, -4, 0], scale: [0.88, 1.05, 1], rotate: [0, 1.5, 0], transition: { duration: 0.58 } },
  moving: { opacity: 1, x: 0, rotate: 0, scale: 1, transition: { duration: 0.32 } },
  success: { opacity: 1, y: [10, -6, 0], scale: [0.8, 1.08, 1], rotate: [-1, 2, 0], transition: { duration: 0.68 } },
  warning: { opacity: 1, x: [0, -3, 3, -2, 2, 0], y: 0, scale: 1, transition: { duration: 0.42 } },
  error: { opacity: 1, y: [-5, 3, 0], scale: 1, transition: { duration: 0.36 } },
}

function ambientMotion(mood: SwiftyMood, reduced: boolean): TargetAndTransition {
  if (reduced) return { opacity: 1 }
  if (mood === 'idle') return { y: [0, -1.5, 0], rotate: [0, 0.4, 0], transition: { duration: 4.2, repeat: Infinity, repeatDelay: 1.2 } }
  if (mood === 'thinking') return { rotate: [0, -1.2, 0], y: [0, -1, 0], transition: { duration: 3.2, repeat: Infinity, repeatDelay: 1.4 } }
  if (mood === 'searching') return { x: [0, -5, 0, 5, 0], rotate: [0, -1.5, 0, 1.5, 0], transition: { duration: 2.4, repeat: Infinity, repeatDelay: 0.8 } }
  if (mood === 'moving') return { x: [0, 5, 0], rotate: [0, 0.8, 0], transition: { duration: 1.8, repeat: Infinity, repeatDelay: 0.45 } }
  return { x: 0, y: 0, rotate: 0, scale: 1 }
}

export function Swifty({ mood, interaction = 'rest', size = 'md', message, compactSpeech, className = '' }: SwiftyProps) {
  const reduced = Boolean(useReducedMotion())
  const [displayMood, setDisplayMood] = useState(mood)
  const sequenceId = useRef(0)

  useEffect(() => {
    const id = ++sequenceId.current
    const timers: number[] = []
    const beginSequence = window.setTimeout(() => {
      if (sequenceId.current !== id) return
      if (reduced) setDisplayMood(mood)
      else if (interaction === 'acknowledge' && mood === 'thinking') {
        setDisplayMood('matched')
        timers.push(window.setTimeout(() => { if (sequenceId.current === id) setDisplayMood('thinking') }, 360))
      } else setDisplayMood(mood)
    }, 0)
    timers.push(beginSequence)
    return () => timers.forEach(window.clearTimeout)
  }, [interaction, mood, reduced])

  useEffect(() => {
    const preload = mood === 'idle' ? 'thinking' : mood === 'thinking' ? 'searching' : null
    if (preload) { const image = new window.Image(); image.src = SWIFTY_ASSETS[preload] }
  }, [mood])

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={displayMood}
          initial={displayMood === 'success' ? false : reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
          animate={reduced ? { opacity: 1 } : entranceByMood[displayMood]}
          exit={displayMood === 'success' ? { opacity: 1 } : reduced ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.97, transition: { duration: 0.14 } }}
          className={`relative shrink-0 ${SWIFTY_SIZES[size]}`}
        >
          <motion.div
            className="h-full w-full"
            animate={ambientMotion(displayMood, reduced)}
            transition={{ delay: reduced ? 0 : 0.5 }}
          >
            {/* Native img intentionally avoids a runtime dependency on Next image allowlist reloads for dynamic pose swaps. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SWIFTY_ASSETS[displayMood]} alt={SWIFTY_ALT[displayMood]} draggable={false} className="h-full w-full object-contain drop-shadow-[0_14px_20px_rgba(79,70,229,0.16)]" />
          </motion.div>
        </motion.div>
      </AnimatePresence>
      {message ? <SwiftySpeech key={message} message={message} compact={compactSpeech} /> : null}
    </div>
  )
}
