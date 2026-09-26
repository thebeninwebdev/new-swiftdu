'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { MotionConfig } from 'framer-motion'
import { acquireSharedSocket, releaseSharedSocket } from '@/lib/client-socket'
import type { WorkSnapshot } from '@/lib/tasker-work'
import { TaskerSwifty } from './Swifty'
import { WorkDialog } from './WorkDialog'
import { convertToNaira } from '@/lib/utils'

export const workButton = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50'
export const workCard = 'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900'
type WorkContext = { data: WorkSnapshot | null; loading: boolean; error: string | null; saving: boolean; refresh: () => Promise<void>; checkIn: () => Promise<void>; requestCheckout: () => void }
const Context = createContext<WorkContext | null>(null)
export function useTaskerWork() {
  const value = useContext(Context)
  if (!value) throw new Error('Tasker work provider is required')
  return value
}
export function activeTime(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function TaskerWorkProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const sequence = useRef(0)
  const mutation = useRef(false)
  const path = usePathname()
  const refresh = useCallback(async () => {
    if (mutation.current) return
    const request = ++sequence.current
    try {
      const response = await fetch('/api/taskers/availability', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load your work status.')
      if (request === sequence.current) { setData(payload); setError(null) }
    } catch (error) {
      if (request === sequence.current) setError(error instanceof Error ? error.message : 'Check your connection and retry.')
    } finally { if (request === sequence.current) setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [path, refresh])
  useEffect(() => {
    const socket = acquireSharedSocket()
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { void refresh() }, 350) }
    const visible = () => { if (document.visibilityState === 'visible') schedule() }
    socket.on('tasks:updated', schedule)
    socket.on('order:updated', schedule)
    socket.on('connect', schedule)
    window.addEventListener('focus', schedule)
    window.addEventListener('swiftdu-work-updated', schedule)
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearTimeout(timer)
      socket.off('tasks:updated', schedule); socket.off('order:updated', schedule); socket.off('connect', schedule)
      window.removeEventListener('focus', schedule); window.removeEventListener('swiftdu-work-updated', schedule)
      document.removeEventListener('visibilitychange', visible)
      releaseSharedSocket(socket)
    }
  }, [refresh])
  const change = async (action: 'check-in' | 'check-out') => {
    if (mutation.current) return
    mutation.current = true
    ++sequence.current
    setSaving(true); setError(null); setCheckingIn(action === 'check-in')
    try {
      const response = await fetch('/api/taskers/availability', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not change your work status.')
      setData(payload); setCheckout(false)
      toast.success(action === 'check-in' ? "You're all set! Let's get to work." : "You're checked out. See you soon!")
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Check your connection and retry.'
      setError(message); toast.error(message)
    } finally {
      mutation.current = false; setSaving(false); setCheckingIn(false); setLoading(false)
      // Reconcile a response lost after the server committed the change.
      void refresh()
    }
  }
  return <Context.Provider value={{ data, loading, error, saving, refresh, checkIn: () => change('check-in'), requestCheckout: () => setCheckout(true) }}>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
    {checkingIn && <WorkDialog title="Checking you in">
      <TaskerSwifty state="searching" large />
      <div role="status" className="text-center"><h2 className="text-2xl font-bold">Checking you in...</h2><p className="mt-2 text-sm text-slate-500">Just a moment while we get everything ready.</p><p className="mt-5 rounded-2xl bg-violet-50 p-4 text-sm text-violet-800">Verifying your account and setting your availability...</p></div>
    </WorkDialog>}
    {checkout && !checkingIn && <WorkDialog title="Check out?" onClose={saving ? undefined : () => setCheckout(false)}>
      <div className="flex justify-center"><TaskerSwifty /></div>
      <h2 className="mt-3 text-center text-2xl font-bold">Check out?</h2>
      <p className="mt-2 text-center text-sm text-slate-500">You won&apos;t receive new tasks until you check in again.</p>
      {data && <div className="my-5 grid grid-cols-3 gap-2 text-center text-sm"><div><strong>{data.summaries.today.tasks}</strong><p>Tasks</p></div><div><strong>{convertToNaira(data.summaries.today.earnings)}</strong><p>Earned</p></div><div><strong>{activeTime(data.summaries.today.activeMs)}</strong><p>Active time</p></div></div>}
      {Boolean(data?.activeTasks) && <p role="status" className="my-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Finish your active tasks before checking out. Your current work stays available from Tasks.</p>}
      {error && <p role="alert" className="my-3 text-sm text-rose-700">{error}</p>}
      <button className={`${workButton} w-full`} disabled={saving || !data || Boolean(data.activeTasks)} onClick={() => void change('check-out')}>{saving ? 'Checking out...' : 'Check out'}</button>
      <button className="mt-2 min-h-12 w-full rounded-2xl font-semibold focus-visible:outline-2" disabled={saving} onClick={() => setCheckout(false)}>Keep working</button>
    </WorkDialog>}
  </Context.Provider>
}
