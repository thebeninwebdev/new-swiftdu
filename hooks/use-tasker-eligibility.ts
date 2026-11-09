'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

const eligibilityCache = new Map<string, boolean>()
const eligibilityRequests = new Map<string, Promise<boolean>>()

function loadEligibility(userId: string) {
  if (eligibilityCache.has(userId)) {
    return Promise.resolve(eligibilityCache.get(userId)!)
  }
  const existing = eligibilityRequests.get(userId)
  if (existing) return existing
  const request = fetch('/api/users/me/tasker-eligibility', { cache: 'no-store' })
    .then(async (response) => response.ok && (await response.json())?.canApply === true)
    .catch(() => false)
    .then((canApply) => {
      eligibilityCache.set(userId, canApply)
      return canApply
    })
    .finally(() => eligibilityRequests.delete(userId))
  eligibilityRequests.set(userId, request)
  return request
}

export function useTaskerEligibility() {
  const { data: session } = authClient.useSession()
  const userId = session?.user?.id
  const role = session?.user?.role
  const taskerId = session?.user?.taskerId
  const [eligibility, setEligibility] = useState<{ userId: string; canApply: boolean } | null>(
    () => (userId && eligibilityCache.has(userId) ? { userId, canApply: eligibilityCache.get(userId)! } : null)
  )

  useEffect(() => {
    if (!userId || role !== 'user' || taskerId) return
    if (eligibilityCache.has(userId)) {
      setEligibility({ userId, canApply: eligibilityCache.get(userId)! })
      return
    }

    let ignore = false
    const currentUserId = userId

    // Defer tasker eligibility fetch until after interactive rendering
    const hasIdle = typeof window !== 'undefined' && typeof (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback === 'function'
    const idleId = hasIdle
      ? (window as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(() => void fetchEligibility())
      : null
    const timeoutId = !hasIdle
      ? setTimeout(() => void fetchEligibility(), 300)
      : null

    async function fetchEligibility() {
      try {
        const canApply = await loadEligibility(currentUserId)
        if (!ignore) setEligibility({ userId: currentUserId, canApply })
      } catch {
        if (!ignore) setEligibility({ userId: currentUserId, canApply: false })
      }
    }

    return () => {
      ignore = true
      if (hasIdle && idleId !== null) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [userId, role, taskerId])

  return Boolean(userId && role === 'user' && !taskerId && eligibility?.userId === userId && eligibility.canApply)
}
