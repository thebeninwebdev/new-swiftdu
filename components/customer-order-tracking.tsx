'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, Circle, MessageCircle, Phone, UserRound, X } from 'lucide-react'
import { OrderMascot } from './order-mascot'
import { getTrackingEta, getTrackingStore, type TrackingOrder, type TrackingStage } from '@/lib/order-tracking'
import { convertToNaira } from '@/lib/utils'

export interface CustomerTrackingOrder extends TrackingOrder {
  _id: string
  taskType: string
  description: string
  amount: number
  commission: number
  totalAmount?: number
  location: string
  packaging?: string
  taskerName?: string
  isTestOrder?: boolean
  deadline?: string
  dueDate?: string
  deadlineDate?: string
  deadlineValue?: number
  deadlineUnit?: string
}

export function TrackingHero({ order, stage, nowMs, searchMessage }: {
  order: CustomerTrackingOrder
  stage: TrackingStage
  nowMs: number
  searchMessage?: { heading: string; detail: string; phase: 0 | 1 | 2 | 3 }
}) {
  const eta = getTrackingEta(order, nowMs)
  const searching = stage.key === 'searching' ? searchMessage : undefined
  return (
    <section aria-label="Current order status" className="rounded-[1.75rem] bg-[#f2eeff] p-5 text-violet-950 dark:bg-violet-950/35 dark:text-violet-100 sm:p-7">
      <div role="status" aria-atomic="true">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />{stage.label}
        </p>
        <h1 className="mt-4 max-w-md text-[1.65rem] font-extrabold leading-tight tracking-tight sm:text-3xl">{searching?.heading || stage.title}</h1>
        <p className="mt-3 max-w-md break-words text-sm leading-6 text-violet-900/80 dark:text-violet-200">{searching?.detail || stage.detail}</p>
      </div>
      <div className="flex justify-center py-3">
        <OrderMascot mood={stage.mood} interaction={stage.mood === 'success' ? 'complete' : stage.mood === 'matched' ? 'celebrate' : stage.mood === 'warning' ? 'attention' : stage.mood === 'searching' ? 'scan' : 'consider'} searchPhase={searching?.phase} size="md" />
      </div>
      {eta ? <div className="border-t border-violet-200/70 pt-4 dark:border-violet-800">
        <p className="text-sm font-semibold">{eta.label}</p>
        {eta.time ? <p className="mt-1 text-2xl font-extrabold tabular-nums">{eta.time}</p> : null}
        <p className="mt-2 text-xs leading-5 text-violet-900/75 dark:text-violet-200">{eta.detail}</p>
      </div> : null}
      {order.isTestOrder ? <p className="mt-3 text-xs font-semibold">Training order · No real payment is required.</p> : null}
    </section>
  )
}

export function TrackingTimeline({ stage }: { stage: TrackingStage }) {
  return (
    <section aria-label="Order progress" className="py-7">
      <ol className="space-y-0">
        {stage.steps.map((label, index) => {
          const active = index === stage.activeIndex
          const completed = index < stage.activeIndex || stage.key === 'completed'
          return <li key={label} aria-current={active ? 'step' : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {index < stage.steps.length - 1 ? <span aria-hidden="true" className={`absolute bottom-0 left-[13px] top-7 w-px ${completed ? 'bg-violet-300 dark:bg-violet-700' : 'bg-slate-200 dark:bg-slate-800'}`} /> : null}
            <span aria-hidden="true" className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${completed ? 'bg-violet-600 text-white' : active ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-600 dark:bg-violet-950 dark:text-violet-200' : 'bg-white text-slate-400 dark:bg-slate-950'}`}>
              {stage.key === 'cancelled' ? <X className="h-4 w-4" /> : completed ? <Check className="h-4 w-4" /> : active ? <span className="h-2.5 w-2.5 rounded-full bg-current" /> : <Circle className="h-4 w-4" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm ${active ? 'font-bold text-violet-700 dark:text-violet-300' : completed ? 'font-medium text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}><span className="sr-only">{active ? 'Current: ' : completed ? 'Completed: ' : 'Upcoming: '}</span>{label}</p>
              {active ? <p className="mt-1 max-w-md break-words text-sm leading-6 text-slate-500 dark:text-slate-400">{stage.detail}</p> : null}
            </div>
          </li>
        })}
      </ol>
    </section>
  )
}

export function TrackingTasker({ order, tasker, loading, whatsappHref }: {
  order: CustomerTrackingOrder
  tasker: { name: string; phone: string } | null
  loading: boolean
  whatsappHref: string | null
}) {
  return <section className="border-t border-slate-100 py-6 dark:border-slate-800" aria-labelledby="tracking-tasker-heading">
    <h2 id="tracking-tasker-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">Your tasker</h2>
    {order.taskerId ? <>
      <div className="mt-4 flex items-center gap-3">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200"><UserRound className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><p className="break-words font-bold">{tasker?.name || order.taskerName || 'Your tasker'}</p><p className="mt-0.5 text-sm text-slate-500">{loading ? 'Loading contact details…' : 'Your SwiftDU tasker'}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"><MessageCircle aria-hidden="true" className="h-4 w-4" />Message</a> : null}
        {tasker?.phone ? <a href={`tel:${tasker.phone}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950"><Phone aria-hidden="true" className="h-4 w-4" />Call tasker</a> : null}
        {!loading && !tasker?.phone ? <p className="text-sm text-slate-500">Contact details are unavailable. You can reach support below.</p> : null}
      </div>
    </> : <p className="mt-3 text-sm leading-6 text-slate-500">{order.status === 'cancelled' ? 'No tasker was assigned to this order.' : 'Their name and contact details will appear here once someone accepts.'}</p>}
  </section>
}

function getDeadline(order: CustomerTrackingOrder) {
  const date = order.dueDate || order.deadline || order.deadlineDate
  if (date && Number.isFinite(Date.parse(date))) return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(date))
  return order.deadlineValue && order.deadlineUnit ? `${order.deadlineValue} ${order.deadlineUnit}` : null
}

export function TrackingOrderSummary({ order }: { order: CustomerTrackingOrder }) {
  const store = getTrackingStore(order)
  const deadline = getDeadline(order)
  const total = order.totalAmount ?? order.amount + order.commission
  const inquiry = Boolean(order.cafeInquiry || order.cafeInquiryStatus)
  return <section className="border-t border-slate-100 py-6 dark:border-slate-800" aria-labelledby="tracking-order-heading">
    <h2 id="tracking-order-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">Your order</h2>
    {store ? <p className="mt-4 break-words text-lg font-bold">{store}</p> : null}
    <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 [overflow-wrap:anywhere]">{order.description || (inquiry ? 'Check what is available at the cafe.' : 'Your task request')}</p>
    {order.cafeSelectedItems?.length ? <ul className="mt-3 space-y-2 text-sm">{order.cafeSelectedItems.map((item, index) => <li key={`${item.itemId}-${index}`} className="flex justify-between gap-3"><span className="min-w-0 break-words">{item.quantity} × {item.name}{item.unit ? ` (${item.unit})` : ''}</span><span className="shrink-0 font-semibold">{convertToNaira(item.price * item.quantity)}</span></li>)}</ul> : null}
    {order.packaging ? <p className="mt-2 break-words text-sm text-slate-500">{order.packaging}</p> : null}
    <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm"><span>{inquiry ? 'Inquiry charge' : 'Estimated order cost'}</span><span className="text-lg font-bold tabular-nums">{convertToNaira(inquiry ? total : order.amount)}</span></div>
    <details className="mt-3">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold text-violet-700 dark:text-violet-300">View details <span aria-hidden="true">↓</span></summary>
      <dl className="space-y-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
        <div className="flex justify-between gap-4"><dt className="text-slate-500">Deliver to</dt><dd className="min-w-0 break-words text-right font-medium">{order.location}</dd></div>
        {!inquiry ? <div className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">Order estimate{order.taskType === 'restaurant' ? ' (includes packaging)' : ''}</dt><dd className="font-medium">{convertToNaira(order.amount)}</dd></div> : null}
        <div className="flex justify-between gap-4"><dt className="text-slate-500">{inquiry ? 'Inquiry service fee' : 'SwiftDU service fee'}</dt><dd className="font-medium">{convertToNaira(order.commission)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="font-semibold">Total</dt><dd className="font-bold">{convertToNaira(total)}</dd></div>
        {deadline ? <div className="flex justify-between gap-4"><dt className="text-slate-500">Requested deadline</dt><dd className="min-w-0 text-right font-medium">{deadline}</dd></div> : null}
        <div className="flex justify-between gap-4"><dt className="text-slate-500">Order number</dt><dd className="font-medium">#{order._id.slice(-6)}</dd></div>
      </dl>
    </details>
  </section>
}

export function TrackingSupport({ children }: { children?: ReactNode }) {
  return <section className="border-t border-slate-100 py-6 dark:border-slate-800">
    <h2 className="font-bold">Need help?</h2>
    <p className="mt-2 text-sm leading-6 text-slate-500">If you have an issue with your order, we’re here to help.</p>
    <Link href="/contact-us" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-50 px-4 text-sm font-semibold text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-200">Contact support</Link>
    {children ? <div className="mt-4 flex flex-wrap gap-3">{children}</div> : null}
  </section>
}
