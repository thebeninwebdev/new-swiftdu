'use client'
import { TrackingHero, TrackingTimeline, TrackingTasker, TrackingOrderSummary, TrackingSupport } from '@/components/customer-order-tracking'
import { type CafeInquiryFields } from '@/lib/cafe-inquiry'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle, ArrowLeft, CheckCircle2, Clock, CreditCard, Loader2,
  Package, RefreshCw, Store, XCircle, ChevronRight,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { canCustomerCancelOrder, isActiveOrderStatus } from '@/lib/order-status'
import { getTrackingStage, isWaitingForTasker, needsOrderPayment, TASKER_SEARCH_TIMEOUT_MS } from '@/lib/order-tracking'
import { mergeOrderUpdate } from '@/lib/order-sync'
import { useVisibleInterval } from '@/hooks/use-visible-interval'
import { OrderMascot } from '@/components/order-mascot'
import type { SwiftySearchPhase } from '@/components/swifty/Swifty'

// ─── Types ───
interface Order extends CafeInquiryFields {
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
  updatedAt?: string
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
  bankDetails?: { bankName: string; accountName: string; accountNumber: string }
}

type OrderHistoryTab = 'ongoing' | 'completed' | 'cancelled'

interface OrdersPageProps { trackingOrderId?: string }

const TRACKING_REFRESH_MS = 5000

// ─── Constants ───
const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery', printing: 'Printing', copy_notes: 'Copy Notes',
  shopping: 'Shopping', indomie: 'Buy Indomie', dry_cleaning: 'Dry Cleaning', water: 'Bag of Water', others: 'General Errand',
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  restaurant: <Store className="h-4 w-4" />, printing: <Package className="h-4 w-4" />,
  copy_notes: <Package className="h-4 w-4" />, shopping: <Package className="h-4 w-4" />,
  indomie: <Package className="h-4 w-4" />, dry_cleaning: <Package className="h-4 w-4" />, water: <Package className="h-4 w-4" />,
  others: <Package className="h-4 w-4" />,
}

const taskTypeGradients: Record<string, string> = {
  restaurant: 'from-orange-400 to-red-500', printing: 'from-violet-400 to-purple-600',
  copy_notes: 'from-blue-400 to-indigo-600', shopping: 'from-amber-400 to-orange-500',
  indomie: 'from-rose-400 to-amber-500',
  dry_cleaning: 'from-cyan-400 to-teal-600', water: 'from-sky-400 to-blue-600',
  others: 'from-slate-400 to-slate-600',
}

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
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount)
const formatDate = (date: string) => new Date(date).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const getWhatsAppHref = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const normalized = digits.startsWith('0') && digits.length === 11 ? `234${digits.slice(1)}` : digits
  return `https://wa.me/${normalized}`
}
const canRetryOrder = (order: Order) => order.status === 'completed' || order.status === 'cancelled'
const getMostRecentOrder = (orders: Order[]) => [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
const shouldRedirectToReview = (order: Order) => order.status === 'completed' && Boolean(order.taskerId)
export function getTaskerSearchMessage(elapsedMs: number): { phase: SwiftySearchPhase; heading: string; detail: string; speech?: string } {
  const minutes = elapsedMs / 60000
  if (minutes < 1) return { phase: 0, heading: 'Finding a tasker for you...', detail: 'Swifty is looking for an available tasker.' }
  if (minutes < 3) return { phase: 1, heading: 'Checking for available taskers...', detail: 'We are still looking for someone available to help.', speech: "You don't need to refresh. I'll update this page." }
  if (minutes < 5) return { phase: 2, heading: 'Still checking availability...', detail: 'Finding an available tasker can take a little time.', speech: 'Still checking for an available tasker.' }
  if (minutes < 7) return { phase: 3, heading: 'Still with you...', detail: 'We are still waiting for an available tasker.', speech: "I'm here with you while we keep looking." }
  return { phase: 3, heading: 'Closing your request...', detail: 'No tasker accepted within seven minutes.', speech: 'This request is being closed.' }
}
// ─── Sub-components ───
export default function OrdersPage({ trackingOrderId }: OrdersPageProps = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const legacyRequestedOrderId = searchParams.get('orderId')
  const isTrackingPage = Boolean(trackingOrderId)
  const requestedOrderId = trackingOrderId || legacyRequestedOrderId

  const [loading, setLoading] = useState(true)
  const [, setRefreshing] = useState(false)
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)
  const [currentOrder, setCurrentOrderState] = useState<Order | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState<OrderHistoryTab>('ongoing')
  const [taskerDetails, setTaskerDetails] = useState<TaskerDetails | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [loadingTasker, setLoadingTasker] = useState(false)
  const [updatingAction, setUpdatingAction] = useState<'cancel' | 'retry' | 'receiptYes' | 'receiptNo' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trackedOrderIdRef = useRef<string | null>(trackingOrderId || null)
  const previousSnapshotRef = useRef<{ id: string; taskerId?: string; hasPaid?: boolean; isDeclinedTask?: boolean } | null>(null)
  const taskerOrderRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)
  const queuedReloadRef = useRef(false)
  const queuedInitialReloadRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const currentOrderRef = useRef<Order | null>(null)
  const requestGenerationRef = useRef(0)
  const realtimeGenerationRef = useRef(0)
  const redirectedToReviewRef = useRef<string | null>(null)
  const cancellationInFlightRef = useRef(false)

  const setCurrentOrder = useCallback((incoming: Order | null) => {
    const next = incoming ? mergeOrderUpdate<Order>(currentOrderRef.current, incoming) : null
    currentOrderRef.current = next
    setCurrentOrderState(next)
  }, [])
  useEffect(() => { if (!trackingOrderId && legacyRequestedOrderId) router.replace(`/dashboard/tasks/${legacyRequestedOrderId}`) }, [legacyRequestedOrderId, router, trackingOrderId])
  useVisibleInterval(() => setNowMs(Date.now()), currentOrder ? 1000 : null)

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect(); socketRef.current = null
  }, [])

  const loadOrders = useCallback(async (initial = false) => {
    if (fetchingRef.current) { queuedReloadRef.current = true; queuedInitialReloadRef.current = queuedInitialReloadRef.current || initial; return }
    const generation = requestGenerationRef.current
    const realtimeGeneration = realtimeGenerationRef.current
    fetchingRef.current = true; if (initial) setLoading(true); else setRefreshing(true)
    try {
      let nextCurrentOrder: Order | null = null
      if (trackedOrderIdRef.current) {
        const trackedResponse = await fetch(`/api/orders/${trackedOrderIdRef.current}`, { cache: 'no-store' })
        if (trackedResponse.ok) {
          const trackedOrder: Order = await trackedResponse.json(); nextCurrentOrder = trackedOrder
          if (generation !== requestGenerationRef.current) return
        } else { if (generation !== requestGenerationRef.current) return; trackedOrderIdRef.current = null; if (isTrackingPage) throw new Error('Order not found') }
      }
      if (!nextCurrentOrder && isTrackingPage) {
        const currentResponse = await fetch('/api/orders?current=true', { cache: 'no-store' })
        if (!currentResponse.ok) throw new Error('Failed to fetch current order'); nextCurrentOrder = await currentResponse.json()
      }
      const recentResponse = await fetch('/api/orders?status=in_progress,completed,cancelled', { cache: 'no-store' })
      if (!recentResponse.ok) throw new Error('Failed to fetch recent orders')
      const recentData: Order[] = await recentResponse.json()
      if (generation !== requestGenerationRef.current) return
      if (realtimeGeneration !== realtimeGenerationRef.current) {
        queuedReloadRef.current = true
        queuedInitialReloadRef.current = queuedInitialReloadRef.current || initial
        return
      }
      if (nextCurrentOrder) nextCurrentOrder = mergeOrderUpdate<Order>(currentOrderRef.current, nextCurrentOrder)
      const mostRecentOngoingOrder = !isTrackingPage && !legacyRequestedOrderId ? getMostRecentOrder(recentData.filter((order) => order.status === 'in_progress')) : null
      if (mostRecentOngoingOrder) { router.replace(`/dashboard/tasks/${mostRecentOngoingOrder._id}`); return }
      if (nextCurrentOrder) {
        if (shouldRedirectToReview(nextCurrentOrder) && redirectedToReviewRef.current !== nextCurrentOrder._id) {
          redirectedToReviewRef.current = nextCurrentOrder._id; toast.success('Task completed. Please rate your tasker.'); router.replace(`/dashboard/reviews/${nextCurrentOrder._id}`); return
        }
        if (previousSnapshotRef.current?.id === nextCurrentOrder._id && !previousSnapshotRef.current.taskerId && nextCurrentOrder.taskerId) toast.success('A tasker accepted your order.')
        if (previousSnapshotRef.current?.id === nextCurrentOrder._id && !previousSnapshotRef.current.hasPaid && nextCurrentOrder.hasPaid) toast.success('Your transfer has been confirmed. Your task is now moving.')
        if (previousSnapshotRef.current?.id === nextCurrentOrder._id && !previousSnapshotRef.current.isDeclinedTask && Boolean(nextCurrentOrder.isDeclinedTask)) toast.error(nextCurrentOrder.declinedMessage || 'We could not confirm that transfer. Our team will contact you within 24 hours.')
      }
      previousSnapshotRef.current = nextCurrentOrder ? { id: nextCurrentOrder._id, taskerId: nextCurrentOrder.taskerId, hasPaid: nextCurrentOrder.hasPaid, isDeclinedTask: nextCurrentOrder.isDeclinedTask } : null
      trackedOrderIdRef.current = isTrackingPage ? nextCurrentOrder?._id || null : null
      setCurrentOrder(nextCurrentOrder); setRecentOrders(previous => recentData.map(order => mergeOrderUpdate<Order>(previous.find(saved => saved._id === order._id) || null, order))); setError(null)
    } catch (err) { if (generation === requestGenerationRef.current && realtimeGeneration === realtimeGenerationRef.current) setError(err instanceof Error ? err.message : 'Failed to load orders') }
    finally {
      fetchingRef.current = false; if (!queuedInitialReloadRef.current) setLoading(false); setRefreshing(false)
      if (queuedReloadRef.current) { const nextInitial = queuedInitialReloadRef.current; queuedReloadRef.current = false; queuedInitialReloadRef.current = false; void loadOrders(nextInitial) }
    }
  }, [isTrackingPage, legacyRequestedOrderId, router, setCurrentOrder])

  const applyRealtimeOrderUpdate = useCallback((payload?: OrderRealtimePayload) => {
    if (!payload?._id) return false
    const existingOrder = currentOrderRef.current
    const isCurrentOrder = existingOrder?._id === payload._id
    const isTrackedOrder = trackedOrderIdRef.current === payload._id
    if (isCurrentOrder || isTrackedOrder) realtimeGenerationRef.current += 1
    if (!isCurrentOrder && !isTrackedOrder) { setRecentOrders((previous) => previous.map((order) => order._id === payload._id ? mergeOrderUpdate<Order>(order, { ...payload, _id: order._id }) : order)); return false }
    if (existingOrder && isCurrentOrder) {
      const nextOrder = mergeOrderUpdate<Order>(existingOrder, { ...payload, _id: existingOrder._id })
      if (nextOrder === existingOrder) return true
      if (!existingOrder.taskerId && nextOrder.taskerId) toast.success('A tasker accepted your order.')
      if (!existingOrder.hasPaid && nextOrder.hasPaid) toast.success('Your transfer has been confirmed. Your task is now moving.')
      if (!existingOrder.isDeclinedTask && Boolean(nextOrder.isDeclinedTask)) toast.error(nextOrder.declinedMessage || 'We could not confirm that transfer. Our team will contact you within 24 hours.')
      previousSnapshotRef.current = { id: nextOrder._id, taskerId: nextOrder.taskerId, hasPaid: nextOrder.hasPaid, isDeclinedTask: nextOrder.isDeclinedTask }
      trackedOrderIdRef.current = nextOrder._id; setCurrentOrder(nextOrder)
      setRecentOrders((previous) => previous.map((order) => order._id === nextOrder._id ? mergeOrderUpdate<Order>(order, nextOrder) : order))
      if (shouldRedirectToReview(nextOrder) && redirectedToReviewRef.current !== nextOrder._id) { redirectedToReviewRef.current = nextOrder._id; toast.success('Task completed. Please rate your tasker.'); router.replace(`/dashboard/reviews/${nextOrder._id}`) }
      return true
    }
    return false
  }, [router, setCurrentOrder])

  useEffect(() => { void loadOrders(true) }, [loadOrders])
  useEffect(() => { if (!isTrackingPage) return; if (!requestedOrderId || requestedOrderId === trackedOrderIdRef.current) return; requestGenerationRef.current += 1; trackedOrderIdRef.current = requestedOrderId; previousSnapshotRef.current = null; taskerOrderRef.current = null; setTaskerDetails(null); void loadOrders(true) }, [isTrackingPage, loadOrders, requestedOrderId])
  useEffect(() => { const onFocus = () => { void loadOrders(false) }; window.addEventListener('focus', onFocus); return () => { window.removeEventListener('focus', onFocus) } }, [loadOrders])
  useVisibleInterval(
    () => {
      if (isTrackingPage) void loadOrders(false)
    },
    isTrackingPage ? TRACKING_REFRESH_MS : null
  )
  useEffect(() => {
    const socket = io({ withCredentials: true }); socketRef.current = socket
    const watchCurrentOrder = () => { const orderId = trackedOrderIdRef.current || currentOrderRef.current?._id; if (orderId) socket.emit('order:watch', orderId) }
    socket.on('connect', () => { watchCurrentOrder(); void loadOrders(false) })
    socket.on('order:updated', (payload?: OrderRealtimePayload) => { applyRealtimeOrderUpdate(payload); void loadOrders(false) })
    watchCurrentOrder(); return () => { if (socketRef.current === socket) { disconnectSocket(); return } socket.disconnect() }
  }, [applyRealtimeOrderUpdate, disconnectSocket, loadOrders])
  useEffect(() => { const orderId = currentOrder?._id; const socket = socketRef.current; if (!socket || !orderId) return; socket.emit('order:watch', orderId); return () => { socket.emit('order:unwatch', orderId) } }, [currentOrder?._id])
  useEffect(() => {
    if (!currentOrder?.taskerId) { taskerOrderRef.current = null; setTaskerDetails(null); setLoadingTasker(false); return }
    if (taskerOrderRef.current === currentOrder._id) return; let cancelled = false
    const fetchTasker = async () => { try { setLoadingTasker(true); const response = await fetch(`/api/orders/${currentOrder._id}/tasker`, { cache: 'no-store' }); if (!response.ok) throw new Error('Failed to fetch tasker details'); const data = await response.json(); if (!cancelled) { setTaskerDetails(data); taskerOrderRef.current = currentOrder._id } } catch { if (!cancelled) setTaskerDetails(null) } finally { if (!cancelled) setLoadingTasker(false) } }
    void fetchTasker(); return () => { cancelled = true }
  }, [currentOrder?._id, currentOrder?.taskerId])
  useEffect(() => { return () => { disconnectSocket() } }, [disconnectSocket])

  const currentOrderIsActive = isActiveOrderStatus(currentOrder?.status)
  const transferAmount = currentOrder?.cafeInquiry && currentOrder.cafeInquiryFeePaid ? Number(currentOrder.amount || 0) : Number(currentOrder?.totalAmount || currentOrder?.amount || 0)
  const needsPayment = needsOrderPayment(currentOrder)
  const whatsappHref = taskerDetails?.phone ? getWhatsAppHref(taskerDetails.phone) : null

  useEffect(() => { if (needsPayment) { setPaymentModalOpen(true); return } setPaymentModalOpen(false) }, [currentOrder?._id, needsPayment])

  const handlePaymentModalOpenChange = (open: boolean) => {
    if (!open && needsPayment && !currentOrder?.cafeInquiry) {
      setPaymentModalOpen(true)
      return
    }

    setPaymentModalOpen(open)
  }

  const handleOpenOrder = (orderId: string) => { if (trackedOrderIdRef.current === orderId) return; trackedOrderIdRef.current = orderId; previousSnapshotRef.current = null; taskerOrderRef.current = null; setTaskerDetails(null); router.push(`/dashboard/tasks/${orderId}`); void loadOrders(false) }
  const handleConfirmTransfer = async () => { if (!currentOrder || !needsOrderPayment(currentOrder)) return; try { setConfirmingTransfer(true); const response = await fetch(`/api/orders/${currentOrder._id}/confirm-transfer`, { method: 'POST' }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Failed to confirm the transfer.'); setCurrentOrder(payload.order); trackedOrderIdRef.current = payload.order?._id || currentOrder._id; previousSnapshotRef.current = payload.order ? { id: payload.order._id, taskerId: payload.order.taskerId, hasPaid: payload.order.hasPaid, isDeclinedTask: payload.order.isDeclinedTask } : null; setPaymentModalOpen(false); toast.success('Payment updated. Open WhatsApp and stay online for your tasker.') } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to confirm the transfer.'); void loadOrders(false) } finally { setConfirmingTransfer(false) } }
  const handleCancelOrder = useCallback(async () => { if (!currentOrder || !canCustomerCancelOrder(currentOrder) || cancellationInFlightRef.current) return; cancellationInFlightRef.current = true; try { setUpdatingAction('cancel'); const response = await fetch(`/api/orders/${currentOrder._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to cancel order'); requestGenerationRef.current += 1; trackedOrderIdRef.current = data._id; taskerOrderRef.current = null; previousSnapshotRef.current = null; setTaskerDetails(null); currentOrderRef.current = data; setCurrentOrderState(data); setRecentOrders((previous) => [data, ...previous.filter((order) => order._id !== data._id)]); toast.success('Order cancelled.'); router.replace('/dashboard/tasks') } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to cancel order') } finally { cancellationInFlightRef.current = false; setUpdatingAction(null) } }, [currentOrder, router])
  const handleReceiptAnswer = useCallback(async (receivedOrder: boolean) => { if (!currentOrder || updatingAction || confirmingTransfer) return; try { setUpdatingAction(receivedOrder ? 'receiptYes' : 'receiptNo'); const response = await fetch(`/api/orders/${currentOrder._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerReceivedOrder: receivedOrder }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to update this task.'); setCurrentOrder(data); setRecentOrders((previous) => previous.map((order) => (order._id === data._id ? mergeOrderUpdate<Order>(order, data) : order))); toast.success(receivedOrder ? 'Thanks for confirming your order.' : 'Thanks. SwiftDU will review this completion.'); if (receivedOrder) { redirectedToReviewRef.current = data._id; router.replace(`/dashboard/reviews/${data._id}`) } } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to update this task.') } finally { setUpdatingAction(null) } }, [confirmingTransfer, currentOrder, router, updatingAction, setCurrentOrder])
  const handleRetryOrder = useCallback(async (order: Order) => { if (updatingAction || confirmingTransfer || !canRetryOrder(order)) return; try { setUpdatingAction('retry'); const response = await fetch(`/api/orders/${order._id}/retry`, { method: 'POST' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Failed to retry task'); requestGenerationRef.current += 1; trackedOrderIdRef.current = data._id; taskerOrderRef.current = null; previousSnapshotRef.current = { id: data._id, taskerId: data.taskerId, hasPaid: data.hasPaid, isDeclinedTask: data.isDeclinedTask }; setTaskerDetails(null); setCurrentOrder(data); setRecentOrders((previous) => [data, ...previous.filter((existingOrder) => existingOrder._id !== data._id && existingOrder._id !== order._id)]); toast.success('Task sent again. We are looking for taskers now.'); router.replace(`/dashboard/tasks/${data._id}`); void loadOrders(true) } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to retry task') } finally { setUpdatingAction(null) } }, [confirmingTransfer, loadOrders, router, updatingAction, setCurrentOrder])
  const requestCancelOrder = useCallback(() => { if (!currentOrder || updatingAction === 'cancel' || confirmingTransfer) return; setCancelConfirmOpen(true) }, [confirmingTransfer, currentOrder, updatingAction])
  const confirmCancelOrder = useCallback(() => { setCancelConfirmOpen(false); void handleCancelOrder() }, [handleCancelOrder])

  const waitingOrderId = isTrackingPage && isWaitingForTasker(currentOrder) ? currentOrder?._id : null
  const waitingStartedAt = waitingOrderId ? currentOrder?.createdAt : null

  useEffect(() => {
    if (!waitingOrderId || !waitingStartedAt) return
    const orderId = waitingOrderId
    const startedAt = Date.parse(waitingStartedAt)
    if (!Number.isFinite(startedAt)) return

    let stopped = false
    let timer: number
    const expire = async () => {
      try {
        const response = await fetch('/api/orders/' + orderId + '/expire', { method: 'POST' })
        const order: Order = await response.json()
        if (stopped) return
        if (response.ok) {
          requestGenerationRef.current += 1
          trackedOrderIdRef.current = orderId
          currentOrderRef.current = order
          setCurrentOrderState(order)
          setRecentOrders((previous) => [order, ...previous.filter((item) => item._id !== orderId)])
          toast.info('No tasker accepted within 7 minutes. Your request was cancelled.')
          router.replace('/dashboard/tasks')
          return
        }
        if (response.status === 409) {
          // The server may have assigned or manually cancelled the order first.
          currentOrderRef.current = order
          setCurrentOrderState(order)
          if (!isWaitingForTasker(order)) return
        }
      } catch {
        // Retry while the real order remains in the waiting state.
      }
      if (!stopped) timer = window.setTimeout(expire, 5000)
    }

    timer = window.setTimeout(expire, Math.max(0, startedAt + TASKER_SEARCH_TIMEOUT_MS - Date.now()))
    return () => { stopped = true; window.clearTimeout(timer) }
  }, [waitingOrderId, waitingStartedAt, router])

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
  const isSearchingForTasker = isWaitingForTasker(currentOrder)
  const canCancelCurrentOrder = currentOrder ? canCustomerCancelOrder(currentOrder) : false
  const searchStartedAt = currentOrder ? new Date(currentOrder.createdAt).getTime() : NaN
  const searchElapsedMs = Number.isFinite(searchStartedAt) ? Math.max(nowMs - searchStartedAt, 0) : 0
  const shouldAskReceiptQuestion = Boolean(currentOrder?.status === 'completed' && !currentOrder.cafeInquiry && currentOrder.hasPaid && currentOrder.customerReceiptConfirmed === undefined && !currentOrder.customerReceiptRespondedAt)


  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:pt-6">
        <header className="mb-5 flex items-center gap-2">
          <button type="button" aria-label="Back to your orders" onClick={() => router.push('/dashboard/tasks')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-violet-50 dark:text-slate-200 dark:hover:bg-violet-950"><ArrowLeft className="h-5 w-5" /></button>
          <p className="text-lg font-bold">Track your order</p>
        </header>
        {error ? <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-200">{error}</p> : null}
        {isTrackingPage && currentOrder && currentStage ? <>
          <TrackingHero order={currentOrder} stage={currentStage} nowMs={nowMs} searchMessage={isSearchingForTasker ? getTaskerSearchMessage(searchElapsedMs) : undefined} />
          <TrackingTimeline stage={currentStage} />
          <TrackingTasker order={currentOrder} tasker={taskerDetails} loading={loadingTasker} whatsappHref={whatsappHref} />
          {currentOrder.cafeInquiryStatus && needsPayment ? <button type="button" onClick={() => setPaymentModalOpen(true)} className="mb-5 min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700">Pay inquiry charge</button> : null}
          <TrackingOrderSummary order={currentOrder} />
          {shouldAskReceiptQuestion ? <section className="border-t border-slate-100 py-6 dark:border-slate-800">
            <h2 className="font-bold">Did you receive this order?</h2>
            <p className="mt-2 text-sm text-slate-500">Let us know so we can close your task or help with a problem.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button onClick={() => void handleReceiptAnswer(true)} disabled={Boolean(updatingAction || confirmingTransfer)} className="min-h-11 rounded-xl bg-violet-600 text-white hover:bg-violet-700">{updatingAction === 'receiptYes' ? 'Updating...' : 'Yes, received'}</Button>
              <Button variant="outline" onClick={() => void handleReceiptAnswer(false)} disabled={Boolean(updatingAction || confirmingTransfer)} className="min-h-11 rounded-xl">{updatingAction === 'receiptNo' ? 'Updating...' : 'No, report issue'}</Button>
            </div>
          </section> : null}
          <TrackingSupport>
            {canCancelCurrentOrder ? <button type="button" onClick={requestCancelOrder} disabled={Boolean(updatingAction || confirmingTransfer)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950/30">{updatingAction === 'cancel' ? 'Cancelling...' : 'Cancel order'}</button> : null}
            {canRetryOrder(currentOrder) ? <button type="button" onClick={() => void handleRetryOrder(currentOrder)} disabled={Boolean(updatingAction || confirmingTransfer)} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-300 dark:hover:bg-violet-950">{updatingAction === 'retry' ? 'Sending...' : 'Order again'}</button> : null}
          </TrackingSupport>
        </> : isTrackingPage ? <section className="py-12 text-center">
          <OrderMascot mood="warning" interaction="attention" size="md" />
          <h1 className="mt-5 text-xl font-bold">Order unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">Return to your orders or book a new task.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-5 min-h-11 rounded-xl bg-violet-600 text-white">Book a task</Button>
        </section> : <>
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
                  const status = isActiveOrderStatus(order.status) && order.isDeclinedTask ? declinedStatusConfig : statusConfig[order.status]
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


        </>}
      </main>

      {/* Cancel Dialog */}
      <Dialog open={canCancelCurrentOrder && cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this task?</DialogTitle>
            <DialogDescription>Taskers will stop seeing this request. You can create a new task anytime if you still need help.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setCancelConfirmOpen(false)} disabled={updatingAction === 'cancel'} className="h-11 rounded-xl">Keep order</Button>
            <Button type="button" onClick={confirmCancelOrder} disabled={updatingAction === 'cancel'} className="h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700">
              {updatingAction === 'cancel' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cancelling...</> : 'Cancel task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={currentOrderIsActive && ((needsPayment && !currentOrder?.cafeInquiry) || paymentModalOpen)} onOpenChange={handlePaymentModalOpenChange}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!needsPayment || Boolean(currentOrder?.cafeInquiry)}>
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
