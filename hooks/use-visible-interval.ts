'use client'

import { useEffect, useRef } from 'react'

export function useVisibleInterval(callback: () => void, delay: number | null) {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (delay === null) return

    let intervalId: number | null = null

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const start = () => {
      if (document.visibilityState !== 'visible' || intervalId !== null) return
      callbackRef.current()
      intervalId = window.setInterval(() => callbackRef.current(), delay)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start()
      } else {
        stop()
      }
    }

    start()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stop()
    }
  }, [delay])
}
