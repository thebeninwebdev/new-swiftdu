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
  UserRoundX,
  XCircle,
} from 'lucide-react'
import { io, type Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CAFE_INQUIRY_SERVICE_FEE } from '@/lib/pricing'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const POLL_INTERVAL_MS = 4000
const ACTIVE_ORDER_STATUSES = new Set(['pending', 'in_progress', 'paid'])

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
  commission: number
}

type OrderRealtimePayload = Partial<Order> & {
  _id?: string
}

interface TaskerDetails {
  _id: string
  name: string
  phone: string
  profileImage?: string | null
  bankDetails?: {
    bankName: string
    accountName: string
    accountNumber: string
  }
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  copy_notes: 'Copy Notes',
  shopping: 'Shopping',
  water: 'Bag of Water',
  others: 'General Errand',
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  restaurant: <Store className="h-4 w-4" />,
  printing: <Package className="h-4 w-4" />,
  copy_notes: <Package className="h-4 w-4" />,
  shopping: <Package className="h-4 w-4" />,
  water: <Package className="h-4 w-4" />,
  others: <Package className="h-4 w-4" />,
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

function formatDeadline(dueDate?: string, deadlineDate?: string, deadlineValue?: number, deadlineUnit?: string) {
  const exactDeadline = dueDate || deadlineDate

  if (exactDeadline) {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(exactDeadline))
  }

  if (deadlineValue && deadlineUnit) {
    return `${deadlineValue} ${deadlineUnit}`
  }

  return 'Not set'
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
    label: 'Transfer confirmed',
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

const declinedStatusConfig = {
  label: 'Payment under review',
  tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  icon: <AlertCircle className="h-3.5 w-3.5" />,
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

const getWhatsAppHref = (phone: string) => {
  const digits = phone.replace(/\D/g, '')

  if (!digits) {
    return null
  }

  const normalized =
    digits.startsWith('0') && digits.length === 11 ? `234${digits.slice(1)}` : digits

  return `https://wa.me/${normalized}`
}

const isActiveOrder = (order: Pick<Order, 'status'>) =>
  ACTIVE_ORDER_STATUSES.has(order.status)

const canRetryOrder = (order: Order) =>
  order.status === 'cancelled' && !order.hasPaid && order.paymentStatus !== 'paid'

function getTaskerSearchMessage(elapsedMs: number) {
  const elapsedMinutes = elapsedMs / 60000

  if (elapsedMinutes < 1) {
    return 'Connecting you to nearby taskers'
  }

  if (elapsedMinutes < 3) {
    return 'Searching beyond your hostel area'
  }

  if (elapsedMinutes < 5) {
    return 'This request is taking longer than usual'
  }

  return 'Still looking for available taskers'
}

function TaskerAvatar({ tasker }: { tasker: TaskerDetails }) {
  if (tasker.profileImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={tasker.profileImage}
        alt="Tasker profile"
        className="h-12 w-12 rounded-xl object-cover ring-2 ring-white dark:ring-slate-800"
      />
    )
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-indigo-600 font-bold text-white">
      T
    </div>
  )
}

function SearchingTaskerOverlay({
  order,
  onCancel,
  isCancelling,
  isBusy,
  searchMessage,
}: {
  order: Order
  onCancel: () => void
  isCancelling: boolean
  isBusy: boolean
  searchMessage: string
}) {
  const [taskerImageIndex, setTaskerImageIndex] = useState(
    () => Math.floor(Math.random() * taskerSearchImages.length)
  )
  const taskerImage = taskerSearchImages[taskerImageIndex]

  useEffect(() => {
    const imageInterval = window.setInterval(() => {
      setTaskerImageIndex((current) => (current + 1) % taskerSearchImages.length)
    }, 500)

    return () => window.clearInterval(imageInterval)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 backdrop-blur-sm md:items-center md:justify-center md:p-6">
      <div className="tasker-search-drawer w-full max-w-lg overflow-hidden rounded-t-[2rem] border border-white/70 bg-white shadow-2xl shadow-slate-950/25 dark:border-slate-800 dark:bg-slate-900 md:rounded-[2rem]">
        <div className="relative bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 px-5 pb-5 pt-5 text-white">

          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/25 md:hidden" />

          <div className="flex flex-col">
            <div className="min-w-0 flex-1">
              <h2 className="mt-2 text-2xl font-bold tracking-normal">
                Finding tasker
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {searchMessage}
              </p>
            </div>

          </div>

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="tasker-search-progress h-full origin-left rounded-full bg-linear-to-r from-sky-300 via-cyan-200 to-emerald-300" />
          </div>
          <div className="flex shrink-0 items-center gap-5 mt-5 justify-center">
              <div className="h-20 w-20 overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={taskerImage}
                  alt="Potential tasker"
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={isBusy} 
                className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-2xl bg-white/10 px-2 py-3 text-rose-100 ring-1 ring-white/15 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <UserRoundX className="h-7 w-7" />
                )}
                <span className="text-center text-[11px] font-semibold leading-tight">
                  Cancel task
                </span>
              </button>
            </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Task
              </p>
              <p className="mt-2 truncate text-sm font-semibold text-slate-900 dark:text-white">
                {taskTypeLabels[order.taskType] || order.taskType}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Amount
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {formatCurrency(order.totalAmount || order.amount)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5" />
                {order.location}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                <Clock className="h-3.5 w-3.5" />
                {formatDeadline(
                  order.dueDate || order.deadline,
                  order.deadlineDate,
                  order.deadlineValue,
                  order.deadlineUnit
                )}
              </span>
            </div>
          </div>

          {isCancelling ? (
            <p className="text-center text-xs font-medium text-rose-500 dark:text-rose-300">
              Cancelling task...
            </p>
          ) : null}
        </div>
      </div>
      <style jsx>{`
        .tasker-search-drawer {
          animation: tasker-search-drawer-in 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .tasker-search-progress {
          animation: tasker-search-progress 2.4s ease-in-out infinite;
        }

        @keyframes tasker-search-drawer-in {
          from {
            opacity: 0;
            transform: translateY(28px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes tasker-search-progress {
          0% {
            transform: scaleX(0);
          }
          82% {
            transform: scaleX(1);
          }
          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [confirmingTransfer, setConfirmingTransfer] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [searchElapsedMs, setSearchElapsedMs] = useState(0)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [taskerDetails, setTaskerDetails] = useState<TaskerDetails | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [loadingTasker, setLoadingTasker] = useState(false)
  const [updatingAction, setUpdatingAction] = useState<'cancel' | 'retry' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const trackedOrderIdRef = useRef<string | null>(null)
  const previousSnapshotRef = useRef<{
    id: string
    taskerId?: string
    hasPaid?: boolean
    isDeclinedTask?: boolean
  } | null>(null)
  const taskerOrderRef = useRef<string | null>(null)
  const fetchingRef = useRef(false)
  const queuedReloadRef = useRef(false)
  const queuedInitialReloadRef = useRef(false)
  const socketRef = useRef<Socket | null>(null)
  const currentOrderRef = useRef<Order | null>(null)
  const realtimeResumeTimeoutRef = useRef<number | null>(null)
  const redirectedToReviewRef = useRef<string | null>(null)
  const autoCancelledOrderRef = useRef<string | null>(null)
  const requestedOrderId = searchParams.get('orderId')

  useEffect(() => {
    currentOrderRef.current = currentOrder
  }, [currentOrder])

  const disconnectSocket = useCallback(() => {
    if (realtimeResumeTimeoutRef.current) {
      window.clearTimeout(realtimeResumeTimeoutRef.current)
      realtimeResumeTimeoutRef.current = null
    }
    socketRef.current?.disconnect()
    socketRef.current = null
  }, [])

  const pauseRealtimeForApi = useCallback((duration = 1200) => {
    const socket = socketRef.current
    if (!socket) return

    if (realtimeResumeTimeoutRef.current) {
      window.clearTimeout(realtimeResumeTimeoutRef.current)
    }

    if (socket.connected) {
      socket.disconnect()
    }

    realtimeResumeTimeoutRef.current = window.setTimeout(() => {
      realtimeResumeTimeoutRef.current = null
      if (socketRef.current === socket && !socket.connected) {
        socket.connect()
      }
    }, duration)
  }, [])

  const fetchWithRealtimePause = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      pauseRealtimeForApi()

      try {
        return await fetch(input, init)
      } finally {
        pauseRealtimeForApi()
      }
    },
    [pauseRealtimeForApi]
  )

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
            toast.success('A tasker accepted your order.')
          }

          if (!previousSnapshotRef.current.hasPaid && nextCurrentOrder.hasPaid) {
            toast.success('Your transfer has been confirmed. Your task is now moving.')
          }

          if (
            !previousSnapshotRef.current.isDeclinedTask &&
            Boolean(nextCurrentOrder.isDeclinedTask)
          ) {
            toast.error(
              nextCurrentOrder.declinedMessage ||
                'We could not confirm that transfer. Our team will contact you within 24 hours.'
            )
          }
        }

        previousSnapshotRef.current = nextCurrentOrder
          ? {
              id: nextCurrentOrder._id,
              taskerId: nextCurrentOrder.taskerId,
              hasPaid: nextCurrentOrder.hasPaid,
              isDeclinedTask: nextCurrentOrder.isDeclinedTask,
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

  const applyRealtimeOrderUpdate = useCallback(
    (payload?: OrderRealtimePayload) => {
      if (!payload?._id) {
        return false
      }

      const existingOrder = currentOrderRef.current
      const isCurrentOrder = existingOrder?._id === payload._id
      const isTrackedOrder = trackedOrderIdRef.current === payload._id

      if (!isCurrentOrder && !isTrackedOrder) {
        setRecentOrders((previous) =>
          previous.map((order) =>
            order._id === payload._id ? ({ ...order, ...payload, _id: order._id } as Order) : order
          )
        )
        return false
      }

      if (existingOrder && isCurrentOrder) {
        const nextOrder = { ...existingOrder, ...payload, _id: existingOrder._id } as Order

        if (!existingOrder.taskerId && nextOrder.taskerId) {
          toast.success('A tasker accepted your order.')
        }

        if (!existingOrder.hasPaid && nextOrder.hasPaid) {
          toast.success('Your transfer has been confirmed. Your task is now moving.')
        }

        if (!existingOrder.isDeclinedTask && Boolean(nextOrder.isDeclinedTask)) {
          toast.error(
            nextOrder.declinedMessage ||
              'We could not confirm that transfer. Our team will contact you within 24 hours.'
          )
        }

        previousSnapshotRef.current = {
          id: nextOrder._id,
          taskerId: nextOrder.taskerId,
          hasPaid: nextOrder.hasPaid,
          isDeclinedTask: nextOrder.isDeclinedTask,
        }
        trackedOrderIdRef.current = nextOrder._id
        currentOrderRef.current = nextOrder
        setCurrentOrder(nextOrder)
        setRecentOrders((previous) =>
          previous.map((order) =>
            order._id === nextOrder._id ? ({ ...order, ...nextOrder } as Order) : order
          )
        )

        if (
          nextOrder.status === 'completed' &&
          nextOrder.hasPaid &&
          redirectedToReviewRef.current !== nextOrder._id
        ) {
          redirectedToReviewRef.current = nextOrder._id
          toast.success('Task completed. Please rate your tasker.')
          router.replace(`/dashboard/reviews/${nextOrder._id}`)
        }

        return true
      }

      return false
    },
    [router]
  )

  useEffect(() => {
    void loadOrders(true)
  }, [loadOrders])

  useEffect(() => {
    if (!requestedOrderId || requestedOrderId === trackedOrderIdRef.current) {
      return
    }

    trackedOrderIdRef.current = requestedOrderId
    previousSnapshotRef.current = null
    taskerOrderRef.current = null
    setTaskerDetails(null)
    void loadOrders(true)
  }, [loadOrders, requestedOrderId])

  useEffect(() => {
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
  }, [loadOrders])

  useEffect(() => {
    const socket = io({
      withCredentials: true,
      transports: ['websocket'],
    })

    socketRef.current = socket

    const watchCurrentOrder = () => {
      const orderId = trackedOrderIdRef.current || currentOrderRef.current?._id
      if (orderId) {
        socket.emit('order:watch', orderId)
      }
    }

    socket.on('connect', () => {
      watchCurrentOrder()
      void loadOrders(false)
    })

    socket.on('order:updated', (payload?: OrderRealtimePayload) => {
      const applied = applyRealtimeOrderUpdate(payload)
      if (!applied) {
        void loadOrders(false)
        return
      }

      window.setTimeout(() => {
        void loadOrders(false)
      }, 300)
    })

    watchCurrentOrder()

    return () => {
      if (socketRef.current === socket) {
        disconnectSocket()
        return
      }

      socket.disconnect()
    }
  }, [applyRealtimeOrderUpdate, disconnectSocket, loadOrders])

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
        const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}/tasker`, {
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
  }, [currentOrder?._id, currentOrder?.taskerId, fetchWithRealtimePause])

  useEffect(() => {
    return () => {
      disconnectSocket()
    }
  }, [disconnectSocket])

  const transferUnderReview = Boolean(currentOrder?.isDeclinedTask)
  const needsCafeDetails = Boolean(
    currentOrder?.cafeInquiry &&
      currentOrder.cafeInquiryFeePaid &&
      !currentOrder.cafeInquiryDetailsSubmitted
  )
  const transferAmount =
    currentOrder?.cafeInquiry && currentOrder.cafeInquiryFeePaid
      ? Number(currentOrder.amount || 0)
      : Number(currentOrder?.totalAmount || currentOrder?.amount || 0)
  const needsPayment = Boolean(
    currentOrder?.taskerId &&
      !currentOrder?.hasPaid &&
      !transferUnderReview &&
      !needsCafeDetails
  )
  const whatsappHref = taskerDetails?.phone ? getWhatsAppHref(taskerDetails.phone) : null

  useEffect(() => {
    if (needsPayment) {
      setPaymentModalOpen(true)
      return
    }

    setPaymentModalOpen(false)
  }, [currentOrder?._id, needsPayment])

  const handleOpenOrder = (orderId: string) => {
    if (trackedOrderIdRef.current === orderId) {
      return
    }

    trackedOrderIdRef.current = orderId
    previousSnapshotRef.current = null
    taskerOrderRef.current = null
    setTaskerDetails(null)
    router.replace(`/dashboard/tasks?orderId=${orderId}`)
    void loadOrders(false)
  }

  const handleConfirmTransfer = async () => {
    if (!currentOrder) {
      return
    }

    try {
      setConfirmingTransfer(true)

      const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}/confirm-transfer`, {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to confirm the transfer.')
      }

      setCurrentOrder(payload.order)
      trackedOrderIdRef.current = payload.order?._id || currentOrder._id
      previousSnapshotRef.current = payload.order
        ? {
            id: payload.order._id,
            taskerId: payload.order.taskerId,
            hasPaid: payload.order.hasPaid,
            isDeclinedTask: payload.order.isDeclinedTask,
          }
        : null
      setPaymentModalOpen(false)
      toast.success('Payment updated. Open WhatsApp and stay online for your tasker.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm the transfer.')
      void loadOrders(false)
    } finally {
      setConfirmingTransfer(false)
    }
  }

  const handleCancelOrder = useCallback(async () => {
    if (!currentOrder) {
      return
    }

    try {
      setUpdatingAction('cancel')
      const response = await fetchWithRealtimePause(`/api/orders/${currentOrder._id}`, {
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
      setTaskerDetails(null)
      setCurrentOrder(null)
      setRecentOrders((previous) => [data, ...previous.filter((order) => order._id !== data._id)])
      toast.success('Order cancelled.')
      router.replace('/dashboard/tasks')
      void loadOrders(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel order')
    } finally {
      setUpdatingAction(null)
    }
  }, [currentOrder, fetchWithRealtimePause, loadOrders, router])

  const handleRetryOrder = useCallback(
    async (order: Order) => {
      if (updatingAction || confirmingTransfer || !canRetryOrder(order)) {
        return
      }

      try {
        setUpdatingAction('retry')
        const response = await fetchWithRealtimePause(`/api/orders/${order._id}/retry`, {
          method: 'POST',
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to retry task')
        }

        trackedOrderIdRef.current = data._id
        taskerOrderRef.current = null
        previousSnapshotRef.current = {
          id: data._id,
          taskerId: data.taskerId,
          hasPaid: data.hasPaid,
          isDeclinedTask: data.isDeclinedTask,
        }
        setTaskerDetails(null)
        setCurrentOrder(data)
        setRecentOrders((previous) => [
          data,
          ...previous.filter(
            (existingOrder) =>
              existingOrder._id !== data._id && existingOrder._id !== order._id
          ),
        ])
        toast.success('Task sent again. We are looking for taskers now.')
        router.replace(`/dashboard/tasks?orderId=${data._id}`)
        void loadOrders(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to retry task')
      } finally {
        setUpdatingAction(null)
      }
    },
    [confirmingTransfer, fetchWithRealtimePause, loadOrders, router, updatingAction]
  )

  const requestCancelOrder = useCallback(() => {
    if (!currentOrder || updatingAction === 'cancel' || confirmingTransfer) {
      return
    }

    setCancelConfirmOpen(true)
  }, [confirmingTransfer, currentOrder, updatingAction])

  const confirmCancelOrder = useCallback(() => {
    setCancelConfirmOpen(false)
    void handleCancelOrder()
  }, [handleCancelOrder])

  useEffect(() => {
    if (!currentOrder || currentOrder.status !== 'pending') {
      setSearchElapsedMs(0)
      return
    }

    const startedAt = new Date(currentOrder.createdAt).getTime()

    if (!Number.isFinite(startedAt)) {
      setSearchElapsedMs(0)
      return
    }

    const updateElapsed = () => {
      setSearchElapsedMs(Math.max(Date.now() - startedAt, 0))
    }

    updateElapsed()
    const intervalId = window.setInterval(updateElapsed, 1000)

    return () => window.clearInterval(intervalId)
  }, [currentOrder?._id, currentOrder?.createdAt, currentOrder?.status])

  useEffect(() => {
    if (!currentOrder || currentOrder.status !== 'pending') {
      return
    }

    if (searchElapsedMs < 7 * 60000) {
      return
    }

    if (autoCancelledOrderRef.current === currentOrder._id) {
      return
    }

    autoCancelledOrderRef.current = currentOrder._id
    toast.error('No tasker accepted within 7 minutes, so the request was cancelled.')
    void handleCancelOrder()
  }, [currentOrder, handleCancelOrder, searchElapsedMs])

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
  const additionalActiveOrders = visibleRecentOrders.filter(isActiveOrder)
  const pastOrders = visibleRecentOrders.filter((order) => !isActiveOrder(order))
  const currentStatus = currentOrder
    ? currentOrder.isDeclinedTask
      ? declinedStatusConfig
      : statusConfig[currentOrder.status]
    : null
  const commission = currentOrder?.commission || 0
  const isSearchingForTasker = currentOrder?.status === 'pending'

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ">
      {currentOrder && isSearchingForTasker ? (
        <SearchingTaskerOverlay
          order={currentOrder}
          onCancel={requestCancelOrder}
          isCancelling={updatingAction === 'cancel'}
          isBusy={updatingAction === 'cancel' || confirmingTransfer}
          searchMessage={getTaskerSearchMessage(searchElapsedMs)}
        />
      ) : null}

      {/* <div className="sticky top-16 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 lg:top-0">
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
            disabled={refreshing || confirmingTransfer}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            aria-label="Refresh orders"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div> */}

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
                  currentOrder.isDeclinedTask
                    ? 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30'
                    : currentOrder.status === 'pending'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
                    : currentOrder.hasPaid
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                      : 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {currentOrder.status === 'pending'
                    ? 'Finding a tasker...'
                    : currentOrder.isDeclinedTask
                      ? 'Payment under review'
                    : currentOrder.hasPaid
                      ? 'Transfer confirmed'
                      : 'Tasker assigned, payment required'}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {currentOrder.status === 'pending'
                    ? 'Stay here while we search. This page updates automatically.'
                    : currentOrder.isDeclinedTask
                      ? currentOrder.declinedMessage ||
                        'The transaction was not found and we will contact you within 24 hours.'
                    : currentOrder.hasPaid
                      ? 'Open WhatsApp with the number below and stay online so your tasker can reach you.'
                      : 'Use the transfer modal to pay your tasker, then tap "I\'ve paid".'}
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
                      {currentOrder.description ||
                        taskTypeLabels[currentOrder.taskType] ||
                        'Order details'}
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
                        {formatDeadline(
                          currentOrder.dueDate || currentOrder.deadline,
                          currentOrder.deadlineDate,
                          currentOrder.deadlineValue,
                          currentOrder.deadlineUnit
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-950 p-4 text-white">
                    <p className="text-xs text-slate-400">
                      {currentOrder.cafeInquiry && currentOrder.cafeInquiryFeePaid
                        ? 'Food budget to transfer to your tasker'
                        : 'Total amount to transfer to your tasker'}
                    </p>
                    <p className="mt-1 text-2xl font-bold">
                      {formatCurrency(transferAmount)}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Item budget: {formatCurrency(currentOrder.amount)}</span>
                      <span>Service fee: {formatCurrency(commission)}</span>
                    </div>
                  </div>

                  {(currentOrder.paymentStatus === 'failed' ||
                    currentOrder.paymentStatus === 'cancelled') &&
                  !currentOrder.isDeclinedTask ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                      {currentOrder.paymentFailureReason ||
                        'The transfer confirmation could not be completed.'}
                    </div>
                  ) : null}
                </div>
              </div>

              {needsPayment ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        Payment required to continue
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Your transfer details are ready in the payment modal. Copy the account
                        number, send the full amount, then tap &quot;I&apos;ve paid&quot;.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => setPaymentModalOpen(true)}
                      disabled={confirmingTransfer || updatingAction === 'cancel'}
                      className="h-12 rounded-xl bg-linear-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Open transfer details
                    </Button>
                    <Button
                      onClick={requestCancelOrder}
                      disabled={updatingAction === 'cancel' || confirmingTransfer}
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
                </div>
              ) : null}

              {needsCafeDetails ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50/90 p-4 dark:border-orange-900/60 dark:bg-orange-950/20">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Message your tasker for cafe options
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Your {formatCurrency(CAFE_INQUIRY_SERVICE_FEE)} cafe inquiry service fee is marked as paid. Use WhatsApp to ask what is available, choose the food, and agree on the budget with your tasker.
                  </p>
                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      Open WhatsApp
                    </a>
                  ) : null}
                </div>
              ) : null}

              {transferUnderReview ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Transaction not found
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {currentOrder.declinedMessage ||
                          'The transaction was not found and we will be in contact within 24 hours.'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {currentOrder.taskerId && !needsPayment ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Tasker Contact
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
                        {taskerDetails?.phone ? (
                          <a
                            href={`tel:${taskerDetails.phone}`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 dark:text-sky-400"
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
                      {(currentOrder.hasPaid || needsCafeDetails) && whatsappHref ? (
                        <a
                          href={whatsappHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-600"
                        >
                          Open WhatsApp
                        </a>
                      ) : null}
                    </div>
                    {currentOrder.hasPaid ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
                        Call or message this number on WhatsApp and stay online so your tasker can
                        reach you quickly.
                      </div>
                    ) : null}
                    {needsCafeDetails ? (
                      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/80 px-4 py-3 text-sm text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200">
                        Ask what is in cafe on WhatsApp, then agree on the food and budget with your tasker.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {currentOrder.hasPaid ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Your transfer has been marked as sent.
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Call the number on WhatsApp and stay online so the tasker can reach you while
                    handling your errand.
                  </p>
                </div>
              ) : null}

              {currentOrder.status === 'pending' ? (
                <Button
                  onClick={requestCancelOrder}
                  disabled={updatingAction === 'cancel' || confirmingTransfer}
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

          {additionalActiveOrders.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  More Active Orders
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {additionalActiveOrders.length} available to open
                </span>
              </div>
              <div className="space-y-2">
                {additionalActiveOrders.map((order) => {
                  const status = order.isDeclinedTask ? declinedStatusConfig : statusConfig[order.status]

                  return (
                    <button
                      key={order._id}
                      type="button"
                      onClick={() => handleOpenOrder(order._id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-sky-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-800"
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
                      <span className="shrink-0 text-xs font-semibold text-sky-600 dark:text-sky-400">
                        Open
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {pastOrders.length > 0 ? (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Recent Orders
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {pastOrders.length} past {pastOrders.length === 1 ? 'order' : 'orders'}
                </span>
              </div>
              <div className="space-y-2">
                {pastOrders.map((order) => {
                  const status = order.isDeclinedTask ? declinedStatusConfig : statusConfig[order.status]
                  const retryable = canRetryOrder(order)

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
                      {retryable ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={updatingAction === 'retry' || confirmingTransfer}
                          onClick={() => void handleRetryOrder(order)}
                          className="shrink-0 rounded-xl border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-900 dark:text-sky-300 dark:hover:bg-sky-950/30"
                        >
                          {updatingAction === 'retry' ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                          )}
                          Retry
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this task?</DialogTitle>
            <DialogDescription>
              Taskers will stop seeing this request. You can create a new task anytime if you
              still need help.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelConfirmOpen(false)}
              disabled={updatingAction === 'cancel'}
              className="h-11 rounded-xl"
            >
              Keep searching
            </Button>
            <Button
              type="button"
              onClick={confirmCancelOrder}
              disabled={updatingAction === 'cancel'}
              className="h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700"
            >
              {updatingAction === 'cancel' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Cancel task'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer to your tasker</DialogTitle>
            <DialogDescription>
              Send{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {formatCurrency(transferAmount)}
              </span>{' '}
              to the account below, then tap &quot;I&apos;ve paid&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Transfer Amount
              </p>
              <p className="mt-2 text-3xl font-bold">
                {formatCurrency(transferAmount)}
              </p>
            </div>

            {loadingTasker && !taskerDetails ? (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-5 dark:border-slate-800">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Loading transfer details...
                </p>
              </div>
            ) : null}

            {taskerDetails?.bankDetails ? (
              <div className="grid gap-3">
                <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Bank
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {taskerDetails.bankDetails.bankName?.toUpperCase() || 'Not available'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Account Name
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {taskerDetails.bankDetails.accountName?.toUpperCase() || 'Not available'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-sky-50/70 px-4 py-4 dark:border-slate-800 dark:bg-sky-950/20">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                    Account Number
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-[0.08em] text-slate-900 dark:text-white">
                    {taskerDetails.bankDetails.accountNumber || 'Not available'}
                  </p>
                </div>
              </div>
            ) : null}

            {(currentOrder?.paymentStatus === 'failed' || currentOrder?.paymentStatus === 'cancelled') &&
            !currentOrder?.isDeclinedTask ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                {currentOrder?.paymentFailureReason ||
                  'The transfer confirmation could not be completed.'}
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button
              onClick={() => void handleConfirmTransfer()}
              disabled={confirmingTransfer || !taskerDetails?.bankDetails?.accountNumber}
              className="h-12 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700"
            >
              {confirmingTransfer ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating order...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  I&apos;ve paid
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentModalOpen(false)}
              disabled={confirmingTransfer}
              className="h-12 rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
