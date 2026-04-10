'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Copy,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Store,
  XCircle,
  Clock,
  Package,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { io, type Socket } from 'socket.io-client'

import { Button } from '@/components/ui/button'

const POLL_INTERVAL_MS = 4000

interface Order {
  _id: string
  taskType: string
  description: string
  amount: number
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
}

interface TaskerDetails {
  _id: string
  name: string
  phone: string
  profileImage?: string | null
  bankDetails: {
    bankName: string
    accountNumber: string
    accountName: string
  }
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  shopping: 'Shopping',
  others: 'General Errand',
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  restaurant: <Store className="h-4 w-4" />,
  printing: <Package className="h-4 w-4" />,
  shopping: <Package className="h-4 w-4" />,
  others: <Package className="h-4 w-4" />,
}

const statusConfig: Record<Order['status'], { 
  bg: string; 
  text: string; 
  darkBg: string; 
  darkText: string;
  icon: React.ReactNode;
  label: string;
}> = {
  pending: { 
    bg: 'bg-amber-100', 
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-950/50',
    darkText: 'dark:text-amber-300',
    icon: <Clock className="h-3.5 w-3.5" />,
    label: 'Finding tasker',
  },
  in_progress: { 
    bg: 'bg-sky-100', 
    text: 'text-sky-700',
    darkBg: 'dark:bg-sky-950/50',
    darkText: 'dark:text-sky-300',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: 'In progress',
  },
  paid: { 
    bg: 'bg-emerald-100', 
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-950/50',
    darkText: 'dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: 'Paid',
  },
  completed: { 
    bg: 'bg-emerald-100', 
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-950/50',
    darkText: 'dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: 'Completed',
  },
  cancelled: { 
    bg: 'bg-rose-100', 
    text: 'text-rose-700',
    darkBg: 'dark:bg-rose-950/50',
    darkText: 'dark:text-rose-300',
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: 'Cancelled',
  },
}

const isActiveOrder = (order: Order | null) =>
  !!order && ['pending', 'in_progress', 'paid'].includes(order.status)

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

function TaskerAvatar({ tasker, size = 'md' }: { tasker: TaskerDetails; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-10 w-10 text-sm',
    md: 'h-14 w-14 text-base',
    lg: 'h-16 w-16 text-lg',
  }

  if (tasker.profileImage) {
    return (
      <img
        src={tasker.profileImage}
        alt={tasker.name}
        className={`${sizeClasses[size]} rounded-xl object-cover ring-2 ring-white dark:ring-slate-800`}
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
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 font-bold text-white`}>
      {initials || 'T'}
    </div>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [taskerDetails, setTaskerDetails] = useState<TaskerDetails | null>(null)
  const [loadingTasker, setLoadingTasker] = useState(false)
  const [updatingAction, setUpdatingAction] = useState<'cancel' | 'pay' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const trackedOrderIdRef = useRef<string | null>(null)
  const previousSnapshotRef = useRef<{ id: string; taskerId?: string; hasPaid?: boolean } | null>(null)
  const hydratedRef = useRef(false)
  const redirectedOrderRef = useRef<string | null>(null)
  const taskerOrderRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)

  const loadOrders = useCallback(async (initial = false) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    if (initial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      let nextCurrentOrder: Order | null = null

      if (trackedOrderIdRef.current) {
        const trackedResponse = await fetch(`/api/orders/${trackedOrderIdRef.current}`)
        if (trackedResponse.ok) {
          const trackedOrder: Order = await trackedResponse.json()
          if (isActiveOrder(trackedOrder)) {
            nextCurrentOrder = trackedOrder
          } else {
            trackedOrderIdRef.current = null
            if (trackedOrder.status === 'completed' && redirectedOrderRef.current !== trackedOrder._id) {
              redirectedOrderRef.current = trackedOrder._id
              toast.success('Order completed! Leave a review for your tasker.')
              router.push(`/dashboard/reviews?orderId=${trackedOrder._id}`)
            }
            if (trackedOrder.status === 'cancelled') toast.info('Your order has been cancelled.')
          }
        } else {
          trackedOrderIdRef.current = null
        }
      }

      if (!nextCurrentOrder) {
        const currentResponse = await fetch('/api/orders?current=true')
        if (!currentResponse.ok) throw new Error('Failed to fetch current order')
        nextCurrentOrder = await currentResponse.json()
      }

      const recentResponse = await fetch('/api/orders?limit=8')
      if (!recentResponse.ok) throw new Error('Failed to fetch recent orders')
      const recentData: Order[] = await recentResponse.json()

      if (!hydratedRef.current) {
        hydratedRef.current = true
      } else if (nextCurrentOrder && previousSnapshotRef.current?.id === nextCurrentOrder._id) {
        if (!previousSnapshotRef.current.taskerId && nextCurrentOrder.taskerId) {
          toast.success(`${nextCurrentOrder.taskerName || 'A tasker'} accepted your order!`)
        }
        if (!previousSnapshotRef.current.hasPaid && nextCurrentOrder.hasPaid) {
          toast.success('Payment confirmed! Your order is now in progress.')
        }
      }

      previousSnapshotRef.current = nextCurrentOrder
        ? { id: nextCurrentOrder._id, taskerId: nextCurrentOrder.taskerId, hasPaid: nextCurrentOrder.hasPaid }
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
    }
  }, [router])

  useEffect(() => {
    void loadOrders(true)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadOrders(false)
    }, POLL_INTERVAL_MS)
    const onFocus = () => void loadOrders(false)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [loadOrders])

  useEffect(() => {
    const socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      if (trackedOrderIdRef.current) {
        socket.emit('order:watch', trackedOrderIdRef.current)
      }
    })

    socket.on('order:updated', () => {
      void loadOrders(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [loadOrders])

  useEffect(() => {
    const socket = socketRef.current
    const orderId = currentOrder?._id

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

    if (taskerOrderRef.current === currentOrder._id) return

    let cancelled = false

    const fetchTasker = async () => {
      try {
        setLoadingTasker(true)
        const response = await fetch(`/api/orders/${currentOrder._id}/tasker`)
        if (!response.ok) throw new Error('Failed to fetch tasker details')
        const data = await response.json()
        if (!cancelled) {
          setTaskerDetails(data)
          taskerOrderRef.current = currentOrder._id
        }
      } catch {
        if (!cancelled) setTaskerDetails(null)
      } finally {
        if (!cancelled) setLoadingTasker(false)
      }
    }

    void fetchTasker()

    return () => {
      cancelled = true
    }
  }, [currentOrder?._id, currentOrder?.taskerId])

  const handleConfirmPayment = async () => {
    if (!currentOrder) return

    try {
      setUpdatingAction('pay')
      const response = await fetch(`/api/orders/${currentOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasPaid: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to confirm payment')
      setCurrentOrder(data)
      previousSnapshotRef.current = {
        id: data._id,
        taskerId: data.taskerId,
        hasPaid: data.hasPaid,
      }
      toast.success('Payment confirmed!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm payment')
    } finally {
      setUpdatingAction(null)
    }
  }

  const handleCancelOrder = async () => {
    if (!currentOrder) return

    try {
      setUpdatingAction('cancel')
      const response = await fetch(`/api/orders/${currentOrder._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to cancel order')
      trackedOrderIdRef.current = null
      taskerOrderRef.current = null
      previousSnapshotRef.current = null
      setTaskerDetails(null)
      setCurrentOrder(null)
      setRecentOrders((previous) => [data, ...previous.filter((order) => order._id !== data._id)])
      toast.success('Order cancelled.')
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

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Sticky Header */}
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
            disabled={refreshing}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label="Refresh orders"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="space-y-4">
          {/* Error Message */}
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/30">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
            </div>
          ) : null}

          {/* Active Order Section */}
          {currentOrder ? (
            <div className="space-y-3">
              {/* Status Banner */}
              <div className={`rounded-xl border px-4 py-3 ${
                currentOrder.status === 'pending' 
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30' 
                  : currentOrder.hasPaid 
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                    : 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    currentOrder.status === 'pending' 
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
                      : currentOrder.hasPaid
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
                  }`}>
                    {currentStatus?.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {currentOrder.status === 'pending' 
                        ? 'Finding a tasker...' 
                        : currentOrder.hasPaid 
                          ? 'Tasker is on the way!'
                          : 'Tasker assigned - Payment needed'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {currentOrder.status === 'pending' 
                        ? 'Stay here, updates appear automatically' 
                        : currentOrder.hasPaid 
                          ? `${taskerDetails?.name || 'Your tasker'} is handling your errand`
                          : 'Transfer payment to start the task'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Details Card */}
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
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${currentStatus?.bg} ${currentStatus?.text} ${currentStatus?.darkBg} ${currentStatus?.darkText}`}>
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
                      {currentOrder.store && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          <Store className="h-3 w-3" />
                          {currentOrder.store}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Clock className="h-3 w-3" />
                        {currentOrder.deadlineValue} {currentOrder.deadlineUnit}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4 text-white dark:bg-slate-950">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-400">Total Amount</p>
                        <p className="text-2xl font-bold">
                          {formatCurrency(currentOrder.totalAmount || currentOrder.amount)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(currentOrder.createdAt).toLocaleDateString('en-NG', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasker Assigned Section */}
              {currentOrder.taskerId && !currentOrder.hasPaid && (
                <div className="space-y-3">
                  {/* Tasker Info Card */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Assigned Tasker
                      </p>
                    </div>
                    
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {taskerDetails ? (
                          <TaskerAvatar tasker={taskerDetails} size="md" />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                          </div>
                        )}
                        
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {taskerDetails?.name || currentOrder.taskerName || 'Loading...'}
                          </p>
                          {taskerDetails?.phone && (
                            <a 
                              href={`tel:${taskerDetails.phone}`}
                              className="mt-1 inline-flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400"
                            >
                              <Phone className="h-3.5 w-3.5" />
                              {taskerDetails.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Bank Details */}
                      {taskerDetails?.bankDetails && (
                        <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Bank</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{taskerDetails.bankDetails.bankName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Account Name</p>
                              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{taskerDetails.bankDetails.accountName}</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Account Number</p>
                            <div className="mt-1 flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                              <p className="font-mono text-base font-semibold tracking-wider text-slate-900 dark:text-white">
                                {taskerDetails.bankDetails.accountNumber}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(taskerDetails.bankDetails.accountNumber)
                                  toast.success('Account number copied!')
                                }}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={handleConfirmPayment}
                      disabled={updatingAction === 'pay' || !taskerDetails}
                      className="h-12 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
                    >
                      {updatingAction === 'pay' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="mr-2 h-4 w-4" />
                      )}
                      I&apos;ve Paid
                    </Button>
                    
                    <Button
                      onClick={handleCancelOrder}
                      disabled={updatingAction === 'cancel'}
                      variant="outline"
                      className="h-12 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      {updatingAction === 'cancel' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Paid/Progress State */}
              {currentOrder.hasPaid && taskerDetails && (
                <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <TaskerAvatar tasker={taskerDetails} size="sm" />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{taskerDetails.name}</p>
                        <a href={`tel:${taskerDetails.phone}`} className="text-sm text-emerald-600 dark:text-emerald-400">
                          {taskerDetails.phone}
                        </a>
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Cancel Option */}
              {currentOrder.status === 'pending' && (
                <Button
                  onClick={handleCancelOrder}
                  disabled={updatingAction === 'cancel'}
                  variant="outline"
                  className="h-11 w-full rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  {updatingAction === 'cancel' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Cancel Order
                </Button>
              )}
            </div>
          ) : (
            /* No Active Order State */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                No active orders
              </h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                You don&apos;t have any ongoing errands. Book a new task to get started!
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

          {/* Recent Orders Section */}
          {visibleRecentOrders.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Orders</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {visibleRecentOrders.length} past {visibleRecentOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>

              <div className="space-y-2">
                {visibleRecentOrders.map((order) => {
                  const status = statusConfig[order.status]
                  return (
                    <div
                      key={order._id}
                      onClick={() => {
                        if (order.status === 'completed') {
                          router.push(`/dashboard/reviews?orderId=${order._id}`)
                        }
                      }}
                      className={`group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition dark:border-slate-800 dark:bg-slate-900 ${
                        order.status === 'completed' ? 'cursor-pointer hover:border-sky-300 hover:bg-sky-50/30 dark:hover:border-sky-900 dark:hover:bg-sky-950/20' : ''
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${status.bg} ${status.text} ${status.darkBg} ${status.darkText}`}>
                        {taskTypeIcons[order.taskType] || taskTypeIcons.others}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                            {taskTypeLabels[order.taskType] || order.taskType}
                          </p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status.bg} ${status.text} ${status.darkBg} ${status.darkText}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(order.createdAt)} • {formatCurrency(order.totalAmount || order.amount)}
                        </p>
                      </div>

                      {order.status === 'completed' && (
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}