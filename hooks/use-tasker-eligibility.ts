'use client'

import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

type TaskerNavigationStatus = {
  canApply: boolean
  hasTaskerAccess: boolean
}

const statusCache = new Map<string, TaskerNavigationStatus>()
const statusRequests = new Map<string, Promise<TaskerNavigationStatus>>()
const EMPTY_STATUS: TaskerNavigationStatus = { canApply: false, hasTaskerAccess: false }

function loadStatus(userId: string) {
  const cached = statusCache.get(userId)
  if (cached) return Promise.resolve(cached)
  const existing = statusRequests.get(userId)
  if (existing) return existing

  const request = fetch('/api/users/me/tasker-eligibility', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return EMPTY_STATUS
      const payload = (await response.json()) as Partial<TaskerNavigationStatus>
      return {
        canApply: payload.canApply === true,
        hasTaskerAccess: payload.hasTaskerAccess === true,
      }
    })
    .catch(() => EMPTY_STATUS)
    .then((status) => {
      statusCache.set(userId, status)
      return status
    })
    .finally(() => statusRequests.delete(userId))

  statusRequests.set(userId, request)
  return request
}

function useTaskerNavigationStatus() {
  const { data: session } = authClient.useSession()
  const userId = session?.user?.id
  const [status, setStatus] = useState<{ userId: string; value: TaskerNavigationStatus } | null>(
    () => userId && statusCache.has(userId) ? { userId, value: statusCache.get(userId)! } : null
  )

  useEffect(() => {
    if (!userId) return

    let ignore = false
    const currentUserId = userId
    const run = () => void loadStatus(currentUserId).then((value) => {
      if (!ignore) setStatus({ userId: currentUserId, value })
    })
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (callback: () => void) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idleId = idleWindow.requestIdleCallback?.(run)
    const timeoutId = idleId === undefined ? window.setTimeout(run, 300) : null

    return () => {
      ignore = true
      if (idleId !== undefined) idleWindow.cancelIdleCallback?.(idleId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [userId])

  return userId && status?.userId === userId ? status.value : EMPTY_STATUS
}

export function useTaskerEligibility() {
  return useTaskerNavigationStatus().canApply
}

export function useTaskerDashboardAccess() {
  return useTaskerNavigationStatus().hasTaskerAccess
}
