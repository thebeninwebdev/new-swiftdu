'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

const eligibilityCache = new Map<string, boolean>()
const eligibilityRequests = new Map<string, Promise<boolean>>()

function loadEligibility(userId: string) {
  const existing = eligibilityRequests.get(userId)
  if (existing) return existing
  const request = fetch('/api/users/me/tasker-eligibility', { cache: 'no-store' })
    .then(async (response) => response.ok && (await response.json())?.canApply === true)
    .catch(() => false)
    .then((canApply) => { eligibilityCache.set(userId, canApply); return canApply })
    .finally(() => eligibilityRequests.delete(userId))
  eligibilityRequests.set(userId, request)
  return request
}

export function useTaskerEligibility() {
  const { data: session } = authClient.useSession()
  const userId = session?.user?.id
  const role = session?.user?.role
  const taskerId = session?.user?.taskerId
  const [eligibility, setEligibility] = useState<{ userId: string; canApply: boolean } | null>(() => userId && eligibilityCache.has(userId) ? { userId, canApply: eligibilityCache.get(userId)! } : null)

  useEffect(() => {
    if (!userId || role !== 'user' || taskerId) return
    let ignore = false
    const currentUserId = userId

    async function refresh() {
      try {
        const canApply = await loadEligibility(currentUserId)
        if (!ignore) setEligibility({ userId: currentUserId, canApply })
      } catch {
        if (!ignore) setEligibility({ userId: currentUserId, canApply: false })
      }
    }

    void refresh()
    window.addEventListener('focus', refresh)
    return () => {
      ignore = true
      window.removeEventListener('focus', refresh)
    }
  }, [userId, role, taskerId])

  return Boolean(userId && role === 'user' && !taskerId && eligibility?.userId === userId && eligibility.canApply)
}
