'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function useTaskerEligibility() {
  const { data: session } = authClient.useSession()
  const userId = session?.user?.id
  const role = session?.user?.role
  const taskerId = session?.user?.taskerId
  const [eligibility, setEligibility] = useState<{ userId: string; canApply: boolean } | null>(null)

  useEffect(() => {
    if (!userId || role !== 'user' || taskerId) return
    let ignore = false
    const currentUserId = userId

    async function refresh() {
      try {
        const response = await fetch('/api/users/me/tasker-eligibility', { cache: 'no-store' })
        const data = response.ok ? await response.json() : null
        if (!ignore) setEligibility({ userId: currentUserId, canApply: data?.canApply === true })
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
