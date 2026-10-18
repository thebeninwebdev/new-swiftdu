'use client'

import { useCallback, useRef, useState } from 'react'

export type ServerTimeSample = {
  serverNow: string | undefined
  requestStartedAt: number
  requestFinishedAt: number
}

/** Calculates the local-clock correction from an API response timestamp and RTT midpoint. */
export function getServerTimeOffset({ serverNow, requestStartedAt, requestFinishedAt }: ServerTimeSample) {
  const serverTimeMs = serverNow ? new Date(serverNow).getTime() : Number.NaN
  if (!Number.isFinite(serverTimeMs) || !Number.isFinite(requestStartedAt) || !Number.isFinite(requestFinishedAt) || requestFinishedAt < requestStartedAt) return null
  const midpoint = requestStartedAt + (requestFinishedAt - requestStartedAt) / 2
  return serverTimeMs - midpoint
}

/**
 * Keeps display-time aligned to the SwiftDU server. It never supplies time for
 * business rules: those remain enforced by server routes.
 */
export function useServerTime() {
  const offsetMs = useRef<number | null>(null)
  const [isSynchronized, setIsSynchronized] = useState(false)

  const synchronize = useCallback((sample: ServerTimeSample) => {
    const offset = getServerTimeOffset(sample)
    if (offset === null) return false
    offsetMs.current = offset
    setIsSynchronized(true)
    return true
  }, [])

  const getTrustedNow = useCallback(() => {
    if (offsetMs.current === null) return null
    return new Date(Date.now() + offsetMs.current)
  }, [])

  return { getTrustedNow, isSynchronized, synchronize }
}
