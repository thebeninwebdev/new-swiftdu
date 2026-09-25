'use client'

import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from 'framer-motion'
import { memo, useEffect, useRef, useState } from 'react'
import { SWIFTY_ALT, SWIFTY_ASSETS, SWIFTY_SIZES, type SwiftyInteraction, type SwiftyMood } from './swifty-config'
import { SwiftySpeech } from './SwiftySpeech'
import { SwiftyIdle } from './SwiftyIdle'

export type SwiftySearchPhase = 0 | 1 | 2 | 3
export interface SwiftyProps { mood: SwiftyMood; interaction?: SwiftyInteraction; size?: keyof typeof SWIFTY_SIZES; message?: string; compactSpeech?: boolean; stackSpeech?: boolean; searchPhase?: SwiftySearchPhase; className?: string }

const entranceByMood: Record<SwiftyMood, TargetAndTransition> = {
  idle: { opacity: 1, x: 0, y: [8, -2, 0], scale: [0.94, 1.02, 1], transition: { duration: 0.48 } },
  thinking: { opacity: 1, y: 0, rotate: [0, -1.5, 0], scale: 1, transition: { duration: 0.45 } },
  searching: { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1, transition: { duration: 0.3 } },
  matched: { opacity: 1, y: [0, -8, 0], scale: [1, 1.08, 1], rotate: [0, -2, 2, 0], transition: { duration: 0.85 } },
  moving: { opacity: 1, x: 0, rotate: 0, scale: 1, transition: { duration: 0.32 } },
  success: { opacity: 1, y: [0, -8, 0], scale: [1, 1.08, 1], rotate: [0, -2, 2, 0], transition: { duration: 0.85 } },
  warning: { opacity: 1, y: [0, -4, 0], scale: [1, 1.03, 1], transition: { duration: 0.5 } },
  error: { opacity: 1, y: [-5, 3, 0], scale: 1, transition: { duration: 0.36 } },
}

function ambientMotion(mood: SwiftyMood, phase: SwiftySearchPhase, reduced: boolean): TargetAndTransition {
  if (reduced) return { x: 0, y: 0, rotate: 0, scale: 1 }
  if (mood === 'idle' || mood === 'matched' || mood === 'success') return { y: [0, -4, 0], scale: [1, 1.015, 1], rotate: [-0.4, 0.4, -0.4], transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' } }
  if (mood === 'thinking') return { y: [0, -3, 0], rotate: [0, -0.6, 0], transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }
  if (mood === 'searching') {
    const distance = phase === 1 ? 6 : phase === 3 ? 2 : 4
    const duration = phase === 3 ? 5 : phase === 1 ? 4.5 : 4
    return { x: [0, -distance, -distance, 0, distance, distance, 0], y: [0, 0, -3, 0, 0, -2, 0], rotate: [0, -0.9, -0.9, 0, 0.9, 0.9, 0], transition: { duration, repeat: Infinity, ease: 'easeInOut', times: [0, 0.16, 0.29, 0.48, 0.64, 0.78, 1] } }
  }
  if (mood === 'moving') return { x: [0, 3, 0], rotate: [0, 0.5, 0], transition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } }
  return { x: 0, y: 0, rotate: 0, scale: 1 }
}

function SwiftyComponent({ mood, interaction = 'rest', size = 'md', message, compactSpeech, stackSpeech = false, searchPhase = 0, className = '' }: SwiftyProps) {
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

  const isCelebrating = displayMood === 'matched' || displayMood === 'success'
  const shadowMotion = reduced ? { scale: 1, opacity: 0.28 } : displayMood === 'searching'
    ? { scale: [1, 0.88, 1, 0.9, 1], opacity: [0.32, 0.2, 0.32, 0.22, 0.32] }
    : { scale: [1, 0.85, 1], opacity: [0.32, 0.2, 0.32] }
  const shadowDuration = displayMood === 'searching' ? (searchPhase === 3 ? 5 : searchPhase === 1 ? 4.5 : 4) : 4.2

  return (
    <div className={`flex min-w-0 items-center justify-center ${size === 'booking' ? 'gap-4' : 'gap-3'} ${stackSpeech ? 'flex-col' : ''} ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={displayMood}
          initial={reduced ? false : { opacity: 0, y: 5, scale: 0.96 }}
          animate={reduced ? { opacity: 1 } : entranceByMood[displayMood]}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.97, transition: { duration: 0.14 } }}
          className={`relative shrink-0 ${SWIFTY_SIZES[size]}`}
        >
          {displayMood === 'searching' && searchPhase === 2 && !reduced ? (
            <motion.span aria-hidden="true" className="pointer-events-none absolute inset-[15%] rounded-full border border-indigo-300/60 dark:border-indigo-400/40" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: [0.8, 1.45], opacity: [0.35, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeOut' }} />
          ) : null}
          <motion.div className="relative z-10 h-full w-full" animate={ambientMotion(displayMood, searchPhase, reduced)}>
            {displayMood === 'idle' ? <SwiftyIdle reducedMotion={reduced} /> : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={SWIFTY_ASSETS[displayMood]} alt={SWIFTY_ALT[displayMood]} draggable={false} className="h-full w-full object-contain" />
            )}
          </motion.div>
          {isCelebrating && !reduced ? [0, 1, 2].map((index) => (
            <motion.span key={index} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 z-20 h-1.5 w-1.5 rounded-full bg-amber-300" initial={{ x: 0, y: 0, scale: 0, opacity: 0 }} animate={{ x: [-12, 12, 0][index], y: [-12, -18, -23][index], scale: [0, 1, 0], opacity: [0, 0.85, 0] }} transition={{ duration: 0.9, delay: 0.12 + index * 0.08 }} />
          )) : null}
          <motion.span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/4 h-2 w-1/2 rounded-full bg-indigo-950/30 blur-[3px] dark:bg-indigo-300/30" animate={shadowMotion} transition={reduced ? { duration: 0 } : { duration: shadowDuration, repeat: Infinity, ease: 'easeInOut' }} />
        </motion.div>
      </AnimatePresence>
      {message ? <SwiftySpeech key={message} message={message} compact={compactSpeech} /> : null}
    </div>
  )
}

export const Swifty = memo(SwiftyComponent)
