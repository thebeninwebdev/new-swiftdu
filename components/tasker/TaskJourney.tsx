'use client'

import { Check, Circle } from 'lucide-react'
import { CategoryBadge, type TaskCardData } from './TaskCards'
import { taskerEarnings } from '@/lib/tasker-work'
import { convertToNaira } from '@/lib/utils'
import { workCard } from './WorkProvider'

export function TaskJourney({ task }: { task: TaskCardData }) {
  const pickupLabel = ['printing', 'copy_notes'].includes(task.taskType) ? 'SERVICE / COLLECTION' : task.taskType === 'dry_cleaning' ? 'COLLECTION' : 'PICKUP'
  return <section className={workCard}>
    <CategoryBadge type={task.taskType} />
    <p className="mt-5 text-4xl font-black tracking-tight text-violet-700 dark:text-violet-300">{convertToNaira(taskerEarnings(task))}</p>
    <p className="mt-1 text-xs text-slate-500">{task.isTestOrder ? 'Simulated earnings · training task' : task.status === 'completed' ? 'Task earnings' : 'Estimated earnings'}</p>
    <div className="mt-6 border-l-2 border-dotted border-violet-200 pl-5"><p className="text-[10px] font-bold tracking-widest text-violet-600">{pickupLabel}</p><p className="mt-1 font-bold">{task.store || 'Follow task instructions'}</p><p className="mt-6 text-[10px] font-bold tracking-widest text-violet-600">{task.cafeInquiry ? 'CUSTOMER LOCATION' : 'DELIVER TO'}</p><p className="mt-1 font-bold">{task.location}</p></div>
    {task.cafeInquiry && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Cafe inquiry: check availability and share options with the customer. Items and pricing may need confirmation.</p>}
  </section>
}

export function ActiveTaskStepper({ paid, inquiry, inquiryReady, review, completed }: { paid: boolean; inquiry: boolean; inquiryReady: boolean; review: boolean; completed: boolean }) {
  const labels = inquiry ? ['Task accepted', 'Check cafe and share availability', 'Confirm service charge', 'Complete inquiry'] : ['Task accepted', 'Arrange pickup and delivery', 'Customer payment confirmed', 'Complete delivery']
  // Only backend events advance the stepper; pickup is guidance, not a fabricated status.
  const current = completed ? 4 : review ? 1 : paid ? 3 : inquiry && inquiryReady ? 2 : 1
  return <section className={workCard}><h2 className="mb-4 font-bold">Your next steps</h2><ol className="space-y-4">{labels.map((label, i) => <li key={label} aria-current={i === current ? 'step' : undefined} className="flex items-center gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < current ? 'bg-emerald-100 text-emerald-700' : i === current ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i < current ? <Check size={16} /> : i + 1}</span><span className={`text-sm ${i === current ? 'font-bold' : 'text-slate-500'}`}>{label}</span></li>)}</ol><p className="mt-4 text-xs leading-5 text-slate-500">{review ? 'Resolve the transfer review before completing this task.' : completed ? 'Completion confirmed.' : paid ? inquiry ? 'Finish the cafe check, then confirm completion below.' : 'Hand the order to the customer, then confirm delivery below.' : 'Coordinate with the customer. Completion unlocks after their payment is confirmed.'}</p></section>
}
