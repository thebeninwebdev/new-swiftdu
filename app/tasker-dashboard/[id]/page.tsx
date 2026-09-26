'use client'
import { CafeInquiryPanel } from '@/components/cafe-inquiry'
import type { CafeInquiryFields } from '@/lib/cafe-inquiry'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTaskerWork, workButton } from '@/components/tasker/WorkProvider'
import { TaskOutcome } from '@/components/tasker/TaskOutcome'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Store,
  Wallet,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { acquireSharedSocket, releaseSharedSocket } from '@/lib/client-socket'
import { mergeOrderUpdate } from '@/lib/order-sync'
import { getCompletionWindowMinutes } from '@/lib/completion-timer'
import { canTaskerCancelOrder, isCustomerPaymentConfirmed } from '@/lib/order-status'
import { convertToNaira } from '@/lib/utils'
import { RESTAURANT_MAX_PEOPLE } from '@/lib/pricing'
import { useVisibleInterval } from '@/hooks/use-visible-interval'

const DETAIL_REFRESH_MS = 5000

// ─── Types ───
interface ErrandDetail extends CafeInquiryFields {
  _id: string
  userId: string
  cafeInquiry?: boolean
  cafeInquiryDetailsSubmitted?: boolean
  taskType: string
  description: string
  amount: number
  commission: number
  platformFee: number
  taskerFee: number
  serviceFeeDiscountApplied?: boolean
  serviceFeeDiscountGrantedByPhone?: string
  discountCommissionAmount?: number
  totalAmount: number
  noteSize?: 'small' | 'big'
  numberOfPages?: number
  drawingPages?: number
  copyNotesType?: string
  copyNotesPages?: number
  deadline?: string
  dueDate?: string
  deadlineDate?: string
  deadlineValue?: number
  deadlineUnit?: string
  location: string
  store?: string
  packaging?: string
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  restaurantPackagingFee?: number
  indomiePacks?: number
  eggCount?: number
  waterBags?: number
  printingServiceType?: 'printing' | 'photocopying'
  printingNeedsEditing?: boolean
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerId?: string
  taskerName?: string
  acceptedAt?: string
  createdAt: string
  updatedAt?: string
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
  hasPaid?: boolean
  isDeclinedTask?: boolean
  declinedMessage?: string
  declinedAt?: string
  paymentStatus?: 'unpaid' | 'initialized' | 'paid' | 'failed' | 'cancelled'
  taskerHasPaid?: boolean
  settlementStatus?: 'not_due' | 'pending' | 'initialized' | 'paid' | 'failed' | 'overdue'
  settlementDueAt?: string
  isTestOrder?: boolean
  createdInMode?: 'test' | 'live'
}

interface UserInfo {
  name: string
  email: string
  phone: string
  location: string
}

// ─── Constants ───
const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  copy_notes: 'Copy Notes',
  shopping: 'Shopping',
  indomie: 'Buy Indomie',
  dry_cleaning: 'Dry Cleaning',
  water: 'Bag of Water',
  others: 'General Errand',
}

const statusStyles: Record<ErrandDetail['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  in_progress: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
}

// ─── Helpers ───
const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatDeadline(dueDate?: string, deadlineDate?: string, deadlineValue?: number, deadlineUnit?: string) {
  const exactDeadline = dueDate || deadlineDate
  if (exactDeadline) return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(exactDeadline))
  if (deadlineValue && deadlineUnit) return `${deadlineValue} ${deadlineUnit}`
  return 'Not set'
}

function formatRestaurantPackaging(errand: Pick<ErrandDetail, 'packaging' | 'restaurantTakeawayCount' | 'restaurantPeopleCount'>) {
  const takeawayCount = Number(errand.restaurantTakeawayCount || 0)
  const peopleCount = Number(errand.restaurantPeopleCount || 1)
  if (takeawayCount > 0 && peopleCount > 1 && takeawayCount < peopleCount) {
    return `${takeawayCount} takeaway, ${peopleCount - takeawayCount} cellophane`
  }
  if (takeawayCount > 0) {
    return takeawayCount === 1 ? 'Takeaway pack' : `${takeawayCount} takeaway packs`
  }
  return errand.packaging || 'Cellophane'
}

function formatWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('234')) return digits
  if (digits.startsWith('0')) return `234${digits.slice(1)}`
  if (digits.length === 10) return `234${digits}`
  return digits
}

function getWhatsappLink(phone: string, errand: ErrandDetail, userName?: string) {
  const whatsappPhone = formatWhatsappPhone(phone)
  if (!whatsappPhone) return ''
  const taskLabel = taskTypeLabels[errand.taskType] || errand.taskType
  const message = `Hi ${userName || 'there'}, I'm your SwiftDU tasker for the ${taskLabel} task.`
  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
}

// ─── Timer Ring Component ───
function getTaskTitle(errand: ErrandDetail) {
  if (errand.store === 'tasker_choose') return 'Get food from any store'
  if (errand.cafeInquiry) return `Check what is available at ${errand.store || 'the cafe'}`
  if (errand.taskType === 'restaurant') return `Get food from ${errand.store || 'the restaurant'}`
  if (errand.taskType === 'printing') return errand.printingServiceType === 'photocopying' ? 'Photocopy these notes' : 'Print these notes'
  if (errand.taskType === 'copy_notes') return 'Copy these notes'
  if (errand.taskType === 'water') return `Get ${errand.waterBags || 1} bag${Number(errand.waterBags || 1) === 1 ? '' : 's'} of water`
  if (errand.taskType === 'indomie') return 'Get Indomie'
  if (errand.taskType === 'dry_cleaning') return 'Pick up dry cleaning'
  return errand.description || 'Complete this errand'
}

function getStoreDisplayName(store?: string) {
  return store === 'tasker_choose' ? 'Any store' : store
}

function getTaskDetails(errand: ErrandDetail, packaging: string) {
  const details: string[] = []
  if (errand.taskType === 'indomie') {
    details.push(`${errand.indomiePacks || 0} Indomie`)
    if (errand.eggCount) details.push(`${errand.eggCount} egg${errand.eggCount === 1 ? '' : 's'}`)
  } else if (errand.taskType === 'water') details.push(`${errand.waterBags || 1} bag${Number(errand.waterBags || 1) === 1 ? '' : 's'} of water`)
  else if (errand.taskType === 'printing') {
    if (errand.numberOfPages) details.push(`${errand.numberOfPages} pages`)
    details.push(errand.printingServiceType === 'photocopying' ? 'Photocopying' : 'Black & white printing')
    if (errand.printingNeedsEditing) details.push('Editing needed')
  } else if (errand.taskType === 'copy_notes') {
    if (errand.copyNotesPages || errand.numberOfPages) details.push(`${errand.copyNotesPages || errand.numberOfPages} pages`)
    if (errand.copyNotesType || errand.noteSize) details.push(`${errand.copyNotesType || errand.noteSize} note`)
  } else if (errand.description) details.push(errand.description)
  if (errand.taskType === 'restaurant' && (!errand.cafeInquiryStatus || errand.cafeInquiryDetailsSubmitted)) details.push(`Packaging: ${packaging}`)
  return details
}

function getTaskerNextStep(errand: ErrandDetail, paid: boolean, review: boolean, settlementDue: boolean) {
  if (review) return { title: 'We’re checking this payment', detail: 'Don’t hand over the order yet. SwiftDU will update you.', tone: 'rose' }
  if (paid) return { title: errand.cafeInquiry ? 'Finish the cafe check' : 'Give the order to the customer', detail: errand.cafeInquiry ? 'Share what is available, then confirm the inquiry is done.' : 'Then tap “Order delivered.”', tone: 'emerald' }
  if (settlementDue) return { title: 'Task completed', detail: 'Send SwiftDU’s service fee to finish this task.', tone: 'amber' }
  if (errand.status === 'completed') return { title: 'Task completed', detail: 'No more action is required.', tone: 'emerald' }
  return { title: errand.cafeInquiry ? 'Check the cafe' : 'Waiting for customer payment', detail: errand.cafeInquiry ? 'Share what is available, then wait for payment.' : 'Get the order ready, but do not hand it over yet.', tone: 'indigo' }
}

// ─── Main Page ───
export default function ErrandDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const preview = searchParams.get('preview') === 'true'
  const work = useTaskerWork()
  const [acceptedConfirmation, setAcceptedConfirmation] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const errandId = String(params?.id || '')

  const [errand, setErrandState] = useState<ErrandDetail | null>(null)
  const errandRef = useRef<ErrandDetail | null>(null)
  const setErrand = useCallback((incoming: ErrandDetail) => {
    const next = mergeOrderUpdate(errandRef.current, incoming)
    errandRef.current = next
    setErrandState(next)
    return next
  }, [])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'complete' | 'cancel' | 'report' | 'people' | 'clearDeclined' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showConfirmModal, setShowConfirmModal] = useState<'complete' | 'cancel' | null>(null)

  const previousSnapshotRef = useRef<{ status: ErrandDetail['status']; hasPaid: boolean; isDeclinedTask: boolean } | null>(null)
  const fetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)

  useVisibleInterval(() => setNowMs(Date.now()), errand ? 1000 : null)

  const loadErrand = useCallback(async (initial = false) => {
    if (!errandId) return
    if (fetchingRef.current) { queuedRefreshRef.current = true; return }
    fetchingRef.current = true
    try {
      const isPreview = preview && !errandRef.current?.taskerId
      const errandRes = await fetch(isPreview ? `/api/errands/${errandId}` : `/api/orders/${errandId}`, { cache: 'no-store' })
      if (errandRes.status === 401) { router.push('/auth'); return }
      if (!errandRes.ok) { const payload = await errandRes.json(); throw new Error(payload.error || 'Failed to fetch errand details') }
      const errandData = setErrand(await errandRes.json() as ErrandDetail)

      const userRes = errandData.taskerId && errandData.userId ? await fetch(`/api/users/${errandData.userId}`) : null
      if (userRes?.ok) { const userData = await userRes.json(); setUserInfo(userData) }
      else setUserInfo(null)

      if (!initial && previousSnapshotRef.current) {
        if (!previousSnapshotRef.current.hasPaid && Boolean(errandData.hasPaid)) {
          toast.success('Customer confirmed payment. You can now complete the delivery.')
        }
        if (!previousSnapshotRef.current.isDeclinedTask && Boolean(errandData.isDeclinedTask)) {
          toast.error(errandData.declinedMessage || 'This task has been flagged for transfer review.')
        }
        if (previousSnapshotRef.current.status !== errandData.status && errandData.status === 'cancelled') {
          toast.error('This errand was cancelled.')
        }
      }

      previousSnapshotRef.current = { status: errandData.status, hasPaid: Boolean(errandData.hasPaid), isDeclinedTask: Boolean(errandData.isDeclinedTask) }
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load errand details')
    } finally {
      fetchingRef.current = false
      setLoading(false)
      if (queuedRefreshRef.current) { queuedRefreshRef.current = false; void loadErrand(false) }
    }
  }, [errandId, router, setErrand, preview])

  useEffect(() => { void loadErrand(true) }, [loadErrand])

  useVisibleInterval(
    () => {
      if (errandId) void loadErrand(false)
    },
    errandId ? DETAIL_REFRESH_MS : null
  )

  useEffect(() => {
    if (!errandId) return
    const socket = acquireSharedSocket()
    const handleConnect = () => { socket.emit('order:watch', errandId); void loadErrand(false) }
    const handleOrderUpdate = (payload?: { _id?: string }) => { if (!payload?._id || payload._id === errandId) void loadErrand(false) }
    socket.on('connect', handleConnect)
    socket.on('order:updated', handleOrderUpdate)
    handleConnect()
    return () => {
      socket.off('connect', handleConnect)
      socket.off('order:updated', handleOrderUpdate)
      if (socket.connected) socket.emit('order:unwatch', errandId)
      releaseSharedSocket(socket)
    }
  }, [errandId, loadErrand])

  const handleAction = async (action: 'complete' | 'cancel') => {
    if (action === 'cancel' && errand && !canTaskerCancelOrder(errand)) {
      setShowConfirmModal(null)
      toast.error('Customer payment has already been confirmed, so this errand can no longer be cancelled.')
      return
    }
    try {
      setActionLoading(action)
      setShowConfirmModal(null)
      const nextStatus = action === 'complete' ? 'completed' : 'cancelled'
      const response = await fetch(`/api/orders/${errandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await response.json()
      if (!response.ok) { setError(payload.error || `Failed to ${action} errand`); return }
      setErrand(payload)
      previousSnapshotRef.current = { status: payload.status, hasPaid: Boolean(payload.hasPaid), isDeclinedTask: Boolean(payload.isDeclinedTask) }
      toast.success(action === 'complete' ? 'Errand marked as completed.' : 'Errand cancelled successfully.')
      window.dispatchEvent(new Event('swiftdu-work-updated'))
      if (action === 'cancel') router.replace('/tasker-dashboard')
    } catch { setError(`Failed to ${action} errand`) }
    finally { setActionLoading(null) }
  }

  const acceptTask = async () => {
    if (accepting) return
    setAccepting(true); setError(null)
    try {
      const response = await fetch('/api/errands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: errandId }) })
      const payload = await response.json()
      if (!response.ok) {
        if (response.status === 409) { toast.error(payload.error || 'Another tasker accepted this task.'); router.replace('/tasker-dashboard?view=all'); return }
        throw new Error(payload.error || 'Could not accept task.')
      }
      setErrand(payload); setAcceptedConfirmation(true)
      if (payload.serviceFeeDiscountApplied && payload.serviceFeeDiscountGrantedByPhone) toast('Customer discount active', { description: 'Contact ' + payload.serviceFeeDiscountGrantedByPhone + ' to collect your commission.' })
      window.dispatchEvent(new Event('swiftdu-work-updated'))
    } catch (error) { setError(error instanceof Error ? error.message : 'Check your connection and try again.') }
    finally { setAccepting(false) }
  }

  const handleReportTransferIssue = async () => {
    try {
      setActionLoading('report')
      setError(null)
      const response = await fetch(`/api/orders/${errandId}/report-transfer-issue`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) { setError(payload.error || 'Failed to report transfer issue'); return }
      setErrand(payload.order)
      previousSnapshotRef.current = { status: payload.order.status, hasPaid: Boolean(payload.order.hasPaid), isDeclinedTask: Boolean(payload.order.isDeclinedTask) }
      toast.success('Transfer issue submitted for admin review.')
    } catch { setError('Failed to report transfer issue') }
    finally { setActionLoading(null) }
  }

  const handleClearDeclinedTask = async () => {
    try {
      setActionLoading('clearDeclined')
      setError(null)
      const response = await fetch(`/api/orders/${errandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearDeclinedTask: true }),
      })
      const payload = await response.json()
      if (!response.ok) { setError(payload.error || 'Failed to clear declined task flag'); return }
      setErrand(payload)
      previousSnapshotRef.current = { status: payload.status, hasPaid: Boolean(payload.hasPaid), isDeclinedTask: Boolean(payload.isDeclinedTask) }
      toast.success('Declined task flag cleared.')
    } catch { setError('Failed to clear declined task flag') }
    finally { setActionLoading(null) }
  }

  const handleRestaurantPeopleUpdate = async (peopleCount: number) => {
    if (!errand || errand.taskType !== 'restaurant') return
    try {
      setActionLoading('people')
      setError(null)
      const response = await fetch(`/api/orders/${errandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantPeopleCount: peopleCount }),
      })
      const payload = await response.json()
      if (!response.ok) { setError(payload.error || 'Failed to update the restaurant order count'); return }
      setErrand(payload)
      previousSnapshotRef.current = { status: payload.status, hasPaid: Boolean(payload.hasPaid), isDeclinedTask: Boolean(payload.isDeclinedTask) }
      toast.success('Restaurant order count updated. The customer total has been recalculated.')
    } catch { setError('Failed to update the restaurant order count') }
    finally { setActionLoading(null) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Loading task...</p>
        </div>
      </div>
    )
  }

  if (!errand) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <XCircle className="mx-auto h-12 w-12 text-rose-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Task not found</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error || 'This task may have been removed or you no longer have access to it.'}</p>
          <Button onClick={() => router.push('/tasker-dashboard')} className="mt-6 h-11 w-full rounded-2xl bg-sky-600 text-white hover:bg-sky-700">Back to dashboard</Button>
        </div>
      </div>
    )
  }

  const isActive = errand.status === 'pending' || errand.status === 'in_progress' || errand.status === 'paid'
  const paymentConfirmed = isCustomerPaymentConfirmed(errand)
  const transferUnderReview = Boolean(errand.isDeclinedTask)
  const taskerCanCancel = canTaskerCancelOrder(errand)
  const settlementOutstanding = !errand.isTestOrder && errand.status === 'completed' && !errand.taskerHasPaid && errand.settlementStatus !== 'paid'
  const whatsappLink = userInfo ? getWhatsappLink(userInfo.phone, errand, userInfo.name) : ''
  const restaurantPeopleCount = Number.isInteger(Number(errand.restaurantPeopleCount || 0)) && Number(errand.restaurantPeopleCount || 0) > 0 ? Number(errand.restaurantPeopleCount) : 1
  const restaurantPackaging = formatRestaurantPackaging(errand)
  const canUpdateRestaurantPeople = Boolean(errand.taskerId) && errand.taskType === 'restaurant' && !errand.cafeInquiryStatus && isActive && !paymentConfirmed && !transferUnderReview

  // Timer calculations
  const completionStartedMs = errand.completionTimerStartedAt ? new Date(errand.completionTimerStartedAt).getTime() : new Date(errand.createdAt).getTime()
  const locationCompletionWindowMinutes = getCompletionWindowMinutes(errand.location, errand.taskType)
  const savedCompletionWindowMinutes = Number(errand.completionWindowMinutes || 0)
  const completionWindowMinutes = savedCompletionWindowMinutes > 0 ? Math.max(savedCompletionWindowMinutes, locationCompletionWindowMinutes) : locationCompletionWindowMinutes
  const completionExtensionMinutes = Number(errand.completionExtensionMinutes || 0)
  const computedCompletionDueMs = completionStartedMs + (completionWindowMinutes + completionExtensionMinutes) * 60000
  const savedCompletionDueMs = errand.completionDueAt ? new Date(errand.completionDueAt).getTime() : NaN
  const completionDueMs = Number.isFinite(savedCompletionDueMs) && Number.isFinite(computedCompletionDueMs) ? Math.max(savedCompletionDueMs, computedCompletionDueMs) : Number.isFinite(savedCompletionDueMs) ? savedCompletionDueMs : computedCompletionDueMs
  const hasCompletionTimer = errand.status !== 'completed' && paymentConfirmed && Number.isFinite(completionDueMs) && Number.isFinite(completionStartedMs) && errand.status !== 'cancelled'
  const completionRemainingMs = hasCompletionTimer ? completionDueMs - nowMs : 0
  const completionTimerExpired = hasCompletionTimer && completionRemainingMs <= 0
  const completionWindowMs = completionWindowMinutes > 0 ? completionWindowMinutes * 60000 : completionDueMs - completionStartedMs
  const completionProgress = hasCompletionTimer && completionWindowMs > 0 ? Math.min(100, Math.max(0, ((nowMs - completionStartedMs) / completionWindowMs) * 100)) : 0
  const nextStep = getTaskerNextStep(errand, paymentConfirmed, transferUnderReview, settlementOutstanding)

  if (acceptedConfirmation) return <TaskOutcome task={errand} onContinue={() => { setAcceptedConfirmation(false); router.replace('/tasker-dashboard/' + errand._id) }} />
  if (errand.status === 'completed') return <TaskOutcome task={errand} completed settlementDue={settlementOutstanding} />

  return (
    <div className="min-h-screen bg-[#faf9ff] dark:bg-slate-950 pb-48">
      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => router.push('/tasker-dashboard')} className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusStyles[errand.status]}`}>
            {errand.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <h1 className="text-2xl font-black tracking-tight">{getTaskTitle(errand)}</h1>
        <p className="text-sm text-slate-500">{errand.cafeInquiry ? 'Cafe inquiry' : taskTypeLabels[errand.taskType]} <span aria-hidden="true">•</span> Order #{errand._id.slice(-6)}</p>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {errand.taskerId && errand.cafeInquiryStatus && <CafeInquiryPanel order={errand} tasker whatsappHref={whatsappLink} onUpdated={() => { void loadErrand(false) }} />}
        {errand.isTestOrder ? (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
            <p className="font-bold">Training task</p>
            <p className="mt-1">No real money is involved.</p>
          </div>
        ) : null}

        {/* ─── Order Header Card ─── */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-white px-5 py-4 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Order #{errand._id.slice(-6)}</p>
              {errand.isTestOrder ? (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/30">
                  Test Order
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 text-lg font-bold">What to do</h2>
            <div className="mt-2 space-y-1 text-base font-semibold leading-6">{getTaskDetails(errand, restaurantPackaging).map(detail => <p key={detail}>{detail}</p>)}</div>
          </div>

          {/* ─── ABOVE THE FOLD: Timer + WhatsApp ─── */}
          <div className="p-4 space-y-4">
            {/* Timer */}
            {hasCompletionTimer ? (
              <div className={`rounded-xl p-3 ${completionTimerExpired || completionRemainingMs <= 5 * 60 * 1000 ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
                <div className="flex items-center gap-2 font-bold"><Clock className="h-5 w-5" />{completionTimerExpired ? 'Time is up' : `${formatDuration(completionRemainingMs)} left`}</div>
                <p className="mt-1 text-sm opacity-75">{completionTimerExpired ? 'Finish the delivery as soon as possible.' : `Try to complete this delivery within ${completionWindowMinutes} minutes.`}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-current" style={{ width: `${completionTimerExpired ? 100 : completionProgress}%` }} /></div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <Clock className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{formatDeadline(errand.dueDate || errand.deadline, errand.deadlineDate, errand.deadlineValue, errand.deadlineUnit)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Deadline</p>
                </div>
              </div>
            )}

            {/* WhatsApp Chat Button */}
            {errand.taskerId && isActive && (whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="h-5 w-5" />
                Chat with Customer on WhatsApp
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold">
                Customer WhatsApp contact is unavailable
              </div>
            ))}

            {/* Quick Info Row */}
            <div className="border-y border-slate-100 py-4 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Go to</p>
              <div className="mt-2 flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" /><div><p className="text-lg font-bold text-slate-900 dark:text-white">{getStoreDisplayName(errand.store) || errand.location}</p>{errand.store && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{errand.location}</p>}</div></div>
            </div>

            {/* Packaging (for restaurant) */}
            {errand.taskType === 'restaurant' && (!errand.cafeInquiryStatus || errand.cafeInquiryDetailsSubmitted) && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3">
                <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Packaging</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{restaurantPackaging}</p>
                </div>
              </div>
            )}

            {errand.taskType === 'indomie' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-3">
                  <Store className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Indomie</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{errand.indomiePacks || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3">
                  <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Eggs</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{errand.eggCount || 0}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Payment Status */}
            <div className={`flex items-center gap-3 rounded-xl p-3 ${
              transferUnderReview
                ? 'bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50'
                : paymentConfirmed
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50'
                  : 'bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                transferUnderReview ? 'bg-rose-500' : paymentConfirmed ? 'bg-emerald-500' : 'bg-sky-500'
              }`}>
                {transferUnderReview ? <AlertCircle className="h-4 w-4 text-white" /> : paymentConfirmed ? <CheckCircle2 className="h-4 w-4 text-white" /> : <Clock className="h-4 w-4 text-white" />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {nextStep.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {nextStep.detail}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Customer Card ─── */}
        {userInfo && errand.taskerId && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Customer</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                {userInfo.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 dark:text-white truncate">{userInfo.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{userInfo.phone}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2"><a href={`tel:${userInfo.phone}`} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-bold text-slate-800 dark:bg-slate-800 dark:text-white"><Phone className="h-4 w-4" />Call</a>{whatsappLink ? <a href={whatsappLink} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-bold text-white"><MessageCircle className="h-4 w-4" />WhatsApp</a> : <p className="flex items-center justify-center text-sm text-slate-500">WhatsApp unavailable</p>}</div>
          </div>
        )}

        {/* ─── Restaurant People Count ─── */}
        {canUpdateRestaurantPeople && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-slate-900 dark:text-white">How many people is this order for?</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">Changes service fee</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: RESTAURANT_MAX_PEOPLE }, (_, i) => i + 1).map((people) => (
                <button
                  key={people}
                  type="button"
                  onClick={() => void handleRestaurantPeopleUpdate(people)}
                  disabled={actionLoading === 'people'}
                  className={`h-11 rounded-xl text-sm font-bold transition active:scale-95 ${
                    people === restaurantPeopleCount
                      ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {actionLoading === 'people' && people === restaurantPeopleCount ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : people}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Transfer Summary ─── */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4">
          <p className="font-bold text-slate-900 dark:text-white mb-3">Money</p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Customer sends you</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{convertToNaira(errand.totalAmount || errand.amount + errand.commission)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">You earn</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {convertToNaira(errand.serviceFeeDiscountApplied ? errand.discountCommissionAmount || errand.taskerFee || 0 : errand.taskerFee || 0)}
              </span>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Customer budget</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{convertToNaira(errand.amount || 0)}</span>
            </div>
            {errand.platformFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">You send SwiftDU after delivery</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{convertToNaira(errand.platformFee)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Transfer Under Review Alert ─── */}
        {transferUnderReview && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-900 dark:text-rose-100">Payment problem reported</p>
                <p className="text-sm text-rose-700 dark:text-rose-200 mt-1">{errand.declinedMessage || 'SwiftDU is checking the payment. Do not hand over the order yet.'}</p>
                <Button
                  variant="outline"
                  onClick={() => void handleClearDeclinedTask()}
                  disabled={actionLoading === 'clearDeclined'}
                  className="mt-3 h-10 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/40"
                >
                  {actionLoading === 'clearDeclined' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Payment received after all
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 p-4 text-sm text-rose-700 dark:text-rose-200">
            {error}
          </div>
        )}
      </div>

      {/* ─── Bottom Action Bar ─── */}
      {errand.status === 'pending' && <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 p-4 backdrop-blur lg:left-72 dark:bg-slate-900"><div className="mx-auto max-w-2xl"><button className={workButton + ' w-full'} disabled={accepting || !work.data?.checkedIn || !work.data?.canCheckIn} onClick={() => void acceptTask()}>{accepting ? 'Accepting task...' : !work.data?.checkedIn ? 'Check in from Home to accept' : 'Accept task'}</button><button onClick={() => router.push('/tasker-dashboard?view=all')} className="min-h-11 w-full text-sm font-semibold">Not this one</button></div></div>}
      {errand.taskerId && isActive && !transferUnderReview && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
            {paymentConfirmed ? (
              <>
                <Button
                  onClick={() => setShowConfirmModal('complete')}
                  disabled={Boolean(actionLoading)}
                  className="h-12 w-full rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-60"
                >
                  {actionLoading === 'complete' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {errand.cafeInquiry ? 'Inquiry completed' : 'Order delivered'}
                </Button>
                <details className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800"><summary className="h-8 cursor-pointer list-none px-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Need help?</summary><div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleReportTransferIssue()}
                    disabled={Boolean(actionLoading)}
                    className="h-10 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  >
                    {actionLoading === 'report' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    Payment problem
                  </Button>
                  {taskerCanCancel ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirmModal('cancel')}
                      disabled={Boolean(actionLoading)}
                      className="h-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Cancel task
                    </Button>
                  ) : (
                    <div className="h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center px-2">
                      Cancel locked after payment
                    </div>
                  )}
                </div></details>
              </>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 p-3 text-center">
                  <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">Waiting for payment</p><p className="mt-1 text-xs text-sky-700 dark:text-sky-300">Do not hand over the order yet.</p>
                </div>
                {taskerCanCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmModal('cancel')}
                    disabled={Boolean(actionLoading)}
                    className="h-10 w-full rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Cancel task
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Closed Task Actions ─── */}
      {!isActive && (
        <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
              {settlementOutstanding && (
              <Button
                onClick={() => router.push(`/tasker-dashboard/payment/${errand._id}`)}
                className="h-12 w-full rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600"
              >
                Pay SwiftDU {convertToNaira(errand.platformFee)}
              </Button>
            )}
            <Button
              onClick={() => router.push('/tasker-dashboard')}
              className="h-12 w-full rounded-xl bg-sky-600 text-white font-bold hover:bg-sky-700"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* ─── Confirm Modal ─── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${showConfirmModal === 'complete' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400'}`}>
              {showConfirmModal === 'complete' ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              {showConfirmModal === 'complete' ? errand.cafeInquiry ? 'Have you checked the cafe?' : 'Has the customer received the order?' : 'Cancel this task?'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {showConfirmModal === 'complete'
                ? errand.cafeInquiry ? 'Only confirm after you have shared what is available with the customer.' : 'Only confirm after you have handed the order to the customer.'
                : 'Only cancel if you cannot complete this task.'}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(null)} className="h-11 flex-1 rounded-xl">{showConfirmModal === 'complete' ? 'Not yet' : 'Go back'}</Button>
              <Button
                onClick={() => handleAction(showConfirmModal)}
                className={`h-11 flex-1 rounded-xl text-white font-bold ${showConfirmModal === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {showConfirmModal === 'complete' ? errand.cafeInquiry ? 'Yes, checked' : 'Yes, delivered' : 'Yes, cancel task'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
