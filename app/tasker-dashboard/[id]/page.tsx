'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { acquireSharedSocket, fetchWithSocketPause, releaseSharedSocket } from '@/lib/client-socket'
import { canTaskerCancelOrder, isCustomerPaymentConfirmed } from '@/lib/order-status'
import { convertToNaira } from '@/lib/utils'
import { RESTAURANT_MAX_PEOPLE } from '@/lib/pricing'

const DETAIL_REFRESH_MS = 5000

// ─── Types ───
interface ErrandDetail {
  _id: string
  userId: string
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
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerId?: string
  taskerName?: string
  acceptedAt?: string
  createdAt: string
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
const formatDate = (date: string) =>
  new Date(date).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

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
function TimerRing({ progress, timeLeft, label, expired }: { progress: number; timeLeft: string; label: string; expired: boolean }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200 dark:text-slate-700" />
          <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
            className={expired ? 'text-amber-500' : 'text-sky-500'}
            style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-black ${expired ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{timeLeft}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───
export default function ErrandDetailPage() {
  const router = useRouter()
  const params = useParams()
  const errandId = String(params?.id || '')

  const [errand, setErrand] = useState<ErrandDetail | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'complete' | 'cancel' | 'report' | 'people' | 'clearDeclined' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showConfirmModal, setShowConfirmModal] = useState<'complete' | 'cancel' | null>(null)

  const previousSnapshotRef = useRef<{ status: ErrandDetail['status']; hasPaid: boolean; isDeclinedTask: boolean } | null>(null)
  const fetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const loadErrand = useCallback(async (initial = false) => {
    if (!errandId) return
    if (fetchingRef.current) { queuedRefreshRef.current = true; return }
    fetchingRef.current = true
    try {
      const errandRes = await fetchWithSocketPause(`/api/orders/${errandId}`, { cache: 'no-store' })
      if (errandRes.status === 401) { router.push('/login'); return }
      if (!errandRes.ok) throw new Error('Failed to fetch errand details')
      const errandData: ErrandDetail = await errandRes.json()
      setErrand(errandData)

      const userRes = await fetchWithSocketPause(`/api/users/${errandData.userId}`)
      if (userRes.ok) { const userData = await userRes.json(); setUserInfo(userData) }
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
    } catch {
      setError('Failed to load errand details')
    } finally {
      fetchingRef.current = false
      setLoading(false)
      if (queuedRefreshRef.current) { queuedRefreshRef.current = false; void loadErrand(false) }
    }
  }, [errandId, router])

  useEffect(() => { void loadErrand(true) }, [loadErrand])

  useEffect(() => {
    if (!errandId) return
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void loadErrand(false) }, DETAIL_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [errandId, loadErrand])

  useEffect(() => {
    if (!errandId) return
    const socket = acquireSharedSocket()
    const handleConnect = () => { socket.emit('order:watch', errandId) }
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
      const response = await fetchWithSocketPause(`/api/orders/${errandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await response.json()
      if (!response.ok) { setError(payload.error || `Failed to ${action} errand`); return }
      setErrand(payload)
      previousSnapshotRef.current = { status: payload.status, hasPaid: Boolean(payload.hasPaid), isDeclinedTask: Boolean(payload.isDeclinedTask) }
      toast.success(action === 'complete' ? 'Errand marked as completed.' : 'Errand cancelled successfully.')
      if (action === 'complete' && payload.status === 'completed' && !payload.taskerHasPaid && payload.settlementStatus !== 'paid' && Number(payload.platformFee || 0) > 0) {
        router.replace(`/tasker-dashboard/payment/${payload._id}`)
        return
      }
      window.setTimeout(() => router.replace('/tasker-dashboard'), 1200)
    } catch { setError(`Failed to ${action} errand`) }
    finally { setActionLoading(null) }
  }

  const handleReportTransferIssue = async () => {
    try {
      setActionLoading('report')
      setError(null)
      const response = await fetchWithSocketPause(`/api/orders/${errandId}/report-transfer-issue`, { method: 'POST' })
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
      const response = await fetchWithSocketPause(`/api/orders/${errandId}`, {
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
      const response = await fetchWithSocketPause(`/api/orders/${errandId}`, {
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
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">This task may have been removed or you no longer have access to it.</p>
          <Button onClick={() => router.push('/tasker-dashboard')} className="mt-6 h-11 w-full rounded-2xl bg-sky-600 text-white hover:bg-sky-700">Back to dashboard</Button>
        </div>
      </div>
    )
  }

  const isActive = errand.status === 'pending' || errand.status === 'in_progress' || errand.status === 'paid'
  const paymentConfirmed = isCustomerPaymentConfirmed(errand)
  const transferUnderReview = Boolean(errand.isDeclinedTask)
  const taskerCanCancel = canTaskerCancelOrder(errand)
  const settlementOutstanding = errand.status === 'completed' && !errand.taskerHasPaid && errand.settlementStatus !== 'paid'
  const whatsappLink = userInfo ? getWhatsappLink(userInfo.phone, errand, userInfo.name) : ''
  const restaurantPeopleCount = Number.isInteger(Number(errand.restaurantPeopleCount || 0)) && Number(errand.restaurantPeopleCount || 0) > 0 ? Number(errand.restaurantPeopleCount) : 1
  const restaurantPackaging = formatRestaurantPackaging(errand)
  const canUpdateRestaurantPeople = errand.taskType === 'restaurant' && isActive && !paymentConfirmed && !transferUnderReview

  // Timer calculations
  const completionStartedMs = errand.completionTimerStartedAt ? new Date(errand.completionTimerStartedAt).getTime() : new Date(errand.createdAt).getTime()
  const completionWindowMinutes = Number(errand.completionWindowMinutes || 0) > 0 ? Number(errand.completionWindowMinutes) : 20
  const completionExtensionMinutes = Number(errand.completionExtensionMinutes || 0)
  const computedCompletionDueMs = completionStartedMs + (completionWindowMinutes + completionExtensionMinutes) * 60000
  const completionDueMs = errand.completionDueAt ? new Date(errand.completionDueAt).getTime() : computedCompletionDueMs
  const hasCompletionTimer = paymentConfirmed && Number.isFinite(completionDueMs) && Number.isFinite(completionStartedMs) && errand.status !== 'cancelled'
  const completionRemainingMs = hasCompletionTimer ? completionDueMs - nowMs : 0
  const completionTimerExpired = hasCompletionTimer && completionRemainingMs <= 0
  const completionWindowMs = completionWindowMinutes > 0 ? completionWindowMinutes * 60000 : completionDueMs - completionStartedMs
  const completionProgress = hasCompletionTimer && completionWindowMs > 0 ? Math.min(100, Math.max(0, ((nowMs - completionStartedMs) / completionWindowMs) * 100)) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
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
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ─── Order Header Card ─── */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-sky-500 to-indigo-600 px-5 py-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-100">Order #{errand._id.slice(-6)}</p>
            <h1 className="mt-1 text-2xl font-black">{taskTypeLabels[errand.taskType] || errand.taskType}</h1>
            <p className="mt-1 text-sm text-sky-50 opacity-90">{errand.description}</p>
          </div>

          {/* ─── ABOVE THE FOLD: Timer + WhatsApp ─── */}
          <div className="p-4 space-y-4">
            {/* Timer */}
            {hasCompletionTimer ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Time Left</p>
                  <p className={`mt-1 text-3xl font-black tabular-nums ${completionTimerExpired ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                    {formatDuration(completionRemainingMs)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {completionWindowMinutes}{completionExtensionMinutes ? ` + ${completionExtensionMinutes}` : ''} min window
                  </p>
                </div>
                <TimerRing
                  progress={completionTimerExpired ? 100 : completionProgress}
                  timeLeft={formatDuration(completionRemainingMs)}
                  label={completionTimerExpired ? 'Expired' : 'Left'}
                  expired={completionTimerExpired}
                />
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
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="h-5 w-5" />
                Chat Customer on WhatsApp
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading contact...
              </div>
            )}

            {/* Quick Info Row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <MapPin className="h-4 w-4 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Location</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{errand.location}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                <Store className="h-4 w-4 text-sky-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Store</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{errand.store || 'Any'}</p>
                </div>
              </div>
            </div>

            {/* Packaging (for restaurant) */}
            {errand.taskType === 'restaurant' && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3">
                <Wallet className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Packaging</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{restaurantPackaging}</p>
                </div>
              </div>
            )}

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
                  {transferUnderReview ? 'Transfer under review' : paymentConfirmed ? 'Payment confirmed' : 'Awaiting payment'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {transferUnderReview
                    ? 'Admin reviewing dispute'
                    : paymentConfirmed
                      ? 'Customer marked transfer as sent'
                      : 'Complete delivery after customer pays'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Customer Card ─── */}
        {userInfo && (
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
              <a href={`tel:${userInfo.phone}`} className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950 transition">
                <Phone className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* ─── Restaurant People Count ─── */}
        {canUpdateRestaurantPeople && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">People on Order</p>
              <span className="text-xs text-slate-500 dark:text-slate-400">Updates customer total</span>
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
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Transfer Summary</p>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Customer budget</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{convertToNaira(errand.amount || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Your fee</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {convertToNaira(errand.serviceFeeDiscountApplied ? errand.discountCommissionAmount || errand.taskerFee || 0 : errand.taskerFee || 0)}
              </span>
            </div>
            <div className="h-px bg-slate-100 dark:bg-slate-800" />
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{convertToNaira(errand.totalAmount || errand.amount + errand.commission)}</span>
            </div>
            {errand.platformFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">Platform fee due</span>
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
                <p className="font-bold text-rose-900 dark:text-rose-100">Declined task awaiting review</p>
                <p className="text-sm text-rose-700 dark:text-rose-200 mt-1">{errand.declinedMessage || 'The transaction was not found. Admin will review this dispute.'}</p>
                <Button
                  variant="outline"
                  onClick={() => void handleClearDeclinedTask()}
                  disabled={actionLoading === 'clearDeclined'}
                  className="mt-3 h-10 rounded-xl border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/40"
                >
                  {actionLoading === 'clearDeclined' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Clear declined flag
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
      {isActive && !transferUnderReview && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
            {paymentConfirmed ? (
              <>
                <Button
                  onClick={() => setShowConfirmModal('complete')}
                  disabled={Boolean(actionLoading)}
                  className="h-12 w-full rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60"
                >
                  {actionLoading === 'complete' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Mark as Completed
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleReportTransferIssue()}
                    disabled={Boolean(actionLoading)}
                    className="h-10 rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                  >
                    {actionLoading === 'report' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
                    Report Issue
                  </Button>
                  {taskerCanCancel ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirmModal('cancel')}
                      disabled={Boolean(actionLoading)}
                      className="h-10 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                    >
                      {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Cancel
                    </Button>
                  ) : (
                    <div className="h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center px-2">
                      Cancel locked after payment
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 p-3 text-center">
                  <p className="text-sm text-sky-700 dark:text-sky-300">Complete delivery, then mark done after customer confirms payment.</p>
                </div>
                {taskerCanCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmModal('cancel')}
                    disabled={Boolean(actionLoading)}
                    className="h-10 w-full rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                    Cancel Errand
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Closed Task Actions ─── */}
      {!isActive && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
            {settlementOutstanding && (
              <Button
                onClick={() => router.push(`/tasker-dashboard/payment/${errand._id}`)}
                className="h-12 w-full rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600"
              >
                Pay Platform Fee
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
              {showConfirmModal === 'complete' ? 'Mark completed?' : 'Cancel errand?'}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {showConfirmModal === 'complete'
                ? 'Only confirm after the customer has received the order. A "Not yet" response keeps your platform fee payable.'
                : 'This will close the task and return you to the dashboard.'}
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(null)} className="h-11 flex-1 rounded-xl">Go back</Button>
              <Button
                onClick={() => handleAction(showConfirmModal)}
                className={`h-11 flex-1 rounded-xl text-white font-bold ${showConfirmModal === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {showConfirmModal === 'complete' ? 'Complete' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}