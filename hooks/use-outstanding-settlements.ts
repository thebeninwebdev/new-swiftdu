'use client'

import { useSyncExternalStore } from 'react'
import { acquireSharedSocket, releaseSharedSocket } from '@/lib/client-socket'

export type OutstandingSettlement = {
  _id: string
  platformFee: number
  description: string
  status: string
  settlementStatus: 'not_due' | 'pending' | 'initialized' | 'paid' | 'failed' | 'overdue'
  settlementDueAt?: string
  completedAt?: string
  isTestOrder?: boolean
}

type Snapshot = { orders: OutstandingSettlement[]; outstandingCount: number; loading: boolean; error: string | null }
const serverSnapshot: Snapshot = { orders: [], outstandingCount: 0, loading: true, error: null }
let snapshot = serverSnapshot
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()
let cleanupTriggers: (() => void) | null = null

function emit() { for (const listener of listeners) listener() }

export function refreshOutstandingSettlements() {
  if (inFlight) return inFlight
  inFlight = fetch('/api/taskers/unpaid-platform-fees', {
    cache: 'no-store',
    credentials: 'same-origin',
  }).then(async (response) => {
    if (!response.ok) throw new Error('Failed to load outstanding settlements')
    const data = await response.json()
    snapshot = {
      orders: Array.isArray(data.orders) ? data.orders : [],
      outstandingCount: Number(data.outstandingCount || 0),
      loading: false,
      error: null,
    }
    emit()
  }).catch(() => {
    snapshot = { ...snapshot, loading: false, error: 'Failed to load notifications right now.' }
    emit()
  }).finally(() => { inFlight = null })
  return inFlight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!cleanupTriggers && typeof window !== 'undefined') {
    const refresh = () => { void refreshOutstandingSettlements() }
    const socket = acquireSharedSocket()
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    window.addEventListener('swiftdu-work-updated', refresh)
    socket.on('tasks:updated', refresh)
    socket.on('order:updated', refresh)
    cleanupTriggers = () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      window.removeEventListener('swiftdu-work-updated', refresh)
      socket.off('tasks:updated', refresh)
      socket.off('order:updated', refresh)
      releaseSharedSocket(socket)
      cleanupTriggers = null
    }
    refresh()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) cleanupTriggers?.()
  }
}

export function useOutstandingSettlements() {
  return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot)
}
