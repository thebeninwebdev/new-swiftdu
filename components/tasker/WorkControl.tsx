'use client'

import { useTaskerWork, workButton } from './WorkProvider'

export function WorkControl() {
  const work = useTaskerWork()
  const checkedIn = work.data?.checkedIn || work.data?.status === 'busy'
  return <div className="border-b border-slate-100 p-4 dark:border-slate-800"><p className="mb-2 text-xs font-semibold text-slate-500">{work.loading ? 'Loading work status...' : work.data?.status === 'busy' ? 'Working on a task' : checkedIn ? 'Available for tasks' : 'You are off duty'}</p><button className={`${workButton} w-full`} disabled={work.loading || work.saving || !work.data || (!checkedIn && !work.data.canCheckIn)} onClick={() => checkedIn ? work.requestCheckout() : void work.checkIn()}>{checkedIn ? 'Check out' : 'Check in'}</button>{work.error && <p className="mt-2 text-xs text-rose-700">{work.error}</p>}</div>
}
