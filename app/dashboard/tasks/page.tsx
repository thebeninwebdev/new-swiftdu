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
  Search,
  Store,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { io, type Socket } from 'socket.io-client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

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
  restaurant: 'Restaurant order',
  printing: 'Printing job',
  shopping: 'Shopping task',
  others: 'General errand',
}

const pillStyles: Record<Order['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
}

const isActiveOrder = (order: Order | null) =>
  !!order && ['pending', 'in_progress', 'paid'].includes(order.status)

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

const formatDate = (date: string) =>
  new Date(date).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const currentStatusLabel = (order: Order) => {
  if (order.status === 'pending') return 'Searching for a tasker'
  if (!order.hasPaid) return 'Tasker assigned, payment needed'
  return 'Order in progress'
}

function TaskerAvatar({ tasker }: { tasker: TaskerDetails }) {
  if (tasker.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={tasker.profileImage}
        alt={tasker.name}
        className="h-16 w-16 rounded-2xl object-cover ring-1 ring-black/10"
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
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 text-lg font-bold text-white">
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
              toast.success('Order completed. Leave a review for your tasker.')
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
          toast.success(`${nextCurrentOrder.taskerName || 'A tasker'} accepted your order.`)
        }
        if (!previousSnapshotRef.current.hasPaid && nextCurrentOrder.hasPaid) {
          toast.success('Payment confirmed. Your order is now in progress.')
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
      toast.success('Payment marked as completed.')
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
      <div className="min-h-screen bg-linear-to-br from-[#f6f8fb] via-white to-[#eef7ff] px-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-sky-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Loading your order tracker...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const visibleRecentOrders = recentOrders.filter(
    (order) => !currentOrder || order._id !== currentOrder._id
  )

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f6f8fb] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:px-6 md:py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
              Order tracker
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Track your live order here without refreshing. Tasker assignment, payment, and completion updates will appear on this page.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadOrders(false)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-md shadow-slate-200/70 ring-1 ring-slate-200 transition hover:text-sky-600 dark:bg-slate-900 dark:text-slate-300 dark:shadow-none dark:ring-slate-800"
            aria-label="Refresh orders"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>

        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {currentOrder ? (
          <>
            <Card className="rounded-[1.75rem] border-0 bg-white/90 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-slate-950/60 dark:ring-slate-800">
              <CardHeader className="px-5 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Current order
                    </p>
                    <CardTitle className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {currentStatusLabel(currentOrder)}
                    </CardTitle>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${pillStyles[currentOrder.status]}`}>
                    {currentOrder.status.replace('_', ' ')}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-5 pb-5">
                <div className="rounded-[1.5rem] bg-linear-to-br from-slate-950 to-slate-800 p-4 text-white">
                  <p className="text-sm font-semibold text-slate-100">
                    {taskTypeLabels[currentOrder.taskType] || currentOrder.taskType}
                  </p>
                  <p className="mt-2 text-base leading-7 text-slate-200">
                    {currentOrder.description}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm text-slate-200">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cyan-300" />
                      <span>{currentOrder.location}</span>
                    </div>
                    {currentOrder.store ? (
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-cyan-300" />
                        <span>{currentOrder.store}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Total to pay
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(currentOrder.totalAmount || currentOrder.amount)}
                    </p>
                  </div>
                  <p className="max-w-28 text-right text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Booked {formatDate(currentOrder.createdAt)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {!currentOrder.taskerId ? (
              <Card className="rounded-[1.75rem] border-0 bg-amber-50/90 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900">
                <CardContent className="space-y-4 px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        Searching for an available tasker
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Stay here. As soon as a tasker accepts, their photo, phone number, and bank details will appear automatically.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-amber-200 dark:bg-slate-950/60 dark:ring-amber-900">
                    <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <Search className="h-4 w-4 text-amber-600" />
                      <span>You can cancel while no tasker has been assigned yet.</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleCancelOrder}
                    disabled={updatingAction === 'cancel'}
                    variant="outline"
                    className="h-12 w-full rounded-2xl border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-950 dark:text-rose-300"
                  >
                    {updatingAction === 'cancel' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling order...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel order
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : currentOrder.hasPaid ? (
              <Card className="rounded-[1.75rem] border-0 bg-emerald-50/90 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900">
                <CardContent className="space-y-4 px-5 py-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        Order in progress
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Payment has been confirmed. {taskerDetails?.name || 'Your tasker'} can continue with your errand now.
                      </p>
                    </div>
                  </div>

                  {taskerDetails ? (
                    <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-200 dark:bg-slate-950/60 dark:ring-emerald-900">
                      <div className="flex items-center gap-3">
                        <TaskerAvatar tasker={taskerDetails} />
                        <div>
                          <p className="text-base font-semibold text-slate-900 dark:text-white">
                            {taskerDetails.name}
                          </p>
                          <a
                            href={`tel:${taskerDetails.phone}`}
                            className="mt-1 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
                          >
                            <Phone className="h-4 w-4 text-emerald-600" />
                            {taskerDetails.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="rounded-[1.75rem] border-0 bg-white/90 ring-1 ring-sky-200 dark:bg-slate-900/90 dark:ring-sky-900">
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="flex items-start gap-4">
                      {taskerDetails ? (
                        <TaskerAvatar tasker={taskerDetails} />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                          Tasker assigned
                        </p>
                        <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                          {taskerDetails?.name || currentOrder.taskerName || 'Loading tasker details'}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                          Transfer the amount below, then tap the payment confirmation button.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Tasker phone
                        </p>
                        <a
                          href={taskerDetails?.phone ? `tel:${taskerDetails.phone}` : undefined}
                          className="mt-2 inline-flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"
                        >
                          <Phone className="h-4 w-4 text-sky-600" />
                          {taskerDetails?.phone || 'Loading...'}
                        </a>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Amount to transfer
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                          {formatCurrency(currentOrder.totalAmount || currentOrder.amount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[1.75rem] border-0 bg-slate-950 text-white shadow-2xl shadow-slate-300/50 dark:shadow-slate-950/60">
                  <CardHeader className="px-5 pt-5">
                    <CardTitle className="text-xl font-bold">Transfer to this account</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-5 pb-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Bank name
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {taskerDetails?.bankDetails.bankName || 'Loading...'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Account name
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {taskerDetails?.bankDetails.accountName || 'Loading...'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Account number
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3">
                        <p className="text-lg font-bold tracking-[0.18em]">
                          {taskerDetails?.bankDetails.accountNumber || 'Loading...'}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (!taskerDetails?.bankDetails.accountNumber) return
                            navigator.clipboard.writeText(taskerDetails.bankDetails.accountNumber)
                            toast.success('Account number copied')
                          }}
                          className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        onClick={handleConfirmPayment}
                        disabled={updatingAction === 'pay' || !taskerDetails}
                        className="h-12 rounded-2xl bg-linear-to-r from-emerald-500 to-cyan-500 text-white"
                      >
                        {updatingAction === 'pay' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Confirming payment...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            I have made payment
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={handleCancelOrder}
                        disabled={updatingAction === 'cancel' || updatingAction === 'pay'}
                        variant="outline"
                        className="h-12 rounded-2xl border-rose-200 bg-transparent text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
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
                  </CardContent>
                </Card>
              </div>
            )}

            {loadingTasker && currentOrder.taskerId ? (
              <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
                  Fetching your assigned tasker details...
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <Card className="overflow-hidden rounded-[2rem] border-0 bg-white/90 shadow-2xl shadow-slate-200/70 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-slate-950/70 dark:ring-slate-800">
            <div className="bg-linear-to-r from-sky-600 via-indigo-600 to-cyan-500 px-5 py-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                No live order
              </p>
              <h1 className="mt-3 text-3xl font-bold">You&apos;re free to book a new task</h1>
              <p className="mt-3 text-sm leading-6 text-sky-50">
                Once you post an errand, this page becomes your live tracker. We keep it focused so mobile users can see the current status fast.
              </p>
            </div>
            <CardContent className="space-y-4 px-5 py-5">
              <Button
                onClick={() => router.push('/dashboard')}
                className="h-12 w-full rounded-2xl bg-linear-to-r from-sky-600 to-indigo-600 text-white"
              >
                Book a task
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Recent orders
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your latest activity and review shortcuts.
            </p>
          </div>

          {visibleRecentOrders.length === 0 ? (
            <div className="rounded-[1.5rem] bg-white px-4 py-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-800">
              No recent orders yet.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRecentOrders.map((order) => (
                <Card key={order._id} className="rounded-[1.5rem] border-0 bg-white/90 shadow-md shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-none dark:ring-slate-800">
                  <CardContent className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {taskTypeLabels[order.taskType] || order.taskType}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${pillStyles[order.status]}`}>
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {order.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(order.totalAmount || order.amount)}
                      </p>
                      {order.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/reviews?orderId=${order._id}`)}
                          className="text-sm font-semibold text-sky-600 transition hover:text-sky-700 dark:text-sky-300"
                        >
                          Leave review
                        </button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
