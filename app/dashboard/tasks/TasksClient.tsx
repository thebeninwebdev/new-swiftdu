'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle, ArrowRight, CheckCircle2, Clock, CreditCard, Loader2,
  MapPin, Package, Phone, RefreshCw, Store, UserRoundX, XCircle,
  Bike, MessageCircle, ChevronRight, Banknote,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { getCompletionWindowMinutes } from '@/lib/completion-timer'
import { canCustomerCancelOrder } from '@/lib/order-status'

// ─── Types ───
interface Order {
  _id: string
  taskType: string
  description: string
  amount: number
  platformFee?: number
  totalAmount?: number
  deadline?: string
  dueDate?: string
  deadlineDate?: string
  deadlineValue?: number
  deadlineUnit?: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  packaging?: string
  cafeInquiry?: boolean
  cafeInquiryFeePaid?: boolean
  cafeInquiryDetailsSubmitted?: boolean
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerName?: string
  taskerId?: string
  createdAt: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  paymentStatus?: 'unpaid' | 'initialized' | 'paid' | 'failed' | 'cancelled'
  paymentLink?: string
  paymentFailureReason?: string
  completionTimerStartedAt?: string
  completionDueAt?: string
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  completedBeforeTimer?: boolean
  platformFeeWaivedForFastCompletion?: boolean
  customerReceiptConfirmed?: boolean
  customerReceiptRespondedAt?: string
  prematureCompletionReported?: boolean
  prematureCompletionReportedAt?: string
  commission: number
  isTestOrder?: boolean
  createdInMode?: 'test' | 'live'
}

type OrderRealtimePayload = Partial<Order> & { _id?: string }

interface TaskerDetails {
  _id: string
  name: string
  phone: string
  profileImage?: string | null
  bankDetails?: { bankName: string; accountName: string; accountNumber: string }
}

type OrderHistoryTab = 'ongoing' | 'completed' | 'cancelled'

interface OrdersPageProps { trackingOrderId?: string }

const TRACKING_REFRESH_MS = 5000

// ─── Constants ───
const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery', printing: 'Printing', copy_notes: 'Copy Notes',
  shopping: 'Shopping', dry_cleaning: 'Dry Cleaning', water: 'Bag of Water', others: 'General Errand',
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  restaurant: <Store className="h-4 w-4" />, printing: <Package className="h-4 w-4" />,
  copy_notes: <Package className="h-4 w-4" />, shopping: <Package className="h-4 w-4" />,
  dry_cleaning: <Package className="h-4 w-4" />, water: <Package className="h-4 w-4" />,
  others: <Package className="h-4 w-4" />,
}

const taskTypeGradients: Record<string, string> = {
  restaurant: 'from-orange-400 to-red-500', printing: 'from-violet-400 to-purple-600',
  copy_notes: 'from-blue-400 to-indigo-600', shopping: 'from-amber-400 to-orange-500',
  dry_cleaning: 'from-cyan-400 to-teal-600', water: 'from-sky-400 to-blue-600',
  others: 'from-slate-400 to-slate-600',
}

const taskerSearchImages = [
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=360&q=80',
  'https://images.unsplash.com/photo-1624561172888-ac93c696e10c?auto=format&fit=crop&w=360&q=80',
]

const statusConfig: Record<Order['status'], { label: string; tone: string; icon: React.ReactNode }> = {
  pending: { label: 'Finding tasker', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', icon: <Clock className="h-3.5 w-3.5" /> },
  in_progress: { label: 'In progress', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  paid: { label: 'Transfer confirmed', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  completed: { label: 'Completed', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', icon: <XCircle className="h-3.5 w-3.5" /> },
}

const declinedStatusConfig = {
  label: 'Payment under review', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300', icon: <AlertCircle className="h-3.5 w-3.5" />,
}

// ─── Helpers ───
function formatDeadline(dueDate?: string, deadlineDate?: string, deadlineValue?: number, deadlineUnit?: string) {
  const exactDeadline = dueDate || deadlineDate
  if (exactDeadline) return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(exactDeadline))
  if (deadlineValue && deadlineUnit) return `${deadlineValue} ${deadlineUnit}`
  return 'Not set'
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount)
const formatDate = (date: string) => new Date(date).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
const getWhatsAppHref = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('0') && digits.length === 11 ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}
const getDeliveryEta = (location: string) => {
  const normalizedLocation = location.toLowerCase()
  if (normalizedLocation.includes('amnesty') || normalizedLocation.includes('girls hostel')) {
    return '25 mins'
  }
  return '1 hour'
}
const canRetryOrder = (order: Order) => order.status === 'completed' || order.status === 'cancelled'
const getMostRecentOrder = (orders: Order[]) => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
const shouldRedirectToReview = (order: Order) => order.status === 'completed' && Boolean(order.taskerId)
function getTaskerSearchMessage(elapsedMs: number) {
  const elapsedMinutes = elapsedMs / 60000
  if (elapsedMinutes < 1) return 'Connecting you to nearby taskers'
  if (elapsedMinutes < 3) return 'Searching beyond your hostel area'
  if (elapsedMinutes < 5) return 'This request is taking longer than usual'
  return 'Still looking for available taskers'
}
function getTrackingStage(order: Order) {
  if (order.status === 'completed') return { label: 'Delivered', detail: 'Your order has reached you.', progress: 100, taskerLabel: 'Delivered' }
  if (order.hasPaid || order.status === 'paid') return { label: 'Tasker on the way', detail: 'Your tasker is moving with your order.', progress: 78, taskerLabel: 'En route' }
  if (order.taskerId || order.status === 'in_progress') return { label: 'Order accepted', detail: 'Your order is being prepared. Confirm payment so fulfilment can keep moving.', progress: 45, taskerLabel: 'Assigned' }
  return { label: 'Finding a tasker', detail: 'We are matching this order with an available tasker.', progress: 18, taskerLabel: 'Searching' }
}

// ─── Sub-components ───
function TaskerAvatar({ tasker }: { tasker: TaskerDetails }) {
  if (tasker.profileImage) {
    return <img src={tasker.profileImage} alt="Tasker profile" className="h-12 w-12 rounded-xl object-cover ring-2 ring-white dark:ring-slate-800" />
  }
  return <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 font-bold text-white">T</div>
}

function FulfillmentStatusCard({
  order,
  amount,
  statusLabel,
  supportHref,
}: {
  order: Order
  amount: string
  statusLabel: string
  supportHref: string | null
}) {
  const stage = getTrackingStage(order)
  const gradient = taskTypeGradients[order.taskType] || taskTypeGradients.others
  const taskLabel = taskTypeLabels[order.taskType] || order.taskType
  const hasConfirmedPayment = Boolean(order.hasPaid || order.paymentStatus === 'paid')

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 text-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-slate-100 ring-1 ring-white/15">
            {order.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />}
            {statusLabel}
          </span>
          <span className="text-xs font-semibold text-slate-400">#{order._id.slice(-6)}</span>
        </div>
        <div className="mt-7 flex items-start gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg shadow-black/20`}>
            {taskTypeIcons[order.taskType] || taskTypeIcons.others}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-normal sm:text-3xl">
              {order.status === 'completed' ? 'Order delivered' : 'Your order is being fulfilled'}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{stage.detail}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-slate-400">
            <span>{stage.taskerLabel}</span>
            <span>{stage.progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-500 transition-all duration-700"
              style={{ width: `${stage.progress}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:ring-slate-800">
            <p className="text-[11px] font-bold uppercase text-slate-400">Task</p>
            <p className="mt-2 truncate text-sm font-black text-slate-900 dark:text-white">{taskLabel}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:ring-slate-800">
            <p className="text-[11px] font-bold uppercase text-slate-400">Budget</p>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{amount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/60 dark:ring-slate-800">
            <p className="text-[11px] font-bold uppercase text-slate-400">Payment</p>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-white">{hasConfirmedPayment ? 'Confirmed' : 'Pending'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white">SwiftDU is handling the next step</p>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                Stay reachable while your tasker fulfils the order and updates you directly.
              </p>
            </div>
            {supportHref ? (
              <a href={supportHref} target="_blank" rel="noreferrer" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600">
                <MessageCircle className="h-4 w-4" />
                Chat
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function FulfillmentTimeline({ order }: { order: Order }) {
  const stages = [
    { key: 'placed', label: 'Order placed', desc: 'Your request has been received.', completed: true },
    { key: 'assigned', label: 'Tasker assigned', desc: 'A tasker has accepted the order.', completed: Boolean(order.taskerId) },
    { key: 'paid', label: 'Payment confirmed', desc: 'Your transfer has been verified.', completed: Boolean(order.hasPaid || order.paymentStatus === 'paid') },
    {
      key: 'fulfilling',
      label: 'Being fulfilled',
      desc: 'Your tasker is working on the order.',
      completed: order.status === 'completed',
      active: order.status === 'in_progress' || order.status === 'paid' || Boolean(order.hasPaid),
    },
    { key: 'delivered', label: 'Delivered', desc: 'Order has reached you.', completed: order.status === 'completed', active: order.status === 'completed' },
  ]

  return (
    <div className="relative">
      <div className="absolute bottom-2 left-5 top-2 w-0.5 bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-5">
        {stages.map((stage) => (
          <div key={stage.key} className="relative flex items-start gap-4">
            <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
              stage.completed ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : stage.active ? 'bg-sky-500 shadow-lg shadow-sky-500/20' : 'bg-slate-200 dark:bg-slate-700'
            }`}>
              {stage.completed ? <CheckCircle2 className="h-5 w-5 text-white" /> : stage.active ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Clock className="h-5 w-5 text-slate-400" />}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <p className={`font-bold ${stage.completed ? 'text-slate-900 dark:text-white' : stage.active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-500'}`}>{stage.label}</p>
              <p className="text-sm leading-5 text-slate-500 dark:text-slate-400">{stage.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AddTimePrompt({
  remainingLabel,
  windowLabel,
  canAddTime,
  isAdding,
  onAddTime,
}: {
  remainingLabel: string
  windowLabel: string
  canAddTime: boolean
  isAdding: boolean
  onAddTime: () => void
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-lg shadow-amber-100/60 dark:border-amber-900/60 dark:bg-slate-900 dark:shadow-none">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-950 dark:text-white">Need more time for this order?</p>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
              {canAddTime
                ? `There is ${remainingLabel} left. Tap once to give your tasker 10 extra minutes.`
                : 'If the task will take longer you can increase the tasker time.'}
            </p>
            <p className="mt-2 text-xs font-bold uppercase text-slate-400">{windowLabel}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onAddTime}
          disabled={!canAddTime || isAdding}
          className="h-12 w-full rounded-xl bg-amber-600 px-5 text-sm font-black text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isAdding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding time...
            </>
          ) : (
            <>
              <Clock className="mr-2 h-4 w-4" />
              Add 10 minutes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function CancelTaskPrompt({
  isCancelling,
  disabled,
  onCancel,
}: {
  isCancelling: boolean
  disabled: boolean
  onCancel: () => void
}) {
  return (
    <div className="mb-6 overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-lg shadow-rose-100/60 dark:border-rose-900/60 dark:bg-slate-900 dark:shadow-none">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
            <XCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-950 dark:text-white">Need to cancel this task?</p>
            <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
              You can cancel before payment is confirmed. We will stop this request and taskers will no longer see it.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={disabled}
          className="h-12 w-full rounded-xl border-rose-200 bg-rose-50 px-5 text-sm font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50 sm:w-auto"
        >
          {isCancelling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cancelling...
            </>
          ) : (
            <>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel this task
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function MobileBottomSheet({ order, onChat }: { order: Order; onChat: () => void }) {
  const stage = getTrackingStage(order)
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="mx-auto max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl shadow-slate-950/20 border-t border-slate-100 dark:border-slate-800 p-4 pb-8">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-3"/>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
            {order.status === 'pending' ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Bike className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{stage.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{stage.detail}</p>
          </div>
          <button onClick={onChat} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0">Chat</button>
        </div>
      </div>
    </div>
  )
}

function SearchingTaskerOverlay({ order, onCancel, isCancelling, isBusy, searchMessage }: {
  order: Order; onCancel: () => void; isCancelling: boolean; isBusy: boolean; searchMessage: string
}) {
  const [taskerImageIndex, setTaskerImageIndex] = useState(() => Math.floor(Math.random() * taskerSearchImages.length))
  const taskerImage = taskerSearchImages[taskerImageIndex]
  useEffect(() => {
    const imageInterval = window.setInterval(() => setTaskerImageIndex((current) => (current + 1) % taskerSearchImages.length), 500)
    return () => window.clearInterval(imageInterval)
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 backdrop-blur-sm md:items-center md:justify-center md:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-white/70 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-800 dark:bg-slate-900 md:rounded-[2rem]">
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 pb-5 pt-5 text-white">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25 md:hidden" />
          <div className="flex flex-col">
            <div className="min-w-0 flex-1">
              <h2 className="mt-2 text-2xl font-bold tracking-normal">Finding tasker</h2>
              <p className="mt-2 text-sm leading-6 text-slate-200">{searchMessage}</p>
            </div>
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full origin-left rounded-full bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-300 animate-pulse" />
          </div>
          <div className="mt-5 flex shrink-0 flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <div className="h-20 w-20 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
              <img src={taskerImage} alt="Potential tasker" className="h-full w-full object-cover" />
            </div>
            <button type="button" onClick={onCancel} disabled={isBusy} className="flex w-full max-w-xs shrink-0 items-center justify-center gap-3 rounded-2xl bg-rose-500 px-4 py-3 text-left text-white shadow-lg shadow-rose-950/20 ring-1 ring-white/15 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-64">
              {isCancelling ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserRoundX className="h-5 w-5" />}
              <span className="min-w-0">
                <span className="block text-sm font-black">{isCancelling ? 'Cancelling task...' : 'Cancel this task'}</span>
                <span className="block text-xs font-medium text-rose-50">Stop looking for a tasker</span>
              </span>
            </button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Task</p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-white">{taskTypeLabels[order.taskType] || order.taskType}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Amount</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(order.totalAmount || order.amount)}</p>
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5" />{order.location}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <Clock className="h-3.5 w-3.5" />{formatDeadline(order.dueDate || order.deadline, order.deadlineDate, order.deadlineValue, order.deadlineUnit)}
              </span>
            </div>
          </div>
          {isCancelling ? <p className="text-center text-xs font-medium text-rose-500 dark:text-rose-300">Cancelling task...</p> : null}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───
export default function OrdersPage({ trackingOrderId }: OrdersPageProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const legacyRequestedOrderId = searchParams.get('orderId')
  const isTrackingPage = Boolean(trackingOrderId)
  const requestedOrderId = trackingOrderId || legacyRequestedOrderId

  const [loading, setLoading] = useState(true)
  const [, setRefreshing] = useState(false)
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [searchElapsedMs, setSearchElapsedMs] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState<OrderHistoryTab>('ongoing')
  const [taskerDetails, setTaskerDetails] = useState<TaskerDetails | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [loadingTasker, setLoadingTasker] = useState(false)
  const [updatingAction, setUpdatingAction] = useState<'cancel' | 'retry' | 'extendTimer' | 'receiptYes' | 'receiptNo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trackedOrderIdRef = useRef<string | null>(trackingOrderId || null)
  const previousSnapshotRef = useRef<{ id: string; taskerId?: string; hasPaid?: boolean; isDeclinedTask?: boolean } | null>(null)
  const taskerOrderRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)
  const queuedReloadRef = useRef(false)
  const queuedInitialReloadRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const currentOrderRef = useRef<Order | null>(null)
  const realtimeResumeTimeoutRef = useRef<number | null>(null)
  const redirectedToReviewRef = useRef<string | null>(null)
  const autoCancelledOrderRef = useRef<string | null>(null)

  useEffect(() => { currentOrderRef.current = currentOrder }, [currentOrder])
  useEffect(() => { if (!trackingOrderId && legacyRequestedOrderId) router.replace(`/dashboard/tasks/${legacyRequestedOrderId}`) }, [legacyRequestedOrderId, router, trackingOrderId])
  useEffect(() => { const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000); return () => window.clearInterval(intervalId) }, [])

  const disconnectSocket = useCallback(() => {
    if (realtimeResumeTimeoutRef.current) { window.clearTimeout(realtimeResumeTimeoutRef.current); realtimeResumeTimeoutRef.current = null }
    socketRef.current?.disconnect(); socketRef.current = null
  }, [])

  const pauseRealtimeForApi = useCallback((duration = 1200) => {
    const socket = socketRef.current; if (!socket) return
    if (realtimeResumeTimeoutRef.current) window.clearTimeout(realtimeResumeTimeoutRef.current)
    if (socket.connected) socket.disconnect()
    realtimeResumeTimeoutRef.current = window.setTimeout(() => { realtimeResumeTimeoutRef.current = null; if (socketRef.current === socket && !socket.connected) socket.connect() }, duration)
  }, [])

  const fetchWithRealtimePause = useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    pauseRealtimeForApi(); try { return await fetch(input, init) } finally { pauseRealtimeForApi() }
  }, [pauseRealtimeForApi])

  const loadOrders = useCallback(async (initial = false) => {
    if (fetchingRef.current) { queuedReloadRef.current = true; queuedInitialReloadRef.current = queuedInitialReloadRef.current || initial; return }
    fetchingRef.current = true; if (initial) setLoading(true); else setRefreshing(true)
    try {
      let nextCurrentOrder: Order | null = null
      if (trackedOrderIdRef.current) {
        const trackedResponse = await fetch(`/api/orders/${trackedOrderIdRef.current}`, { cache: 'no-store' })
        if (trackedResponse.ok) {
          const trackedOrder: Order = await trackedResponse.json(); nextCurrentOrder = trackedOrder
          if (shouldRedirectToReview(trackedOrder) && redirectedToReviewRef.current !== trackedOrder._id) {
            redirectedToReviewRef.current = trackedOrder._id; toast.success('Task completed. Please rate your tasker.'); router.replace(`/dashboard/reviews/${trackedOrder._id}`); return
          }
        } else { trackedOrderIdRef.current = null; if (isTrackingPage) throw new Error('Order not found') }
      }
      if (!nextCurrentOrder && isTrackingPage) {
        const currentResponse = await fetch('/api/orders?current=true', { cache: 'no-store' })
        if (!currentResponse.ok) throw new Error('Failed to fetch current order'); nextCurrentOrder = await currentResponse.json()
      }
      const recentResponse = await fetch('/api/orders?status=in_progress,completed,cancelled', { cache: 'no-store' })
      if (!recentResponse.ok) throw new Error('Failed to fetch recent orders')
      const recentData: Order[] = await recentResponse.json()
      const mostRecentOngoingOrder = !isTrackingPage && !legacyRequestedOrderId ? getMostRecentOrder(recentData.filter((order) => order.status === 'in_progress')) : null
      if (mostRecentOngoingOrder) { router.replace(`/dashboard/tasks/${mostRecentOngoingOrder._id}`); return }
      if (nextCurrentOrder && previousSnapshotRef.current?.id === nextCurrentOrder._id) {
        if (shouldRedirectToReview(nextCurrentOrder) && redirectedToReviewRef.current !== nextCurrentOrder._id) {
          redirectedToReviewRef.current = nextCurrentOrder._id; toast.success('Task completed. Please rate your tasker.'); router.replace(`/dashboard/reviews/${nextCurrentOrder._id}`); return
        }
        if (!previousSnapshotRef.current.taskerId && nextCurrentOrder.taskerId) toast.success('A tasker accepted your order.')
        if (!previousSnapshotRef.current.hasPaid && nextCurrentOrder.hasPaid) toast.success('Your transfer has been confirmed. Your task is now moving.')
        if (!previousSnapshotRef.current.isDeclinedTask && Boolean(nextCurrentOrder.isDeclinedTask)) toast.error(nextCurrentOrder.declinedMessage || 'We could not confirm that transfer. Our team will contact you within 24 hours.')
      }
      previousSnapshotRef.current = nextCurrentOrder ? { id: nextCurrentOrder._id, taskerId: nextCurrentOrder.taskerId, hasPaid: nextCurrentOrder.hasPaid, isDeclinedTask: nextCurrentOrder.isDeclinedTask } : null
      trackedOrderIdRef.current = isTrackingPage ? nextCurrentOrder?._id || null : null
      setCurrentOrder(nextCurrentOrder); setRecentOrders(recentData); setError(null)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load orders') }
    finally {
      fetchingRef.current = false; setLoading(false); setRefreshing(false)
      if (queuedReloadRef.current) { const nextInitial = queuedInitialReloadRef.current; queuedReloadRef.current = false; queuedInitialReloadRef.current = false; void loadOrders(nextInitial) }
    }
  }, [isTrackingPage, legacyRequestedOrderId, router])

  const applyRealtimeOrderUpdate = useCallback((payload?: OrderRealtimePayload) => {
    if (!payload?._id) return false
    const existingOrder = currentOrderRef.current
    const isCurrentOrder = existingOrder?._id === payload._id
    const isTrackedOrder = trackedOrderIdRef.current === payload._id
    if (!isCurrentOrder && !isTrackedOrder) { setRecentOrders((previous) => previous.map((order) => order._id === payload._id ? ({ ...order, ...payload, _id: order._id } as Order) : order)); return false }
    if (existingOrder && isCurrentOrder) {
      const nextOrder = { ...existingOrder, ...payload, _id: existingOrder._id } as Order
      if (!existingOrder.taskerId && nextOrder.taskerId) toast.success('A tasker accepted your order.')
      if (!existingOrder.hasPaid && nextOrder.hasPaid) toast.success('Your transfer has been confirmed. Your task is now moving.')
      if (!existingOrder.isDeclinedTask && Boolean(nextOrder.isDeclinedTask)) toast.error(nextOrder.declinedMessage || 'We could not confirm that transfer. Our team will contact you within 24 hours.')
      previousSnapshotRef.current = { id: nextOrder._id, taskerId: nextOrder.taskerId, hasPaid: nextOrder.hasPaid, isDeclinedTask: nextOrder.isDeclinedTask }
      trackedOrderIdRef.current = nextOrder._id; currentOrderRef.current = nextOrder; setCurrentOrder(nextOrder)
      setRecentOrders((previous) => previous.map((order) => order._id === nextOrder._id ? ({ ...order, ...nextOrder } as Order) : order))
      if (shouldRedirectToReview(nextOrder) && redirectedToReviewRef.current !== nextOrder._id) { redirectedToReviewRef.current = nextOrder._id; toast.success('Task completed. Please rate your tasker.'); router.replace(`/dashboard/reviews/${nextOrder._id}`) }
      return true
    }
    return false
  }, [router])

  useEffect(() => { void loadOrders(true) }, [loadOrders])
  useEffect(() => { if (!isTrackingPage) return; if (!requestedOrderId || requestedOrderId === trackedOrderIdRef.current) return; trackedOrderIdRef.current = requestedOrderId; previousSnapshotRef.current = null; taskerOrderRef.current = null; setTaskerDetails(null); void loadOrders(true) }, [isTrackingPage, loadOrders, requestedOrderId])
  useEffect(() => { const onFocus = () => { void loadOrders(false) }; window.addEventListener('focus', onFocus); return () => { window.removeEventListener('focus', onFocus) } }, [loadOrders])
  useEffect(() => {
    if (!isTrackingPage) return

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadOrders(false)
    }, TRACKING_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [isTrackingPage, loadOrders])
  useEffect(() => {
    const socket = io({ withCredentials: true, transports: ['websocket'] }); socketRef.current = socket
    const watchCurrentOrder = () => { const orderId = trackedOrderIdRef.current || currentOrderRef.current?._id; if (orderId) socket.emit('order:watch', orderId) }
    socket.on('connect', () => { watchCurrentOrder(); void loadOrders(false) })
    socket.on('order:updated', (payload?: OrderRealtimePayload) => { const applied = applyRealtimeOrderUpdate(payload); if (!applied) { void loadOrders(false); return } window.setTimeout(() => { void loadOrders(false) }, 300) })
    watchCurrentOrder(); return () => { if (socketRef.current === socket) { disconnectSocket(); return } socket.disconnect() }
  }, [applyRealtimeOrderUpdate, disconnectSocket, loadOrders])
  useEffect(() => { const orderId = currentOrder?._id; const socket = socketRef.current; if (!socket || !orderId) return; socket.emit('order:watch', orderId); return () => { socket.emit('order:unwatch', orderId) } }, [currentOrder?._id])
  useEffect(() => {
    if (!currentOrder?.taskerId) { taskerOrderRef.current = null; setTaskerDetails(null); setLoadingTasker(false); return }
    if (taskerOrderRef.current === currentOrder._id) return; let cancelled = false
    const fetchTasker = async () => { try { setLoadingTasker(true); const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}/tasker`, { cache: 'no-store' }); if (!response.ok) throw new Error('Failed to fetch tasker details'); const data = await response.json(); if (!cancelled) { setTaskerDetails(data); taskerOrderRef.current = currentOrder._id } } catch { if (!cancelled) setTaskerDetails(null) } finally { if (!cancelled) setLoadingTasker(false) } }
    void fetchTasker(); return () => { cancelled = true }
  }, [currentOrder?._id, currentOrder?.taskerId, fetchWithRealtimePause])
  useEffect(() => { return () => { disconnectSocket() } }, [disconnectSocket])

  const transferUnderReview = Boolean(currentOrder?.isDeclinedTask)
  const needsCafeDetails = Boolean(currentOrder?.cafeInquiry && currentOrder.cafeInquiryFeePaid && !currentOrder.cafeInquiryDetailsSubmitted)
  const transferAmount = currentOrder?.cafeInquiry && currentOrder.cafeInquiryFeePaid ? Number(currentOrder.amount || 0) : Number(currentOrder?.totalAmount || currentOrder?.amount || 0)
  const needsPayment = Boolean(currentOrder?.taskerId && !currentOrder?.hasPaid && !transferUnderReview && !needsCafeDetails)
  const whatsappHref = taskerDetails?.phone ? getWhatsAppHref(taskerDetails.phone) : null

  useEffect(() => { if (needsPayment) { setPaymentModalOpen(true); return } setPaymentModalOpen(false) }, [currentOrder?._id, needsPayment])

  const handlePaymentModalOpenChange = (open: boolean) => {
    if (!open && needsPayment) {
      setPaymentModalOpen(true)
      return
    }

    setPaymentModalOpen(open)
  }

  const handleOpenOrder = (orderId: string) => { if (trackedOrderIdRef.current === orderId) return; trackedOrderIdRef.current = orderId; previousSnapshotRef.current = null; taskerOrderRef.current = null; setTaskerDetails(null); router.push(`/dashboard/tasks/${orderId}`); void loadOrders(false) }
  const handleConfirmTransfer = async () => { if (!currentOrder) return; try { setConfirmingTransfer(true); const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}/confirm-transfer`, { method: 'POST' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Failed to confirm the transfer.'); setCurrentOrder(payload.order); trackedOrderIdRef.current = payload.order?._id || currentOrder._id; previousSnapshotRef.current = payload.order ? { id: payload.order._id, taskerId: payload.order.taskerId, hasPaid: payload.order.hasPaid, isDeclinedTask: payload.order.isDeclinedTask } : null; setPaymentModalOpen(false); toast.success('Payment updated. Open WhatsApp and stay online for your tasker.') } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to confirm the transfer.'); void loadOrders(false) } finally { setConfirmingTransfer(false) } }
  const handleCancelOrder = useCallback(async () => { if (!currentOrder) return; try { setUpdatingAction('cancel'); const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to cancel order'); trackedOrderIdRef.current = null; taskerOrderRef.current = null; previousSnapshotRef.current = null; setTaskerDetails(null); setCurrentOrder(null); setRecentOrders((previous) => [data, ...previous.filter((order) => order._id !== data._id)]); toast.success('Order cancelled.'); router.replace('/dashboard/tasks'); void loadOrders(true) } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to cancel order') } finally { setUpdatingAction(null) } }, [currentOrder, fetchWithRealtimePause, loadOrders, router])
  const handleExtendCompletionTimer = useCallback(async () => { if (!currentOrder || updatingAction || confirmingTransfer) return; try { setUpdatingAction('extendTimer'); const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ extendCompletionTimer: true }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to add more time.'); setCurrentOrder(data); setRecentOrders((previous) => previous.map((order) => (order._id === data._id ? data : order))); toast.success('Ten minutes added for your tasker.') } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to add more time.') } finally { setUpdatingAction(null) } }, [confirmingTransfer, currentOrder, fetchWithRealtimePause, updatingAction])
  const handleReceiptAnswer = useCallback(async (receivedOrder: boolean) => { if (!currentOrder || updatingAction || confirmingTransfer) return; try { setUpdatingAction(receivedOrder ? 'receiptYes' : 'receiptNo'); const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerReceivedOrder: receivedOrder }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to update this task.'); setCurrentOrder(data); setRecentOrders((previous) => previous.map((order) => (order._id === data._id ? data : order))); toast.success(receivedOrder ? 'Thanks for confirming your order.' : 'Thanks. SwiftDU will review this completion.'); if (receivedOrder) { redirectedToReviewRef.current = data._id; router.replace(`/dashboard/reviews/${data._id}`) } } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update this task.') } finally { setUpdatingAction(null) } }, [confirmingTransfer, currentOrder, fetchWithRealtimePause, router, updatingAction])
  const handleRetryOrder = useCallback(async (order: Order) => { if (updatingAction || confirmingTransfer || !canRetryOrder(order)) return; try { setUpdatingAction('retry'); const response = await fetchWithRealtimePause(`/api/orders/${order._id}/retry`, { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to retry task'); trackedOrderIdRef.current = data._id; taskerOrderRef.current = null; previousSnapshotRef.current = { id: data._id, taskerId: data.taskerId, hasPaid: data.hasPaid, isDeclinedTask: data.isDeclinedTask }; setTaskerDetails(null); setCurrentOrder(data); setRecentOrders((previous) => [data, ...previous.filter((existingOrder) => existingOrder._id !== data._id && existingOrder._id !== order._id)]); toast.success('Task sent again. We are looking for taskers now.'); router.replace(`/dashboard/tasks/${data._id}`); void loadOrders(true) } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to retry task') } finally { setUpdatingAction(null) } }, [confirmingTransfer, fetchWithRealtimePause, loadOrders, router, updatingAction])
  const requestCancelOrder = useCallback(() => { if (!currentOrder || updatingAction === 'cancel' || confirmingTransfer) return; setCancelConfirmOpen(true) }, [confirmingTransfer, currentOrder, updatingAction])
  const confirmCancelOrder = useCallback(() => { setCancelConfirmOpen(false); void handleCancelOrder() }, [handleCancelOrder])

  useEffect(() => { if (!currentOrder || currentOrder.status !== 'pending') { setSearchElapsedMs(0); return } const startedAt = new Date(currentOrder.createdAt).getTime(); if (!Number.isFinite(startedAt)) { setSearchElapsedMs(0); return } const updateElapsed = () => { setSearchElapsedMs(Math.max(Date.now() - startedAt, 0)) }; updateElapsed(); const intervalId = window.setInterval(updateElapsed, 1000); return () => window.clearInterval(intervalId) }, [currentOrder, currentOrder?._id, currentOrder?.createdAt, currentOrder?.status])
  useEffect(() => { if (!currentOrder || currentOrder.status !== 'pending') return; if (searchElapsedMs < 7 * 60000) return; if (autoCancelledOrderRef.current === currentOrder._id) return; autoCancelledOrderRef.current = currentOrder._id; toast.error('No tasker accepted within 7 minutes, so the request was cancelled.'); void handleCancelOrder() }, [currentOrder, handleCancelOrder, searchElapsedMs])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading your orders...</p>
          </div>
        </div>
      </div>
    )
  }

  const historyOrders = currentOrder ? [currentOrder, ...recentOrders.filter((order) => order._id !== currentOrder._id)] : recentOrders
  const ongoingOrders = historyOrders.filter((order) => order.status === 'in_progress')
  const completedOrders = historyOrders.filter((order) => order.status === 'completed')
  const cancelledOrders = historyOrders.filter((order) => order.status === 'cancelled')
  const tabbedOrders = activeTab === 'ongoing' ? ongoingOrders : activeTab === 'completed' ? completedOrders : cancelledOrders
  const historyTabs: Array<{ value: OrderHistoryTab; label: string; count: number }> = [
    { value: 'ongoing', label: 'Ongoing', count: ongoingOrders.length },
    { value: 'completed', label: 'Completed', count: completedOrders.length },
    { value: 'cancelled', label: 'Cancelled', count: cancelledOrders.length },
  ]
  const currentStage = currentOrder ? getTrackingStage(currentOrder) : null
  const currentStatus = currentOrder ? (currentOrder.isDeclinedTask ? declinedStatusConfig : statusConfig[currentOrder.status]) : null
  const isSearchingForTasker = currentOrder?.status === 'pending'
  const canCancelCurrentOrder = currentOrder ? canCustomerCancelOrder(currentOrder) : false
  const completionStartedMs = currentOrder?.completionTimerStartedAt ? new Date(currentOrder.completionTimerStartedAt).getTime() : currentOrder?.createdAt ? new Date(currentOrder.createdAt).getTime() : NaN
  const locationCompletionWindowMinutes = getCompletionWindowMinutes(currentOrder?.location)
  const savedCompletionWindowMinutes = Number(currentOrder?.completionWindowMinutes || 0)
  const completionWindowMinutes = savedCompletionWindowMinutes > 0 ? Math.max(savedCompletionWindowMinutes, locationCompletionWindowMinutes) : locationCompletionWindowMinutes
  const completionExtensionMinutes = Number(currentOrder?.completionExtensionMinutes || 0)
  const computedCompletionDueMs = Number.isFinite(completionStartedMs) ? completionStartedMs + (completionWindowMinutes + completionExtensionMinutes) * 60000 : NaN
  const savedCompletionDueMs = currentOrder?.completionDueAt ? new Date(currentOrder.completionDueAt).getTime() : NaN
  const completionDueMs = Number.isFinite(savedCompletionDueMs) && Number.isFinite(computedCompletionDueMs) ? Math.max(savedCompletionDueMs, computedCompletionDueMs) : Number.isFinite(savedCompletionDueMs) ? savedCompletionDueMs : computedCompletionDueMs
  const hasCompletionTimer = Boolean(currentOrder?.hasPaid) && Number.isFinite(completionDueMs) && currentOrder?.status !== 'cancelled'
  const completionRemainingMs = hasCompletionTimer ? completionDueMs - nowMs : 0
  const completionTimerExpired = hasCompletionTimer && completionRemainingMs <= 0
  const completionWindowMs = completionWindowMinutes > 0 ? completionWindowMinutes * 60000 : completionDueMs - completionStartedMs
  const completionProgress = hasCompletionTimer && completionWindowMs > 0 ? Math.min(100, Math.max(0, ((nowMs - completionStartedMs) / completionWindowMs) * 100)) : 0
  const canExtendCompletionTimer = Boolean(currentOrder && currentOrder.hasPaid && currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled' && !completionTimerExpired)
  const completionRemainingLabel = completionTimerExpired ? '0:00' : formatDuration(completionRemainingMs)
  const completionWindowLabel = `${completionWindowMinutes}${completionExtensionMinutes ? ` + ${completionExtensionMinutes}` : ''} min window`
  const shouldAskReceiptQuestion = Boolean(currentOrder?.status === 'completed' && currentOrder.hasPaid && currentOrder.customerReceiptConfirmed === undefined && !currentOrder.customerReceiptRespondedAt)

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-slate-50 dark:bg-slate-950">
      {currentOrder && isSearchingForTasker ? (
        <SearchingTaskerOverlay order={currentOrder} onCancel={requestCancelOrder} isCancelling={updatingAction === 'cancel'} isBusy={updatingAction === 'cancel' || confirmingTransfer} searchMessage={getTaskerSearchMessage(searchElapsedMs)} />
      ) : null}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-sky-600 dark:text-sky-400">Order tracking</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Your order is being fulfilled</h1>
          </div>
        </div>
        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}
        {isTrackingPage && currentOrder && hasCompletionTimer && canExtendCompletionTimer ? (
          <AddTimePrompt
            remainingLabel={completionRemainingLabel}
            windowLabel={completionWindowLabel}
            canAddTime={canExtendCompletionTimer}
            isAdding={updatingAction === 'extendTimer' || confirmingTransfer}
            onAddTime={() => void handleExtendCompletionTimer()}
          />
        ) : null}
        {isTrackingPage && currentOrder && canCancelCurrentOrder && !isSearchingForTasker ? (
          <CancelTaskPrompt
            isCancelling={updatingAction === 'cancel'}
            disabled={updatingAction === 'cancel' || confirmingTransfer}
            onCancel={requestCancelOrder}
          />
        ) : null}
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">

          {/* Left Column: Active Delivery */}
          <div className="space-y-6">
            {isTrackingPage && currentOrder ? (
              <div className="space-y-4">
                <FulfillmentStatusCard
                  order={currentOrder}
                  amount={formatCurrency(transferAmount)}
                  statusLabel={currentStatus?.label || currentStage?.label || currentOrder.status}
                  supportHref={whatsappHref}
                />
                {currentOrder.taskerId && taskerDetails ? (
                  <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/30">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <TaskerAvatar tasker={taskerDetails} />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-white truncate">{taskerDetails.name || 'Tasker'}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Top Rated Tasker • 4.9★</p>
                        <div className="flex items-center gap-2 mt-1">
                         
                          <span className="text-xs text-slate-400">
                            ETA: {getDeliveryEta(currentOrder.location)}
                          </span>
                        </div>
                      </div>
                      {whatsappHref ? (
                        <a href={whatsappHref} target="_blank" rel="noreferrer" className="shrink-0 p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95">
                          <MessageCircle className="w-5 h-5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : loadingTasker ? (
                  <div className="flex items-center gap-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-900">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    <p className="text-sm text-slate-500">Loading tasker details...</p>
                  </div>
                ) : null}
                {currentOrder.isTestOrder ? (
                  <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
                    <p className="font-bold">Test Order</p>
                    <p className="mt-1">Training order - no real payment will be made.</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isTrackingPage && currentOrder ? (
              <div className="rounded-3xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/30 dark:shadow-slate-950/30 border border-slate-100 dark:border-slate-800 p-6 transition-all hover:shadow-xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Order Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Location</span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{currentOrder.location}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Banknote className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Amount</span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{formatCurrency(transferAmount)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Deadline</span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{formatDeadline(currentOrder.dueDate || currentOrder.deadline, currentOrder.deadlineDate, currentOrder.deadlineValue, currentOrder.deadlineUnit)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-400 uppercase">Store</span>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{currentOrder.store || 'Not specified'}</p>
                  </div>
                </div>
                {canCancelCurrentOrder && !isSearchingForTasker ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white">Cancel this order</p>
                        <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                          You can cancel this task before payment is confirmed.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={requestCancelOrder}
                        disabled={updatingAction === 'cancel' || confirmingTransfer}
                        className="h-11 w-full rounded-xl border-rose-200 bg-white px-4 text-sm font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50 sm:w-auto"
                      >
                        {updatingAction === 'cancel' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel order
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ) : null}
                {currentOrder.hasPaid ? (
                  <div className="mt-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-emerald-900 dark:text-emerald-300">Payment Confirmed</p>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">Your transfer has been verified. Tasker is now proceeding with your order.</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {hasCompletionTimer ? (
                  <div
                    className={`mt-4 rounded-2xl border p-4 ${
                      completionTimerExpired
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'
                        : 'border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20'
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                          <Clock className={`h-4 w-4 ${completionTimerExpired ? 'text-amber-600' : 'text-sky-600'}`} />
                          {completionTimerExpired ? 'Tasker time has run out' : `${formatDuration(completionRemainingMs)} left`}
                        </p>
                        <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                          {completionTimerExpired
                            ? 'The countdown has ended, so extra time can no longer be added.'
                            : 'Use the add-time panel at the top of this page if your tasker needs a little more time.'}
                        </p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">{completionWindowLabel}</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/80">
                      <div
                        className={`h-full rounded-full ${completionTimerExpired ? 'bg-amber-500' : 'bg-sky-500'}`}
                        style={{ width: `${completionTimerExpired ? 100 : completionProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {shouldAskReceiptQuestion ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <p className="text-sm font-black text-slate-900 dark:text-white">Did you receive this order?</p>
                    <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">Confirm delivery so we can close this task properly.</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <Button
                        type="button"
                        onClick={() => void handleReceiptAnswer(true)}
                        disabled={updatingAction === 'receiptYes' || updatingAction === 'receiptNo' || confirmingTransfer}
                        className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"
                      >
                        {updatingAction === 'receiptYes' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : 'Yes, received'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleReceiptAnswer(false)}
                        disabled={updatingAction === 'receiptYes' || updatingAction === 'receiptNo' || confirmingTransfer}
                        className="h-11 rounded-xl"
                      >
                        {updatingAction === 'receiptNo' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : 'No, report issue'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isTrackingPage && !currentOrder ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-white/80 bg-white/95 px-6 py-12 text-center shadow-2xl shadow-slate-950/10 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Package className="h-8 w-8 text-slate-400" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">No active orders</h2>
                <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">Book a new task to get started.</p>
                <Button onClick={() => router.push('/dashboard')} className="mt-6 h-11 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-6 text-white hover:from-sky-700 hover:to-indigo-700">Book a Task<ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            ) : null}
          </div>

          {/* Right Column: Timeline & History */}
          <div className="space-y-6 lg:mt-0 mt-6">

            {isTrackingPage && currentOrder ? (
              <div className="rounded-3xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/30 dark:shadow-slate-950/30 border border-slate-100 dark:border-slate-800 p-6 transition-all hover:shadow-xl">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">Delivery Progress</h3>
                <FulfillmentTimeline order={currentOrder} />
              </div>
            ) : null}

            {/* Order History Tabs */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/30 dark:shadow-slate-950/30 border border-slate-100 dark:border-slate-800 overflow-hidden transition-all hover:shadow-xl">
              <div className="flex border-b border-slate-100 dark:border-slate-800">
                {historyTabs.map((tab) => (
                  <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} 
                    className={`flex-1 py-4 px-4 text-sm font-bold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      activeTab === tab.value ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                    {tab.label}
                    <span className={`ml-1.5 text-xs px-2 py-0.5 rounded-full ${activeTab === tab.value ? 'bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{tab.count}</span>
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                {tabbedOrders.length > 0 ? tabbedOrders.map((order) => {
                  const status = order.isDeclinedTask ? declinedStatusConfig : statusConfig[order.status]
                  const retryable = canRetryOrder(order)
                  const gradient = taskTypeGradients[order.taskType] || taskTypeGradients.others
                  return (
                    <div key={order._id} className="group flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/20 transition-all cursor-pointer border border-transparent hover:border-sky-200 dark:hover:border-sky-900">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md shrink-0`}>
                        {taskTypeIcons[order.taskType] || taskTypeIcons.others}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{taskTypeLabels[order.taskType] || order.taskType}</p>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.tone}`}>{status.label}</span>
                          {order.isTestOrder ? (
                            <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                              Test Order
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{formatDate(order.createdAt)} • {formatCurrency(order.totalAmount || order.amount)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {order.status === 'in_progress' ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleOpenOrder(order._id)} className="h-9 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30">Track</Button>
                        ) : null}
                        {retryable ? (
                          <Button type="button" size="sm" variant="outline" disabled={updatingAction === 'retry' || confirmingTransfer} onClick={() => void handleRetryOrder(order)} className="h-9 rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-300 dark:hover:bg-orange-950/30">
                            {updatingAction === 'retry' ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}Retry
                          </Button>
                        ) : null}
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-sky-500 transition-colors" />
                      </div>
                    </div>
                  )
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No {activeTab} orders</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            {isTrackingPage && currentOrder && currentOrder.taskerId ? (
              <div className="grid gap-3">
                <a href={whatsappHref || '#'} target="_blank" rel="noreferrer" className="p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/30 dark:shadow-slate-950/30 border border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2 text-center transition-all hover:shadow-xl hover:-translate-y-0.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Call Tasker</span>
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Sheet */}
      {isTrackingPage && currentOrder && currentOrder.taskerId && !isSearchingForTasker ? (
        <MobileBottomSheet order={currentOrder} onChat={() => { if (whatsappHref) window.open(whatsappHref, '_blank') }} />
      ) : null}

      {/* Cancel Dialog */}
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this task?</DialogTitle>
            <DialogDescription>Taskers will stop seeing this request. You can create a new task anytime if you still need help.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCancelConfirmOpen(false)} disabled={updatingAction === 'cancel'} className="h-11 rounded-xl">Keep searching</Button>
            <Button type="button" onClick={confirmCancelOrder} disabled={updatingAction === 'cancel'} className="h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700">
              {updatingAction === 'cancel' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling...</> : 'Cancel task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={needsPayment || paymentModalOpen} onOpenChange={handlePaymentModalOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!needsPayment}>
          <DialogHeader>
            <DialogTitle>Transfer to your tasker</DialogTitle>
            <DialogDescription>
              {currentOrder?.isTestOrder ? (
                <>Training order - no real payment will be made. Tap &quot;I have paid&quot; to simulate payment.</>
              ) : (
                <>Send <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(transferAmount)}</span> to the account below, then tap &quot;I have paid&quot;.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Transfer Amount</p>
              <p className="mt-2 text-3xl font-bold">{formatCurrency(transferAmount)}</p>
            </div>
            {loadingTasker && !taskerDetails ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-5 dark:border-slate-800">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                <p className="text-sm text-slate-600 dark:text-slate-300">Loading transfer details...</p>
              </div>
            ) : null}
            {taskerDetails?.bankDetails ? (
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Bank</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{taskerDetails.bankDetails.bankName?.toUpperCase() || 'Not available'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Account Name</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{taskerDetails.bankDetails.accountName?.toUpperCase() || 'Not available'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-sky-50/70 px-4 py-4 dark:border-slate-800 dark:bg-sky-950/20">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Account Number</p>
                  <p className="mt-2 text-2xl font-bold tracking-[0.08em] text-slate-900 dark:text-white">{taskerDetails.bankDetails.accountNumber || 'Not available'}</p>
                </div>
              </div>
            ) : null}
            {(currentOrder?.paymentStatus === 'failed' || currentOrder?.paymentStatus === 'cancelled') && !currentOrder?.isDeclinedTask ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                {currentOrder?.paymentFailureReason || 'The transfer confirmation could not be completed.'}
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button onClick={() => void handleConfirmTransfer()} disabled={confirmingTransfer || !taskerDetails?.bankDetails?.accountNumber} className="h-12 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700">
              {confirmingTransfer ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating order...</> : <><CreditCard className="mr-2 h-4 w-4" />I have paid</>}
            </Button>
            {needsPayment ? (
              <p className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                Keep this open until you have made the transfer and tapped &quot;I have paid&quot;.
              </p>
            ) : (
              <Button type="button" variant="outline" onClick={() => setPaymentModalOpen(false)} disabled={confirmingTransfer} className="h-12 rounded-xl">Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
