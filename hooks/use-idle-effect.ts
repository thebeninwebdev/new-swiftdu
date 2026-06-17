'use client'

import { useEffect, type DependencyList } from 'react'

export function useIdleEffect(callback: () => void | (() => void), deps: DependencyList) {
  useEffect(() => {
    let cleanup: void | (() => void)
    let timeoutId: number | undefined
    let idleId: number | undefined
    let cancelled = false

    const run = () => {
      if (cancelled) return
      cleanup = callback()
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(run, { timeout: 2500 })
    } else {
      timeoutId = window.setTimeout(run, 1200)
    }

    return () => {
      cancelled = true

      if (idleId !== undefined && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }

      cleanup?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
