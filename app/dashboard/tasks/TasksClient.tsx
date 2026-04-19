'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Store,
  XCircle,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

const POLL_INTERVAL_MS = 4000
const PAYMENT_RETURN_STORAGE_KEY = 'swiftdu-payment-order'

interface Order {
  _id: string
  taskType: string
  description: string
  amount: number
  platformFee?: number
  totalAmount?: number
  deadlineValue: number
  deadlineUnit: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  packaging?: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerName?: string
  taskerId?: string
  createdAt: string
  hasPaid?: boolean
  paymentStatus?: 'unpaid' | 'initialized' | 'paid' | 'failed' | 'cancelled'
  paymentLink?: string
  paymentFailureReason?: string
  commission: number
}

interface TaskerDetails {
  _id: string
  name: string
  phone: string
  profileImage?: string | null
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  shopping: 'Shopping',
  water: 'Buy Water',
  others: 'General Errand',
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  restaurant: <Store className="h-4 w-4" />,
  printing: <Package className="h-4 w-4" />,
  shopping: <Package className="h-4 w-4" />,
  water: <Package className="h-4 w-4" />,
  others: <Package className="h-4 w-4" />,
}

const statusConfig: Record<
  Order['status'],
  { label: string; tone: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Finding tasker',
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: 'In progress',
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  paid: {
    label: 'Paid',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (date: string) =>
  new Date(date).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

function TaskerAvatar({ tasker }: { tasker: TaskerDetails }) {
  if (tasker.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={tasker.profileImage}
        alt={tasker.name}
        className="h-12 w-12 rounded-xl object-cover ring-2 ring-white dark:ring-slate-800"
      />
    )
  }

  const initials = tasker.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 font-bold text-white">
      {initials || 'T'}
    </div>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [startingPayment, setStartingPayment] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [taskerDetails, setTaskerDetails] = useState<TaskerDetails | null>(null)
  const [loadingTasker, setLoadingTasker] = useState(false)
  const [updatingAction, setUpdatingAction] = useState<'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const trackedOrderIdRef = useRef<string | null>(null)
  const previousSnapshotRef = useRef<{
    id: string
    taskerId?: string
    hasPaid?: boolean
  } | null>(null)
  const taskerOrderRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)
  const queuedReloadRef = useRef(false)
  const queuedInitialReloadRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const processedCallbackRef = useRef<string | null>(null)
  const redirectedToReviewRef = useRef<string | null>(null)

  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  const loadOrders = useCallback(
    async (initial = false) => {
      if (fetchingRef.current) {
        queuedReloadRef.current = true
        queuedInitialReloadRef.current = queuedInitialReloadRef.current || initial
        return
      }

      fetchingRef.current = true

      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        let nextCurrentOrder: Order | null = null

        if (trackedOrderIdRef.current) {
          const trackedResponse = await fetch(`/api/orders/${trackedOrderIdRef.current}`, {
            cache: 'no-store',
          })

          if (trackedResponse.ok) {
            const trackedOrder: Order = await trackedResponse.json()
            nextCurrentOrder = trackedOrder

            if (
              trackedOrder.status === 'completed' &&
              trackedOrder.hasPaid &&
              redirectedToReviewRef.current !== trackedOrder._id
            ) {
              redirectedToReviewRef.current = trackedOrder._id
              toast.success('Task completed. Please rate your tasker.')
              router.replace(`/dashboard/reviews/${trackedOrder._id}`)
              return
            }
          } else {
            trackedOrderIdRef.current = null
          }
        }

        if (!nextCurrentOrder) {
          const currentResponse = await fetch('/api/orders?current=true', {
            cache: 'no-store',
          })

          if (!currentResponse.ok) {
            throw new Error('Failed to fetch current order')
          }

          nextCurrentOrder = await currentResponse.json()
        }

        const recentResponse = await fetch('/api/orders?limit=8', {
          cache: 'no-store',
        })

        if (!recentResponse.ok) {
          throw new Error('Failed to fetch recent orders')
        }

        const recentData: Order[] = await recentResponse.json()

        if (nextCurrentOrder && previousSnapshotRef.current?.id === nextCurrentOrder._id) {
          if (
            previousSnapshotRef.current.hasPaid &&
            nextCurrentOrder.status === 'completed' &&
            redirectedToReviewRef.current !== nextCurrentOrder._id
          ) {
            redirectedToReviewRef.current = nextCurrentOrder._id
            toast.success('Task completed. Please rate your tasker.')
            router.replace(`/dashboard/reviews/${nextCurrentOrder._id}`)
            return
          }

          if (!previousSnapshotRef.current.taskerId && nextCurrentOrder.taskerId) {
            toast.success(`${nextCurrentOrder.taskerName || 'A tasker'} accepted your order.`)
          }

          if (!previousSnapshotRef.current.hasPaid && nextCurrentOrder.hasPaid) {
            toast.success('Flutterwave payment verified. Your task is now moving.')
          }
        }

        previousSnapshotRef.current = nextCurrentOrder
          ? {
              id: nextCurrentOrder._id,
              taskerId: nextCurrentOrder.taskerId,
              hasPaid: nextCurrentOrder.hasPaid,
            }
          : null
        trackedOrderIdRef.current = nextCurrentOrder?._id || null
        setCurrentOrder(nextCurrentOrder)
        setRecentOrders(recentData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders')
      } finally {
        fetchingRef.current = false
        setLoading(false)
        setRefreshing(false)

        if (queuedReloadRef.current) {
          const nextInitial = queuedInitialReloadRef.current
          queuedReloadRef.current = false
          queuedInitialReloadRef.current = false
          void loadOrders(nextInitial)
        }
      }
    },
    [router]
  )

  useEffect(() => {
    void loadOrders(true)
  }, [loadOrders])

  useEffect(() => {
    if (isPaying) {
      return
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadOrders(false)
      }
    }, POLL_INTERVAL_MS)

    const onFocus = () => {
      void loadOrders(false)
    }

    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [isPaying, loadOrders])

  useEffect(() => {
    if (isPaying) {
      disconnectSocket()
      return
    }

    const socket = io({
      withCredentials: true,
      transports: ['websocket'],
    })

    socketRef.current = socket

    socket.on('order:updated', () => {
      void loadOrders(false)
    })

    return () => {
      if (socketRef.current === socket) {
        disconnectSocket()
        return
      }

      socket.disconnect()
    }
  }, [disconnectSocket, isPaying, loadOrders])

  useEffect(() => {
    const orderId = currentOrder?._id
    const socket = socketRef.current

    if (!socket || !orderId) {
      return
    }

    socket.emit('order:watch', orderId)

    return () => {
      socket.emit('order:unwatch', orderId)
    }
  }, [currentOrder?._id])

  useEffect(() => {
    if (!currentOrder?.taskerId) {
      taskerOrderRef.current = null
      setTaskerDetails(null)
      setLoadingTasker(false)
      return
    }

    if (taskerOrderRef.current === currentOrder._id) {
      return
    }

    let cancelled = false

    const fetchTasker = async () => {
      try {
        setLoadingTasker(true)
        const response = await fetch(`/api/orders/${currentOrder._id}/tasker`, {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch tasker details')
        }

        const data = await response.json()

        if (!cancelled) {
          setTaskerDetails(data)
          taskerOrderRef.current = currentOrder._id
        }
      } catch {
        if (!cancelled) {
          setTaskerDetails(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingTasker(false)
        }
      }
    }

    void fetchTasker()

    return () => {
      cancelled = true
    }
  }, [currentOrder?._id, currentOrder?.taskerId])

  useEffect(() => {
    const hasPaymentCallback = Boolean(
      searchParams.get('tx_ref') ||
        searchParams.get('status') ||
        searchParams.get('transaction_id')
    )

    const clearPendingCheckoutState = () => {
      if (!window.sessionStorage.getItem(PAYMENT_RETURN_STORAGE_KEY) || hasPaymentCallback) {
        return
      }

      window.sessionStorage.removeItem(PAYMENT_RETURN_STORAGE_KEY)
      setIsPaying(false)
      setStartingPayment(false)
      void loadOrders(false)
    }

    const handlePageShow = () => clearPendingCheckoutState()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        clearPendingCheckoutState()
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pageshow', handlePageShow)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadOrders, searchParams])

  useEffect(() => {
    if (!currentOrder || (!currentOrder.hasPaid && currentOrder.status !== 'cancelled')) {
      return
    }

    window.sessionStorage.removeItem(PAYMENT_RETURN_STORAGE_KEY)
    setIsPaying(false)
    setStartingPayment(false)
  }, [currentOrder])

  useEffect(() => {
    const txRef = searchParams.get('tx_ref')
    const status = searchParams.get('status')
    const transactionId = searchParams.get('transaction_id')
    const callbackOrderId = searchParams.get('orderId') || currentOrder?._id
    const signature = `${callbackOrderId || ''}:${txRef || ''}:${status || ''}:${transactionId || ''}`

    if (!callbackOrderId || !txRef || processedCallbackRef.current === signature) {
      return
    }

    processedCallbackRef.current = signature
    setIsPaying(true)
    setVerifyingPayment(true)

    void (async () => {
      try {
        const response = await fetch(
          `/api/orders/${callbackOrderId}/payment/flutterwave/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txRef, status, transactionId }),
          }
        )
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to verify payment')
        }

        setCurrentOrder(payload.order)
        trackedOrderIdRef.current = payload.order?._id || callbackOrderId
        previousSnapshotRef.current = payload.order
          ? {
              id: payload.order._id,
              taskerId: payload.order.taskerId,
              hasPaid: payload.order.hasPaid,
            }
          : null
        toast.success('Flutterwave payment confirmed.')
        void loadOrders(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to verify Flutterwave payment.')
      } finally {
        window.sessionStorage.removeItem(PAYMENT_RETURN_STORAGE_KEY)
        setIsPaying(false)
        setStartingPayment(false)
        setVerifyingPayment(false)
        router.replace('/dashboard/tasks')
      }
    })()
  }, [currentOrder?._id, loadOrders, router, searchParams])

  useEffect(() => {
    return () => {
      disconnectSocket()
    }
  }, [disconnectSocket])

  const handleStartPayment = async () => {
    if (!currentOrder) {
      return
    }

    try {
      setStartingPayment(true)
      setIsPaying(true)
      disconnectSocket()

      let nextCheckoutUrl =
        currentOrder.paymentStatus === 'initialized' ? currentOrder.paymentLink : undefined

      if (!nextCheckoutUrl) {
        const response = await fetch(
          `/api/orders/${currentOrder._id}/payment/flutterwave/initialize`,
          {
            method: 'POST',
          }
        )
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to open Flutterwave checkout.')
        }

        nextCheckoutUrl = payload.checkoutUrl
        setCurrentOrder((previous) =>
          previous
            ? {
                ...previous,
                paymentStatus: 'initialized',
                paymentLink: payload.checkoutUrl,
              }
            : previous
        )
      }

      if (!nextCheckoutUrl) {
        throw new Error('Flutterwave did not return a checkout link.')
      }

      window.sessionStorage.setItem(PAYMENT_RETURN_STORAGE_KEY, currentOrder._id)
      window.location.assign(nextCheckoutUrl)
    } catch (err) {
      setIsPaying(false)
      setStartingPayment(false)
      toast.error(
        err instanceof Error ? err.message : 'Failed to open Flutterwave checkout.'
      )
      void loadOrders(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!currentOrder) {
      return
    }

    try {
      setUpdatingAction('cancel')
      const response = await fetch(`/api/orders/${currentOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel order')
      }

      trackedOrderIdRef.current = null
      taskerOrderRef.current = null
      previousSnapshotRef.current = null
      window.sessionStorage.removeItem(PAYMENT_RETURN_STORAGE_KEY)
      setTaskerDetails(null)
      setCurrentOrder(null)
      setIsPaying(false)
      setStartingPayment(false)
      setRecentOrders((previous) => [data, ...previous.filter((order) => order._id !== data._id)])
      toast.success('Order cancelled. You can book a new task now.')
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order')
    } finally {
      setUpdatingAction(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Loading your orders...
            </p>
          </div>
        </div>
      </div>
    )
  }

  const visibleRecentOrders = recentOrders.filter(
    (order) => !currentOrder || order._id !== currentOrder._id
  )
  const currentStatus = currentOrder ? statusConfig[currentOrder.status] : null
  const commission = currentOrder?.commission || 0

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <Package className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">My Orders</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {currentOrder ? 'Active order in progress' : 'No active orders'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadOrders(false)}
            disabled={refreshing || verifyingPayment || startingPayment}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label="Refresh orders"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/30">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
            </div>
          ) : null}

          {currentOrder ? (
            <div className="space-y-3">
              <div
                className={`rounded-xl border px-4 py-3 ${
                  currentOrder.status === 'pending'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
                    : currentOrder.hasPaid
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                      : 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {currentOrder.status === 'pending'
                    ? 'Finding a tasker...'
                    : currentOrder.hasPaid
                      ? 'Flutterwave payment confirmed'
                      : 'Tasker assigned, payment needed'}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {currentOrder.status === 'pending'
                    ? 'Stay here, updates appear automatically.'
                    : currentOrder.hasPaid
                      ? `${taskerDetails?.name || 'Your tasker'} is handling your errand.`
                      : 'Pay SwiftDU with Flutterwave to release the order.'}
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                        {taskTypeIcons[currentOrder.taskType] || taskTypeIcons.others}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {taskTypeLabels[currentOrder.taskType] || currentOrder.taskType}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${currentStatus?.tone}`}
                    >
                      {currentStatus?.icon}
                      {currentStatus?.label}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {currentOrder.description}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <MapPin className="h-3 w-3" />
                        {currentOrder.location}
                      </span>
                      {currentOrder.store ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Store className="h-3 w-3" />
                          {currentOrder.store}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Clock className="h-3 w-3" />
                        {currentOrder.deadlineValue} {currentOrder.deadlineUnit}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4 text-white">
                    <p className="text-xs text-slate-400">Total amount collected by SwiftDU</p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatCurrency(currentOrder.totalAmount || currentOrder.amount)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Item budget: {formatCurrency(currentOrder.amount)}</span>
                      <span>Platform fee: {formatCurrency(commission)}</span>
                    </div>
                  </div>

                  {currentOrder.paymentStatus === 'failed' ||
                  currentOrder.paymentStatus === 'cancelled' ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      {currentOrder.paymentFailureReason ||
                        'The last Flutterwave payment attempt was not completed.'}
                    </div>
                  ) : null}
                </div>
              </div>

              {currentOrder.taskerId ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Assigned Tasker
                    </p>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {taskerDetails ? (
                        <TaskerAvatar tasker={taskerDetails} />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {taskerDetails?.name || currentOrder.taskerName || 'Loading...'}
                        </p>
                        {taskerDetails?.phone ? (
                          <a
                            href={`tel:${taskerDetails.phone}`}
                            className="mt-1 inline-flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {taskerDetails.phone}
                          </a>
                        ) : loadingTasker ? (
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Loading contact...
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentOrder.taskerId && !currentOrder.hasPaid ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    onClick={() => void handleStartPayment()}
                    disabled={startingPayment || verifyingPayment || updatingAction === 'cancel'}
                    className="h-12 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
                  >
                    {startingPayment || verifyingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {verifyingPayment ? 'Verifying...' : 'Opening checkout...'}
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Pay with Flutterwave
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => void handleCancelOrder()}
                    disabled={updatingAction === 'cancel' || verifyingPayment || startingPayment}
                    variant="outline"
                    className="h-12 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    {updatingAction === 'cancel' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel
                      </>
                    )}
                  </Button>
                </div>
              ) : null}

              {currentOrder.hasPaid ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    SwiftDU has confirmed your payment.
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    The tasker can now continue delivery. Payments are no longer sent directly
                    to individual taskers.
                  </p>
                </div>
              ) : null}

              {currentOrder.status === 'pending' ? (
                <Button
                  onClick={() => void handleCancelOrder()}
                  disabled={updatingAction === 'cancel' || verifyingPayment || startingPayment}
                  variant="outline"
                  className="h-11 w-full rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {updatingAction === 'cancel' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel Order
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                No active orders
              </h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Book a new task to get started.
              </p>
              <Button
                onClick={() => router.push('/dashboard')}
                className="mt-6 h-11 rounded-xl bg-linear-to-r from-sky-600 to-indigo-600 px-6 text-white"
              >
                Book a Task
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {visibleRecentOrders.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Orders
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {visibleRecentOrders.length} past{' '}
                  {visibleRecentOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
              <div className="space-y-2">
                {visibleRecentOrders.map((order) => {
                  const status = statusConfig[order.status]

                  return (
                    <div
                      key={order._id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${status.tone}`}
                      >
                        {taskTypeIcons[order.taskType] || taskTypeIcons.others}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {taskTypeLabels[order.taskType] || order.taskType}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status.tone}`}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(order.createdAt)} -{' '}
                          {formatCurrency(order.totalAmount || order.amount)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
