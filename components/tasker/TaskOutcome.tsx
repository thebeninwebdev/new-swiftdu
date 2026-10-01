'use client'
import { FirstOrderBonusNotice } from '@/components/first-order-bonus'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { CompletionBurst } from './CompletionBurst'
import { formatCompletionDuration, getCompletionRecognition } from '@/lib/completion-celebration'
import { TaskerSwifty } from './Swifty'
import { WorkStats } from './TaskerHome'
import { TaskJourney } from './TaskJourney'
import type { TaskCardData } from './TaskCards'
import { workButton, workCard } from './WorkProvider'
import { taskerEarnings } from '@/lib/tasker-work'
import { convertToNaira } from '@/lib/utils'

export function TaskOutcome({ task, completed, celebrate = false, settlementDue, onContinue }: { task: TaskCardData; completed?: boolean; celebrate?: boolean; settlementDue?: boolean; onContinue?: () => void }) {
  const recognition = getCompletionRecognition(task)
  const special = completed && recognition.eligible
  const reduced = useReducedMotion()
  return <div className="relative mx-auto max-w-xl space-y-5 px-4 py-6 text-center">{special && celebrate && <CompletionBurst />}<motion.div initial={special && celebrate && reduced === false ? { opacity: 0, y: 10, scale: 0.97 } : false} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4 }} className="flex justify-center"><TaskerSwifty state={completed ? 'success' : 'matched'} large /></motion.div><h1 className="text-3xl font-black tracking-tight">{special ? 'Excellent work!' : completed ? 'Nice work!' : 'Task accepted!'}</h1><p className="text-sm text-slate-500">{special ? 'You finished ahead of time. Thanks for helping a fellow student.' : completed ? task.cafeInquiry ? 'Inquiry completed.' : 'Delivery completed.' : "Let's get it done."}</p>
    {special && recognition.elapsedMs !== null && recognition.allowedDurationMs !== null && <div className="space-y-2"><span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">Ahead of time</span><p className="text-sm text-slate-600 dark:text-slate-300">Completed in {formatCompletionDuration(recognition.elapsedMs)} &middot; {formatCompletionDuration(recognition.allowedDurationMs)} allowed</p></div>}
    {completed ? <><div className={workCard}><p className="text-4xl font-black text-violet-700 dark:text-violet-300">+ {convertToNaira(taskerEarnings(task))}</p><p className="mt-2 text-sm text-slate-500">{task.isTestOrder ? 'Training complete · no real earnings' : 'earned from this task'}</p></div><h2 className="text-left text-sm font-bold">Today&apos;s progress</h2><WorkStats /></> : <div className="text-left"><TaskJourney task={task} /></div>}
    {completed && <FirstOrderBonusNotice order={task} tasker />}
    {settlementDue && !task.firstOrderBonusApplied && <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><p>Your platform fee still needs settlement.</p><Link href={`/tasker-dashboard/payment/${task._id}`} className="mt-2 inline-flex min-h-11 items-center font-bold underline">Pay platform fee →</Link></div>}
    {completed ? <><Link href="/tasker-dashboard?view=all" className={`${workButton} w-full`}>Find another task</Link><Link href="/tasker-dashboard" className="flex min-h-12 items-center justify-center rounded-2xl text-sm font-semibold">Take a break · return home</Link></> : <button onClick={onContinue} className={`${workButton} w-full`}>Go to task</button>}
  </div>
}
