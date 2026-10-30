'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BriefcaseBusiness, CheckCircle2, Clock3, RefreshCw, Search, UserRoundCheck, UsersRound, WifiOff } from 'lucide-react'
import { AdminEmptyState, AdminLoadingState, AdminPageHeader, AdminSection, AdminStatCard, AdminStatusBadge } from '@/components/admin-ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminTaskerWorkOverview, AdminTaskerWorkStatus } from '@/lib/admin-tasker-work'

type StatusFilter = 'all' | 'checked-in' | 'available' | 'busy' | 'offline'
type ModeFilter = 'all' | 'live' | 'training'
const POLL_INTERVAL_MS = 20_000
const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' }, { value: 'checked-in', label: 'Checked In' },
  { value: 'available', label: 'Available' }, { value: 'busy', label: 'Busy' },
  { value: 'offline', label: 'Not Checked In' },
]

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'T'
}
function duration(ms: number) {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}
function exactTime(value: string) {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(value))
}
function clockTime(value: string) {
  return new Intl.DateTimeFormat('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(value))
}
function lastWorked(value: string | null, now: Date) {
  if (!value) return 'Never checked in'
  const date = new Date(value)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(date)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(now)
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(new Date(now.getTime() - 86_400_000))
  const prefix = day === today ? 'today' : day === yesterday ? 'yesterday' : new Intl.DateTimeFormat('en-NG', { month: 'short', day: 'numeric', timeZone: 'Africa/Lagos' }).format(date)
  return `Last worked ${prefix}, ${clockTime(value)}`
}
function taskLabel(type: string) {
  return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function TaskerCard({ tasker, now }: { tasker: AdminTaskerWorkStatus; now: Date }) {
  const status = tasker.status === 'available' ? { label: 'Available', tone: 'success' as const }
    : tasker.status === 'busy' ? { label: 'Busy', tone: 'warning' as const }
      : { label: 'Not checked in', tone: 'neutral' as const }
  return <article className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(220px,1.3fr)_minmax(145px,.7fr)_minmax(220px,1fr)] lg:items-center">
    <div className="flex min-w-0 items-center gap-3">
      {tasker.profileImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tasker.profileImage} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200" />
      ) : <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-sm font-bold text-violet-700">{initials(tasker.name)}</div>}
      <div className="min-w-0"><h2 className="truncate font-semibold text-slate-950">{tasker.name}</h2><p className="truncate text-sm text-slate-500">{tasker.phone || tasker.email || 'No contact details'}</p>{tasker.phone && tasker.email ? <p className="truncate text-xs text-slate-400">{tasker.email}</p> : null}</div>
    </div>
    <div className="flex flex-wrap items-center gap-2 lg:block lg:space-y-2">
      <AdminStatusBadge tone={status.tone}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${tasker.status === 'available' ? 'bg-emerald-500' : tasker.status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'}`} />{status.label}</AdminStatusBadge>
      <div><AdminStatusBadge tone={tasker.mode === 'training' ? 'warning' : 'brand'}>{tasker.mode === 'training' ? 'Training' : 'Live'}</AdminStatusBadge></div>
    </div>
    <div className="min-w-0 text-sm">
      {tasker.checkedIn && tasker.checkedInAt ? <>
        <p className="font-medium text-slate-700" title={exactTime(tasker.checkedInAt)}>Checked in {clockTime(tasker.checkedInAt)} <span className="text-slate-400">·</span> {duration(tasker.activeDurationMs)} active</p>
        {tasker.longSession ? <p className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Long session</p> : null}
        {tasker.activeTask ? <p className="mt-2 text-slate-600">Handling <strong>{taskLabel(tasker.activeTask.type)}</strong> <span className="text-slate-400">·</span> <Link href="/admin/orders?scope=live" className="font-semibold text-violet-700 hover:underline">Order #{tasker.activeTask.id.slice(-6).toUpperCase()}</Link>{tasker.activeTasks > 1 ? ` +${tasker.activeTasks - 1} more` : ''}</p> : <p className="mt-1 text-slate-500">Ready for a task</p>}
      </> : <p className="text-slate-500" title={tasker.lastCheckedOutAt ? exactTime(tasker.lastCheckedOutAt) : undefined}>{lastWorked(tasker.lastCheckedOutAt, now)}</p>}
    </div>
  </article>
}

export default function LiveTaskersPage() {
  const [data, setData] = useState<AdminTaskerWorkOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [mode, setMode] = useState<ModeFilter>('all')
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const response = await fetch('/api/admin/taskers/live', { cache: 'no-store' })
      if (!response.ok) throw new Error('Request failed')
      setData(await response.json()); setError(false); setNow(new Date())
    } catch { setError(true) } finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS); return () => window.clearInterval(timer) }, [load])

  const taskers = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (data?.taskers || []).filter((tasker) => {
      const statusMatches = filter === 'all' || filter === 'checked-in' && tasker.checkedIn || filter === tasker.status
      const modeMatches = mode === 'all' || tasker.mode === mode
      const searchMatches = !needle || [tasker.name, tasker.phone, tasker.email].some((value) => value.toLowerCase().includes(needle))
      return statusMatches && modeMatches && searchMatches
    })
  }, [data, filter, mode, search])

  if (loading) return <AdminLoadingState label="Loading live tasker status…" fullPage />
  const emptyTitle = !data?.summary.total ? 'No approved taskers found.' : search ? 'No taskers match your search.' : filter === 'checked-in' && !data.summary.checkedIn ? 'No taskers are currently checked in.' : 'No taskers match these filters.'
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
    <AdminPageHeader title="Live Taskers" description="See who is checked in, available, or handling an active task." action={<Button variant="outline" onClick={() => void load(true)} disabled={refreshing}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button>} />
    {error && !data ? <AdminSection><AdminEmptyState title="Unable to load live tasker status." description="Try again in a moment." icon={WifiOff} /><div className="flex justify-center pb-8"><Button onClick={() => void load(true)}>Try again</Button></div></AdminSection> : <>
      {error ? <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Live refresh failed. Showing the most recent status.</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <AdminStatCard label="Total Taskers" value={data?.summary.total || 0} detail="Approved taskers" icon={UsersRound} />
        <AdminStatCard label="Checked In" value={data?.summary.checkedIn || 0} detail="Open work sessions" icon={UserRoundCheck} tone="brand" />
        <AdminStatCard label="Available" value={data?.summary.available || 0} detail="Ready for tasks" icon={CheckCircle2} tone="success" />
        <AdminStatCard label="Busy" value={data?.summary.busy || 0} detail="Handling active tasks" icon={BriefcaseBusiness} tone="warning" />
        <AdminStatCard label="Not Checked In" value={data?.summary.offline || 0} detail="Currently off duty" icon={Clock3} tone="neutral" className="col-span-2 md:col-span-1" />
      </div>
      <AdminSection className="mt-6 overflow-hidden">
        <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex gap-2 overflow-x-auto pb-1">{statusFilters.map((item) => <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`min-h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold ${filter === item.value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}>{item.label}</button>)}</div>
          <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search taskers…" className="pl-9" /></div><select value={mode} onChange={(event) => setMode(event.target.value as ModeFilter)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value="all">All Modes</option><option value="live">Live</option><option value="training">Training</option></select></div>
          <p className="text-xs text-slate-400">Last updated {data ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.min(0, Math.round((new Date(data.serverNow).getTime() - now.getTime()) / 60_000)), 'minute') : 'just now'} · Refreshes every 20 seconds</p>
        </div>
        {!taskers.length ? <AdminEmptyState title={emptyTitle} /> : <div className="divide-y divide-slate-100">{taskers.map((tasker) => <TaskerCard key={tasker.taskerId} tasker={tasker} now={now} />)}</div>}
      </AdminSection>
    </>}
  </div>
}
