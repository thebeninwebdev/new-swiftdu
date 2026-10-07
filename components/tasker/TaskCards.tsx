'use client'

import Link from 'next/link'
import { ArrowRight, Droplets, FileText, ShoppingBag, Store } from 'lucide-react'
import { convertToNaira } from '@/lib/utils'
import { taskerEarnings } from '@/lib/tasker-work'
import { getCompletionWindowMinutes } from '@/lib/completion-timer'
import { workCard } from './WorkProvider'

export interface TaskCardData {
  firstOrderBonusApplied?: boolean
  firstOrderBonusAmount?: number
  platformFeeBeforeFirstOrderBonus?: number
  pricingModel?: string
  _id: string; taskType: string; description?: string; store?: string; location: string; roomNumber?: string; status: string
  taskerFee?: number; serviceFeeDiscountApplied?: boolean; discountCommissionAmount?: number
  cafeInquiry?: boolean; cafeInquiryStatus?: string; isTestOrder?: boolean; isDeclinedTask?: boolean
  hasPaid?: boolean; createdAt: string; deadline?: string; dueDate?: string; deadlineDate?: string
  completedAt?: string; customerReceiptConfirmed?: boolean; prematureCompletionReported?: boolean
  completionDueAt?: string; completionTimerStartedAt?: string; completionWindowMinutes?: number; completionExtensionMinutes?: number
}
export const categoryLabels: Record<string, string> = { restaurant: 'Food delivery', shopping: 'Shopping', printing: 'Printing', copy_notes: 'Copy notes', water: 'Water delivery', indomie: 'Indomie', others: 'Campus errand' }
const colors: Record<string, string> = { restaurant: 'bg-orange-50 text-orange-700', indomie: 'bg-orange-50 text-orange-700', shopping: 'bg-emerald-50 text-emerald-700', printing: 'bg-violet-50 text-violet-700', copy_notes: 'bg-amber-50 text-amber-800', water: 'bg-cyan-50 text-cyan-800' }
export function CategoryBadge({ type }: { type: string }) {
  const Icon = type === 'water' ? Droplets : ['printing', 'copy_notes'].includes(type) ? FileText : type === 'shopping' ? Store : ShoppingBag
  return <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${colors[type] || 'bg-slate-100 text-slate-700'}`}><Icon size={16} aria-hidden="true" />{categoryLabels[type] || 'Campus errand'}</span>
}

export function TaskCard({ task, active, now, onAccept, accepting = false }: { task: TaskCardData; active?: boolean; now: number; onAccept?: (taskId: string) => void; accepting?: boolean }) {
  const paid = task.hasPaid || task.status === 'paid'
  const start = new Date(task.completionTimerStartedAt || task.createdAt).getTime()
  const windowMinutes = Math.max(task.completionWindowMinutes || 0, getCompletionWindowMinutes(task.location, task.taskType, task.isTestOrder)) + (task.completionExtensionMinutes || 0)
  const due = Math.max(new Date(task.completionDueAt || 0).getTime(), start + windowMinutes * 60_000)
  const remaining = Math.max(0, Math.ceil((due - now) / 1000))
  const deadline = task.dueDate || task.deadline || task.deadlineDate
  return <article className={`${workCard} transition hover:border-violet-300`}>
    <div className="flex items-center justify-between gap-2"><CategoryBadge type={task.taskType} /><strong className="text-lg tracking-tight text-violet-700 dark:text-violet-300">{convertToNaira(taskerEarnings(task))}</strong></div>
    {task.isTestOrder && <p className="mt-2 text-xs font-semibold text-violet-700">Training task · simulated earnings</p>}
    <p className="mt-4 font-bold text-slate-900 dark:text-white">{task.cafeInquiry ? `Check availability at ${task.store || 'the cafe'}` : task.store || categoryLabels[task.taskType]}</p>
    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><ArrowRight size={14} />{task.location || 'See task instructions'}</p>
    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{task.description || 'Open task for details.'}</p>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
      <span className="text-slate-500">{active ? task.isDeclinedTask ? 'Transfer under review' : paid ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining` : task.cafeInquiry ? 'Continue cafe inquiry' : 'Awaiting customer payment' : deadline ? `Due ${new Date(deadline).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}` : `Posted ${new Date(task.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`}</span>
      {active ? <Link href={`/tasker-dashboard/${task._id}`} className="font-bold text-violet-700 hover:underline">Continue task</Link> : task.status === 'pending' ? <div className="flex items-center gap-3"><Link href={`/tasker-dashboard/${task._id}?preview=true`} className="font-bold text-violet-700 hover:underline">View details</Link>{onAccept ? <button type="button" onClick={() => onAccept(task._id)} disabled={accepting} className="min-h-9 rounded-lg bg-violet-600 px-3 font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">{accepting ? 'Accepting...' : 'Accept task'}</button> : null}</div> : <span className="font-bold text-slate-500">Already in progress</span>}
    </div>
  </article>
}
