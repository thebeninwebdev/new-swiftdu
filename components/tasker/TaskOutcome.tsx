'use client'

import Link from 'next/link'
import { TaskerSwifty } from './Swifty'
import { WorkStats } from './TaskerHome'
import { TaskJourney } from './TaskJourney'
import type { TaskCardData } from './TaskCards'
import { workButton, workCard } from './WorkProvider'
import { taskerEarnings } from '@/lib/tasker-work'
import { convertToNaira } from '@/lib/utils'

export function TaskOutcome({ task, completed, settlementDue, onContinue }: { task: TaskCardData; completed?: boolean; settlementDue?: boolean; onContinue?: () => void }) {
  return <div className="mx-auto max-w-xl space-y-5 py-6 text-center"><div className="flex justify-center"><TaskerSwifty state={completed ? 'success' : 'matched'} large /></div><h1 className="text-3xl font-black tracking-tight">{completed ? 'Nice work!' : 'Task accepted!'}</h1><p className="text-sm text-slate-500">{completed ? task.cafeInquiry ? 'Inquiry completed.' : 'Delivery completed.' : "Let's get it done."}</p>
    {completed ? <><div className={workCard}><p className="text-4xl font-black text-violet-700">+ {convertToNaira(taskerEarnings(task))}</p><p className="mt-2 text-sm text-slate-500">{task.isTestOrder ? 'Training complete · no real earnings' : 'earned from this task'}</p></div><h2 className="text-left text-sm font-bold">Today&apos;s progress</h2><WorkStats /></> : <div className="text-left"><TaskJourney task={task} /></div>}
    {settlementDue && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900"><p>Your platform fee still needs settlement.</p><Link href={`/tasker-dashboard/payment/${task._id}`} className="mt-2 inline-flex min-h-11 items-center font-bold underline">Pay platform fee →</Link></div>}
    {completed ? <><Link href="/tasker-dashboard?view=all" className={`${workButton} w-full`}>Find another task</Link><Link href="/tasker-dashboard" className="flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold">Take a break · return home</Link></> : <button onClick={onContinue} className={`${workButton} w-full`}>Go to task</button>}
  </div>
}
