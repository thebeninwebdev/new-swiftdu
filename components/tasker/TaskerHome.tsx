'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bell, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { convertToNaira } from '@/lib/utils'
import { useVisibleInterval } from '@/hooks/use-visible-interval'
import { TaskerSwifty } from './Swifty'
import { activeTime, useTaskerWork, workButton, workCard } from './WorkProvider'
import { CategoryBadge, categoryLabels, TaskCard, type TaskCardData } from './TaskCards'

export function WorkStats({ period = 'today' }: { period?: 'today' | 'week' | 'month' }) {
  const { data } = useTaskerWork()
  const summary = data?.summaries[period]
  return <div className="grid grid-cols-3 gap-2 rounded-3xl border border-violet-100 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
    {[['Tasks done', summary?.tasks], ['Active time', summary ? activeTime(summary.activeMs) : undefined], [period === 'today' ? "Today's earnings" : 'Earnings', summary ? convertToNaira(summary.earnings) : undefined]].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-base font-extrabold tracking-tight sm:text-xl">{value ?? '—'}</p><p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{label}</p></div>)}
  </div>
}

export function TaskerHome({ name, errands, accepted, loading, refreshing, error, newTaskAlert, refresh, taskType, setTaskType, location, setLocation }: {
  name: string; errands: TaskCardData[]; accepted: TaskCardData[]; loading: boolean; refreshing: boolean; error: string | null; newTaskAlert: boolean
  refresh: () => void; taskType: string; setTaskType: (value: string) => void; location: string; setLocation: (value: string) => void
}) {
  const work = useTaskerWork()
  const params = useSearchParams()
  const all = params.get('view') === 'all'
  const tasksOnly = params.get('accepted') === 'true'
  const [filters, setFilters] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  useVisibleInterval(() => setNow(Date.now()), work.data?.checkedIn || accepted.length ? 1000 : 60_000)
  const hour = Number(new Intl.DateTimeFormat('en', { timeZone: 'Africa/Lagos', hour: 'numeric', hourCycle: 'h23' }).format(now))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = name.trim().split(/\s+/)[0] || 'Tasker'
  const offline = !work.data?.checkedIn && !accepted.length && !work.data?.activeTasks
  const duration = Math.max(0, Math.floor((now - new Date(work.data?.checkedInAt || now).getTime()) / 1000))
  const durationText = `${String(Math.floor(duration / 3600)).padStart(2, '0')}:${String(Math.floor(duration / 60) % 60).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`
  const problem = work.error || error
  return <div className="mx-auto max-w-6xl px-1 py-4 text-slate-900 dark:text-slate-100 sm:px-3">
    <header className="mb-6 flex items-center justify-between"><Link href="/tasker-dashboard" className="text-xl font-black tracking-tight text-violet-700 dark:text-violet-300">SwiftDU<span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tasker</span></Link><Link aria-label="Notifications and platform settlements" href="/tasker-dashboard/notifications" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 dark:bg-slate-900"><Bell size={20} /></Link></header>
    {work.loading && !work.data ? <div className="py-20 text-center" role="status"><div className="flex justify-center"><TaskerSwifty state="searching" /></div><p className="mt-4">Getting your work session ready...</p></div> : <>
      {work.data?.checkedIn && <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900"><div><p className="text-sm font-bold">● You&apos;re checked in</p><p className="mt-0.5 text-xs">{work.data.status === 'busy' ? 'Working on a task' : 'Available for tasks'}</p></div><span className="font-mono text-sm tabular-nums" aria-label="Current session duration">{durationText}</span></div>}
      {work.data?.mode === 'training' && <p className="mb-4 inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Training mode · test tasks only</p>}
      {problem && <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p>{problem}</p><button className="mt-2 min-h-11 font-bold underline" onClick={() => { void work.refresh(); refresh() }}>Retry</button></div>}
      {work.data?.blockedReason && <div className="mb-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p>{work.data.blockedReason}</p><Link className="mt-2 inline-flex min-h-11 items-center font-bold underline" href="/tasker-dashboard/notifications">View settlements</Link><Link className="ml-4 font-bold underline" href="/tasker-dashboard/support">Get help</Link></div>}
      {offline ? <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .2 }} className="mx-auto max-w-xl py-5 text-center sm:py-10">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{greeting},<br />{firstName} <span aria-hidden="true">👋</span></h1><p className="mt-3 text-sm text-slate-500">Ready to make someone&apos;s day easier?</p>
        <div className="my-5"><TaskerSwifty state={problem ? 'warning' : 'idle'} large /></div>
        <div className={workCard}><h2 className="mx-auto max-w-xs text-lg font-bold">Check in to start receiving tasks around campus.</h2><button disabled={work.saving || !work.data?.canCheckIn} onClick={() => void work.checkIn()} className={`${workButton} mt-5 w-full`}>Check in</button></div>
        <p className="mt-6 text-xs tracking-wide text-slate-400">Small tasks. A brighter campus.</p>
      </motion.section> : <>
        <div className="mb-6 flex items-center justify-between gap-2"><div><h1 className="text-3xl font-extrabold leading-tight tracking-tight">{greeting},<br />{firstName} <span aria-hidden="true">👋</span></h1><p className="mt-2 text-sm text-slate-500">{accepted.length ? 'One step at a time. You’ve got this.' : 'Ready when you are.'}</p></div><TaskerSwifty state={accepted.length ? 'moving' : 'idle'} /></div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            {newTaskAlert && <p role="status" className="rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">A new task just arrived.</p>}
            {accepted.length > 0 && <section><h2 className="mb-3 text-lg font-bold">Your active tasks <span className="text-slate-400">{accepted.length}</span></h2><div className="space-y-3">{accepted.map(task => <TaskCard key={task._id} task={task} active now={now} />)}</div></section>}
            {!tasksOnly && work.data?.checkedIn && <section>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Available tasks <span className="text-sm text-slate-400">{errands.filter(t => t.status === 'pending').length}</span></h2><Link className="inline-flex min-h-11 items-center text-sm font-bold text-violet-700" href={all ? '/tasker-dashboard' : '/tasker-dashboard?view=all'}>{all ? 'Back home' : 'See all'}</Link></div>
              {all && <><div className="mb-3 flex gap-3"><button onClick={() => setFilters(!filters)} aria-expanded={filters} className="flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm dark:bg-slate-900"><SlidersHorizontal size={16} />Filters</button><button aria-label="Refresh tasks" onClick={refresh} disabled={refreshing} className="min-h-11 rounded-xl border px-4"><RefreshCw size={16} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} /></button></div>{filters && <div className={`${workCard} mb-4 grid gap-3 sm:grid-cols-2`}><label className="text-sm">Task type<select value={taskType} onChange={e => setTaskType(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border bg-transparent px-3"><option value="all">All tasks</option>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm">Destination<input value={location} onChange={e => setLocation(e.target.value)} placeholder="Search location" className="mt-2 min-h-11 w-full rounded-xl border bg-transparent px-3" /></label><button className="text-left text-sm font-semibold text-violet-700" onClick={() => { setTaskType('all'); setLocation('') }}>Clear filters</button></div>}</>}
              {loading ? <div role="status" className={`${workCard} text-center`}>Looking for nearby tasks...</div> : errands.filter(t => t.status === 'pending').length ? <div className="space-y-3">{(all ? errands : errands.filter(t => t.status === 'pending').slice(0, 3)).map(task => <TaskCard task={task} key={task._id} now={now} />)}</div> : <div className={`${workCard} py-8 text-center`}><div className="flex justify-center"><TaskerSwifty state="searching" /></div><h3 className="mt-3 font-bold">You&apos;re all caught up</h3><p className="mt-2 text-sm text-slate-500">We&apos;ll let you know when a new task comes in.</p></div>}
            </section>}
            {tasksOnly && !accepted.length && <div className={`${workCard} text-center`}><h2 className="font-bold">No active tasks yet</h2><Link href="/tasker-dashboard?view=all" className={`${workButton} mt-4`}>Find a task</Link></div>}
          </div>
          <aside className="order-first space-y-4 lg:order-last"><WorkStats /><p className="px-2 text-xs leading-5 text-slate-500">Earnings show completed live tasks. Active time is measured from your recorded check-ins.</p><Link href="/tasker-dashboard/history" className={`${workCard} block text-sm font-semibold text-violet-700`}>View earnings & history →</Link><button onClick={work.requestCheckout} className="min-h-12 w-full rounded-2xl border border-slate-200 text-sm font-semibold">{work.data?.status === 'busy' ? 'Working · checkout options' : 'Check out'}</button></aside>
        </div>
      </>}
    </>}
  </div>
}
