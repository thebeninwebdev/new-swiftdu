'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import type { Variants } from 'framer-motion'
import {
  ArrowRight,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Filter,
  X,
  Wallet,
  Package,
  Store,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { acquireSharedSocket, fetchWithSocketPause, releaseSharedSocket } from '@/lib/client-socket'
import { getCompletionWindowMinutes } from '@/lib/completion-timer'
import { convertToNaira } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { calculateRestaurantServiceFee } from '@/lib/pricing'
import { useVisibleInterval } from '@/hooks/use-visible-interval'

const REALTIME_REVALIDATE_DELAY_MS = 1200
const REALTIME_POLL_INTERVAL_MS = 10000

interface Errand {
  _id: string
  userId: string
  taskType: string
  description: string
  amount: number
  commission?: number
  platformFee?: number
  taskerFee?: number
  serviceFeeDiscountApplied?: boolean
  serviceFeeDiscountGrantedByName?: string
  serviceFeeDiscountGrantedByPhone?: string
  discountCommissionAmount?: number
  totalAmount?: number
  dueDate?: string
  deadline?: string
  deadlineDate?: string
  location: string
  store?: string
  packaging?: string
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  restaurantPackagingFee?: number
  indomiePacks?: number
  eggCount?: number
  status: string
  taskerId?: string
  acceptedBy?: string
  acceptedAt?: string
  completionTimerStartedAt?: string
  completionDueAt?: string
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  completedBeforeTimer?: boolean
  platformFeeWaivedForFastCompletion?: boolean
  prematureCompletionReported?: boolean
  hasPaid?: boolean
  isDeclinedTask?: boolean
  isTestOrder?: boolean
  createdAt: string
}

interface TaskerData {
  _id: string
  isVerified: boolean
  taskerMode?: 'training' | 'live'
  isSettlementSuspended?: boolean
}

interface RealtimeTaskPayload {
  _id: string
  userId: string
  taskType?: string
  description?: string
  amount?: number
  commission?: number
  platformFee?: number
  taskerFee?: number
  serviceFeeDiscountApplied?: boolean
  serviceFeeDiscountGrantedByName?: string
  serviceFeeDiscountGrantedByPhone?: string
  discountCommissionAmount?: number
  totalAmount?: number
  dueDate?: string
  deadline?: string
  deadlineDate?: string
  location?: string
  store?: string
  packaging?: string
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  restaurantPackagingFee?: number
  indomiePacks?: number
  eggCount?: number
  status?: string
  taskerId?: string
  acceptedAt?: string
  completionTimerStartedAt?: string
  completionDueAt?: string
  completionWindowMinutes?: number
  completionExtensionMinutes?: number
  completedBeforeTimer?: boolean
  platformFeeWaivedForFastCompletion?: boolean
  prematureCompletionReported?: boolean
  hasPaid?: boolean
  isDeclinedTask?: boolean
  isTestOrder?: boolean
  createdAt?: string
}

const taskTypes = [
  { value: 'all', label: 'All Tasks', icon: Sparkles, color: 'bg-slate-500' },
  { value: 'restaurant', label: 'Food', icon: Package, color: 'bg-orange-500' },
  { value: 'printing', label: 'Print', icon: Package, color: 'bg-sky-500' },
  { value: 'copy_notes', label: 'Copy', icon: Package, color: 'bg-amber-500' },
  { value: 'shopping', label: 'Shop', icon: Package, color: 'bg-emerald-500' },
  { value: 'indomie', label: 'Indomie', icon: Package, color: 'bg-rose-500' },
  { value: 'dry_cleaning', label: 'Dry Clean', icon: Package, color: 'bg-cyan-500' },
  { value: 'water', label: 'Water Bags', icon: Package, color: 'bg-cyan-500' },
  { value: 'others', label: 'Other', icon: Package, color: 'bg-slate-500' },
]

const taskTypeStyles: Record<string, string> = {
  restaurant: 'from-orange-500 to-amber-500',
  printing: 'from-sky-500 to-blue-500',
  copy_notes: 'from-amber-500 to-yellow-500',
  shopping: 'from-emerald-500 to-teal-500',
  indomie: 'from-rose-500 to-amber-500',
  dry_cleaning: 'from-cyan-500 to-blue-500',
  water: 'from-cyan-500 to-blue-500',
  others: 'from-slate-500 to-gray-500',
}

const taskTypeBg: Record<string, string> = {
  restaurant: 'bg-orange-50 text-orange-700 border-orange-200',
  printing: 'bg-sky-50 text-sky-700 border-sky-200',
  copy_notes: 'bg-amber-50 text-amber-700 border-amber-200',
  shopping: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  indomie: 'bg-rose-50 text-rose-700 border-rose-200',
  dry_cleaning: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  water: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  others: 'bg-slate-50 text-slate-700 border-slate-200',
}

const headerVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  },
}

const filterVariants: Variants = {
  hidden: { opacity: 0, height: 0, overflow: 'hidden' },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2 },
  },
}

const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

function matchesRealtimeFilters(
  payload: RealtimeTaskPayload,
  taskTypeFilter: string,
  locationFilter: string
) {
  const matchesTaskType = taskTypeFilter === 'all' || payload.taskType === taskTypeFilter
  const normalizedLocation = locationFilter.trim().toLowerCase()
  const matchesLocation =
    !normalizedLocation ||
    String(payload.location || '')
      .toLowerCase()
      .includes(normalizedLocation)

  return matchesTaskType && matchesLocation
}

function sortErrands(items: Errand[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function toErrand(payload: RealtimeTaskPayload): Errand {
  return {
    _id: payload._id,
    userId: payload.userId,
    taskType: payload.taskType || 'others',
    description: payload.description || '',
    amount: Number(payload.amount || 0),
    commission: payload.commission,
    platformFee: payload.platformFee,
    taskerFee: payload.taskerFee,
    serviceFeeDiscountApplied: payload.serviceFeeDiscountApplied,
    serviceFeeDiscountGrantedByName: payload.serviceFeeDiscountGrantedByName,
    serviceFeeDiscountGrantedByPhone: payload.serviceFeeDiscountGrantedByPhone,
    discountCommissionAmount: payload.discountCommissionAmount,
    totalAmount: payload.totalAmount,
    dueDate: payload.dueDate,
    deadline: payload.deadline,
    deadlineDate: payload.deadlineDate,
    location: payload.location || '',
    store: payload.store,
    packaging: payload.packaging,
    restaurantPeopleCount: payload.restaurantPeopleCount,
    restaurantTakeawayCount: payload.restaurantTakeawayCount,
    restaurantPackagingFee: payload.restaurantPackagingFee,
    indomiePacks: payload.indomiePacks,
    eggCount: payload.eggCount,
    status: payload.status || 'pending',
    taskerId: payload.taskerId,
    acceptedAt: payload.acceptedAt,
    completionTimerStartedAt: payload.completionTimerStartedAt,
    completionDueAt: payload.completionDueAt,
    completionWindowMinutes: payload.completionWindowMinutes,
    completionExtensionMinutes: payload.completionExtensionMinutes,
    completedBeforeTimer: payload.completedBeforeTimer,
    platformFeeWaivedForFastCompletion: payload.platformFeeWaivedForFastCompletion,
    prematureCompletionReported: payload.prematureCompletionReported,
    hasPaid: payload.hasPaid,
    isDeclinedTask: payload.isDeclinedTask,
    isTestOrder: payload.isTestOrder,
    createdAt: payload.createdAt || new Date().toISOString(),
  }
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(Math.ceil(milliseconds / 1000), 0)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function formatRestaurantPackaging(errand: Pick<Errand, 'packaging' | 'restaurantTakeawayCount' | 'restaurantPeopleCount'>) {
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

function formatAcceptedErrandDescription(errand: Errand) {
  const description = errand.description?.trim() || 'Task'

  if (errand.taskType !== 'restaurant') {
    return description
  }

  return `${description} - Packaging: ${formatRestaurantPackaging(errand)}`
}

export default function TaskerDashboardPage() {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const [errands, setErrands] = useState<Errand[]>([])
  const [acceptedErrands, setAcceptedErrands] = useState<Errand[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [newTaskAlert, setNewTaskAlert] = useState(false)
  const [taskerProfile, setTaskerProfile] = useState<TaskerData | null>(null)
  const [loadingTaskerProfile, setLoadingTaskerProfile] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const fetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const queuedInitialRef = useRef(false)
  const prevErrandsCount = useRef(0)
  const alertTimeoutRef = useRef<number | null>(null)
  const refreshTimeoutRef = useRef<number | null>(null)
  const loadDashboardRef = useRef<
    (initial?: boolean, options?: { silent?: boolean }) => Promise<void>
  >(async () => {})

  const taskerId = session?.user?.taskerId ? String(session.user.taskerId) : null
  const taskerName = session?.user?.name || 'Anonymous'

  useVisibleInterval(() => setNowMs(Date.now()), acceptedErrands.length > 0 ? 1000 : null)

  const triggerNewTaskAlert = useCallback(() => {
    setNewTaskAlert(true)

    if (alertTimeoutRef.current) {
      window.clearTimeout(alertTimeoutRef.current)
    }

    alertTimeoutRef.current = window.setTimeout(() => {
      setNewTaskAlert(false)
      alertTimeoutRef.current = null
    }, 3000)
  }, [])

  useEffect(() => {
    if (sessionPending) {
      return
    }

    if (!session?.user?.id) {
      router.push('/auth')
      return
    }

    if (!taskerId) {
      setTaskerProfile(null)
      setLoadingTaskerProfile(false)
      setErrands([])
      setAcceptedErrands([])
      setError('Tasker profile not found for this account.')
      return
    }

    let cancelled = false

    const loadTaskerProfile = async () => {
      try {
        setLoadingTaskerProfile(true)
        const taskerRes = await fetchWithSocketPause(`/api/taskers?taskerId=${taskerId}&basic=true`, {
          cache: 'no-store',
        })

        if (!taskerRes.ok) {
          throw new Error('Failed to load your tasker profile.')
        }

        const { tasker }: { tasker: TaskerData } = await taskerRes.json()

        if (!cancelled) {
          setTaskerProfile(tasker)
          setError(
            !tasker?.isVerified
              ? 'Your account is awaiting verification.'
              : tasker?.isSettlementSuspended
                ? 'Your tasker account is temporarily suspended until overdue platform settlements are paid.'
                : null
          )
        }
      } catch (profileError) {
        console.error('Failed to load tasker profile', profileError)
        if (!cancelled) {
          setTaskerProfile(null)
          setErrands([])
          setAcceptedErrands([])
          setError('Failed to load your tasker profile.')
        }
      } finally {
        if (!cancelled) {
          setLoadingTaskerProfile(false)
        }
      }
    }

    void loadTaskerProfile()

    return () => {
      cancelled = true
    }
  }, [router, session?.user?.id, sessionPending, taskerId])

  const loadDashboard = useCallback(
    async (initial = false, options?: { silent?: boolean }) => {
      const silent = options?.silent === true

      if (sessionPending || loadingTaskerProfile) {
        return
      }

      if (!session?.user?.id) {
        router.push('/auth')
        return
      }

      if (!taskerId) {
        setErrands([])
        setAcceptedErrands([])
        setError('Tasker profile not found for this account.')
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (!taskerProfile) {
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (!taskerProfile.isVerified) {
        setErrands([])
        setAcceptedErrands([])
        setError('Your account is awaiting verification.')
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (taskerProfile.isSettlementSuspended) {
        setErrands([])
        setAcceptedErrands([])
        setError(
          'Your tasker account is temporarily suspended until overdue platform settlements are paid.'
        )
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (fetchingRef.current) {
        queuedRefreshRef.current = true
        queuedInitialRef.current = queuedInitialRef.current || initial
        return
      }

      fetchingRef.current = true

      if (initial) {
        setLoading(true)
      } else if (!silent) {
        setRefreshing(true)
      }

      try {
        const params = new URLSearchParams()
        if (taskTypeFilter !== 'all') params.append('taskType', taskTypeFilter)
        if (locationFilter.trim()) params.append('location', locationFilter.trim())
        params.append('available', 'true')
        params.append('taskerId', taskerProfile._id)
        params.append('fast', 'true')
        params.append('limit', '80')

        const availableRes = await fetch(`/api/errands?${params.toString()}`, {
          cache: 'no-store',
        })

        if (!availableRes.ok) {
          throw new Error('Failed to load errands')
        }

        const availableErrands: Errand[] = await availableRes.json()

        const visibleAvailableErrands = availableErrands.filter(
          (errand) => String(errand.taskerId || '') !== taskerProfile._id
        )

        if (!initial && visibleAvailableErrands.length > prevErrandsCount.current) {
          triggerNewTaskAlert()
        }
        prevErrandsCount.current = visibleAvailableErrands.length

        setErrands(sortErrands(visibleAvailableErrands))
        setError(null)

        if (initial) {
          setLoading(false)
        }

        try {
          const acceptedRes = await fetch(
            `/api/errands?accepted=true&taskerId=${taskerProfile._id}&fast=true&limit=40`,
            {
              cache: 'no-store',
            }
          )

          if (!acceptedRes.ok) {
            throw new Error('Failed to load active errands')
          }

          const acceptedErrands: Errand[] = await acceptedRes.json()
          setAcceptedErrands(sortErrands(acceptedErrands))
        } catch (activeErrandsError) {
          console.warn('Failed to load active tasker errands', activeErrandsError)
        }
      } catch (dashboardError) {
        console.error('Failed to load tasker dashboard', dashboardError)
        setError('Failed to load errands. Please try again.')
      } finally {
        fetchingRef.current = false
        setLoading(false)
        setRefreshing(false)

        if (queuedRefreshRef.current) {
          const nextInitial = queuedInitialRef.current
          queuedRefreshRef.current = false
          queuedInitialRef.current = false
          void loadDashboard(nextInitial)
        }
      }
    },
    [
      loadingTaskerProfile,
      locationFilter,
      router,
      session?.user?.id,
      sessionPending,
      taskerId,
      taskerProfile,
      taskTypeFilter,
      triggerNewTaskAlert,
    ]
  )

  useEffect(() => {
    loadDashboardRef.current = loadDashboard
  }, [loadDashboard])

  const scheduleDashboardRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      window.clearTimeout(refreshTimeoutRef.current)
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null
      void loadDashboardRef.current(false, { silent: true })
    }, REALTIME_REVALIDATE_DELAY_MS)
  }, [])

  useEffect(() => {
    if (sessionPending || loadingTaskerProfile) {
      return
    }

    void loadDashboard(true)

    const handleFocus = () => void loadDashboard(false)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadDashboard, loadingTaskerProfile, sessionPending])

  useEffect(() => {
    if (sessionPending || loadingTaskerProfile || !taskerProfile?._id) {
      return
    }

    const socket = acquireSharedSocket()
    const handleConnect = () => {
      socket.emit('tasks:watch', { taskerMode: taskerProfile.taskerMode || 'live' })
      void loadDashboardRef.current(false)
    }
    const handleConnectError = () => {
      scheduleDashboardRefresh()
    }
    const handleTaskUpdate = (payload?: RealtimeTaskPayload) => {
      if (payload) {
        const payloadTaskerId = String(payload.taskerId || '')
        const belongsToCurrentTasker = payloadTaskerId === taskerProfile._id
        const isActiveForCurrentTasker =
          belongsToCurrentTasker &&
          (payload.status === 'in_progress' || payload.status === 'paid')
        const isPendingAvailable =
          payload.status === 'pending' &&
          !payload.taskerId
        const isBeingFulfilled =
          payload.status === 'in_progress' &&
          payloadTaskerId !== taskerProfile._id
        const payloadMatchesMode =
          taskerProfile.taskerMode === 'training'
            ? payload.isTestOrder === true
            : payload.isTestOrder !== true
        const shouldShow =
          payloadMatchesMode &&
          (isPendingAvailable || isBeingFulfilled) &&
          matchesRealtimeFilters(payload, taskTypeFilter, locationFilter)

        if (isPendingAvailable && shouldShow) {
          triggerNewTaskAlert()
        }

        setErrands((previous) => {
          const currentIndex = previous.findIndex((item) => item._id === payload._id)

          if (!shouldShow) {
            if (currentIndex === -1) {
              prevErrandsCount.current = previous.length
              return previous
            }

            const next = previous.filter((item) => item._id !== payload._id)
            prevErrandsCount.current = next.length
            return next
          }

          const nextErrand = toErrand(payload)

          if (currentIndex === -1) {
            const next = sortErrands([nextErrand, ...previous])
            prevErrandsCount.current = next.length
            return next
          }

          const next = [...previous]
          next[currentIndex] = { ...next[currentIndex], ...nextErrand }
          const sorted = sortErrands(next)
          prevErrandsCount.current = sorted.length
          return sorted
        })

        setAcceptedErrands((previous) => {
          const currentIndex = previous.findIndex((item) => item._id === payload._id)

          if (!isActiveForCurrentTasker) {
            if (currentIndex === -1) {
              return previous
            }

            return previous.filter((item) => item._id !== payload._id)
          }

          const nextErrand = toErrand(payload)

          if (currentIndex === -1) {
            return sortErrands([nextErrand, ...previous])
          }

          const next = [...previous]
          next[currentIndex] = { ...next[currentIndex], ...nextErrand }
          return sortErrands(next)
        })

        scheduleDashboardRefresh()
        return
      }

      if (!payload) {
        scheduleDashboardRefresh()
      }
    }

    socket.on('connect', handleConnect)
    socket.on('connect_error', handleConnectError)
    socket.on('tasks:updated', handleTaskUpdate)
    handleConnect()

    return () => {
      if (socket.connected) {
        socket.emit('tasks:unwatch')
      }
      socket.off('connect', handleConnect)
      socket.off('connect_error', handleConnectError)
      socket.off('tasks:updated', handleTaskUpdate)
      releaseSharedSocket(socket)
    }
  }, [
    loadingTaskerProfile,
    locationFilter,
    router,
    scheduleDashboardRefresh,
    sessionPending,
    taskTypeFilter,
    taskerProfile?._id,
    taskerProfile?.taskerMode,
    triggerNewTaskAlert,
  ])

  const shouldPollForTasks =
    !sessionPending &&
    !loadingTaskerProfile &&
    Boolean(taskerProfile?._id) &&
    Boolean(taskerProfile?.isVerified) &&
    !taskerProfile?.isSettlementSuspended

  useVisibleInterval(
    () => void loadDashboardRef.current(false, { silent: true }),
    shouldPollForTasks ? REALTIME_POLL_INTERVAL_MS : null
  )

  useEffect(() => {
    return () => {
      if (alertTimeoutRef.current) {
        window.clearTimeout(alertTimeoutRef.current)
      }

      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  const handleAcceptErrand = async (errandId: string) => {
    try {
      setSubmitting(errandId)

      if (!session?.user?.id) {
        setError('User not authenticated')
        return
      }

      const response = await fetchWithSocketPause('/api/errands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: errandId,
          taskerName,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.error || 'Failed to accept errand')
        return
      }

      toast.success('Task accepted. It is now in your active tasks.')
      if (payload.serviceFeeDiscountApplied && payload.serviceFeeDiscountGrantedByPhone) {
        toast('Customer discount active', {
          description: `This customer has a service fee discount. Reach out to ${payload.serviceFeeDiscountGrantedByPhone} to collect your commission${
            payload.discountCommissionAmount ? ` of ${convertToNaira(payload.discountCommissionAmount)}` : ''
          }.`,
        })
      }
      setAcceptedErrands((previous) =>
        sortErrands([payload, ...previous.filter((errand) => errand._id !== payload._id)])
      )
      setErrands((previous) => previous.filter((errand) => errand._id !== payload._id))
      router.push(`/tasker-dashboard/${payload._id}`)
    } catch (acceptError) {
      console.error('Error accepting errand:', acceptError)
      setError('Failed to accept errand')
    } finally {
      setSubmitting(null)
    }
  }

  const formatTimeAgo = (date: string) => {
    const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000)
    if (hours < 1) return 'Just now'
    if (hours === 1) return '1h ago'
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatDueDate = (errand: Errand) => {
    const value = errand.dueDate || errand.deadline || errand.deadlineDate
    if (!value) return null

    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  }

  const getTaskerEarning = (errand: Errand) =>
    errand.serviceFeeDiscountApplied
      ? Number(errand.discountCommissionAmount || errand.taskerFee || 0)
      : Number(errand.taskerFee || 0)

  const getActiveTaskState = (errand: Errand) => {
    if (errand.isDeclinedTask) {
      return {
        label: 'Review',
        description: 'Transfer issue reported',
        className: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60',
      }
    }

    if (errand.status === 'paid' || errand.hasPaid) {
      return {
        label: 'Ready',
        description: 'Payment confirmed',
        className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60',
      }
    }

    if (errand.status === 'in_progress') {
      return {
        label: 'Being fulfilled',
        description: 'Errand is being fulfilled',
        className: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60',
      }
    }

    return {
      label: 'Waiting',
      description: 'Awaiting transfer confirmation',
      className: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/60',
    }
  }

  const getCompletionTimerState = (errand: Errand) => {
    if (!errand.hasPaid && errand.status !== 'paid') {
      return {
        label: 'Timer starts after payment',
        detail: 'Waiting for customer to tap "I\'ve paid"',
        progress: 0,
        className:
          'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100',
        barClassName: 'bg-sky-500',
      }
    }

    const startedMs = errand.completionTimerStartedAt
      ? new Date(errand.completionTimerStartedAt).getTime()
      : new Date(errand.createdAt).getTime()

    if (!Number.isFinite(startedMs)) {
      return null
    }

    const windowMinutes =
      Number(errand.completionWindowMinutes || 0) > 0
        ? Math.max(
          Number(errand.completionWindowMinutes),
          getCompletionWindowMinutes(errand.location, errand.taskType)
        )
        : getCompletionWindowMinutes(errand.location, errand.taskType)
    const extensionMinutes = Number(errand.completionExtensionMinutes || 0)
    const computedDueMs = startedMs + (windowMinutes + extensionMinutes) * 60000
    const savedDueMs = errand.completionDueAt
      ? new Date(errand.completionDueAt).getTime()
      : NaN
    const dueMs =
      Number.isFinite(savedDueMs) && Number.isFinite(computedDueMs)
        ? Math.max(savedDueMs, computedDueMs)
        : Number.isFinite(savedDueMs)
          ? savedDueMs
          : computedDueMs
    const baseWindowMs =
      windowMinutes > 0 ? windowMinutes * 60000 : dueMs - startedMs
    const remainingMs = dueMs - nowMs
    const isExpired = remainingMs <= 0
    const progress =
      baseWindowMs > 0 && Number.isFinite(startedMs)
        ? Math.min(100, Math.max(0, ((nowMs - startedMs) / baseWindowMs) * 100))
        : 0

    if (errand.status === 'completed') {
      if (errand.prematureCompletionReported) {
        return {
          label: 'Customer reported not received',
          detail: 'Platform fee remains payable while SwiftDU reviews it.',
          progress: 100,
          className:
            'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100',
          barClassName: 'bg-rose-500',
        }
      }

      return {
        label: errand.platformFeeWaivedForFastCompletion
          ? 'Completed in time'
          : 'Completed after timer',
        detail: errand.platformFeeWaivedForFastCompletion
          ? 'Platform settlement waived unless the customer reports an issue.'
          : 'Normal platform settlement applies.',
        progress: 100,
        className: errand.platformFeeWaivedForFastCompletion
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100',
        barClassName: errand.platformFeeWaivedForFastCompletion ? 'bg-emerald-500' : 'bg-amber-500',
      }
    }

    return {
      label: isExpired ? 'Timer expired' : `${formatDuration(remainingMs)} left`,
      detail: isExpired
        ? 'Customer can add 10 minutes from their tracking page.'
        : `${windowMinutes}${
            extensionMinutes ? ` + ${extensionMinutes}` : ''
          } min completion window`,
      progress: isExpired ? 100 : progress,
      className: isExpired
        ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
        : 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100',
      barClassName: isExpired ? 'bg-amber-500' : 'bg-sky-500',
    }
  }

  const paymentReadyCount = acceptedErrands.filter(
    (errand) => errand.status === 'paid' || errand.hasPaid
  ).length
  const fulfillingCount = acceptedErrands.filter(
    (errand) => errand.status === 'in_progress' && !errand.hasPaid
  ).length

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-sky-200/50 dark:shadow-slate-950/50 p-8 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="relative mb-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-white" />
                </div>
                <motion.div
                  variants={pulseVariants}
                  animate="pulse"
                  className="absolute inset-0 rounded-2xl bg-sky-500/30 blur-xl"
                />
              </motion.div>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Loading Tasks
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Finding available errands and your active tasks
              </p>

              {/* Progress dots */}
              <div className="flex gap-2 mt-6">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-sky-500"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 1, 0.3],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-28 md:pb-12">
      {/* New Task Notification */}
      <AnimatePresence>
        {newTaskAlert && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-4 right-4 z-50"
          >
            <div className="bg-emerald-500 text-white px-4 py-3 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center gap-3">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                <Sparkles className="h-5 w-5" />
              </motion.div>
              <span className="font-medium text-sm">New task available!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        className="sticky border-b border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/80 lg:top-0"
      >
        <div className="px-4 py-2 md:py-4">
          <div className="flex items-center justify-between gap-3 md:gap-4">
            <div className="flex-1 min-w-0">
              <motion.h1 
                className="text-lg font-bold text-slate-900 dark:text-white md:text-xl"
                layoutId="header-title"
              >
                Tasker Dashboard
              </motion.h1>
              <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 md:text-sm">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {acceptedErrands.length} active, {errands.length} open
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilters(!showFilters)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors md:h-11 md:w-11 md:rounded-2xl ${
                  showFilters
                    ? 'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                <Filter className="h-5 w-5" />
                {(taskTypeFilter !== 'all' || locationFilter) && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"
                  />
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => void loadDashboard(false)}
                disabled={refreshing}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 md:h-11 md:w-11 md:rounded-2xl"
              >
                <motion.div
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }}
                >
                  <RefreshCw className="h-5 w-5" />
                </motion.div>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Expandable Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              variants={filterVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
            >
              <div className="space-y-3 p-3 md:space-y-4 md:p-4">
                {/* Task Type Pills */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 block">
                    Task Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {taskTypes.map((type) => {
                      const Icon = type.icon
                      const isActive = taskTypeFilter === type.value
                      return (
                        <motion.button
                          key={type.value}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setTaskTypeFilter(type.value)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg shadow-slate-900/20'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {type.label}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>

                {/* Location Search */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                    Location
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search area..."
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="pl-10 h-11 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    {locationFilter && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        onClick={() => setLocationFilter('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="h-4 w-4 text-slate-400" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 xl:px-8">
        {taskerProfile?.taskerMode === 'training' ? (
          <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-100">
            <p className="font-bold">You are in Training Mode. You can only see and handle test orders.</p>
          </div>
        ) : null}

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="mb-4"
            >
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900 dark:text-red-200">
                    {error}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {acceptedErrands.length > 0 ? (
          <section className="mb-6">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Active Tasks
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {fulfillingCount} being fulfilled, {paymentReadyCount} ready to complete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadDashboard(false)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {acceptedErrands.map((errand) => {
                const state = getActiveTaskState(errand)
                const timerState = getCompletionTimerState(errand)

                return (
                  <article
                    key={errand._id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className={`h-1.5 bg-linear-to-r ${taskTypeStyles[errand.taskType] || taskTypeStyles.others}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${state.className}`}>
                              {state.label}
                            </span>
                            {errand.isTestOrder ? (
                              <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60">
                                Test
                              </span>
                            ) : null}
                            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${taskTypeBg[errand.taskType] || taskTypeBg.others}`}>
                              {errand.taskType}
                            </span>
                          </div>
                          <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-900 dark:text-white">
                            {formatAcceptedErrandDescription(errand)}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {state.description}
                          </p>
                        </div>

                        <div className="shrink-0 rounded-2xl bg-emerald-50 px-3 py-2 text-right dark:bg-emerald-950/40">
                          <p className="text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                            Earn
                          </p>
                          <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                            {convertToNaira(getTaskerEarning(errand))}
                          </p>
                        </div>
                      </div>

                      {errand.serviceFeeDiscountApplied && errand.serviceFeeDiscountGrantedByPhone ? (
                        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                          <div className="flex gap-2">
                            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                            <p>
                              This customer has a discount. Reach out to {errand.serviceFeeDiscountGrantedByPhone} to collect your commission
                              {errand.discountCommissionAmount ? ` of ${convertToNaira(errand.discountCommissionAmount)}` : ''}.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
                          <span className="truncate">{errand.location}</span>
                        </div>
                        {errand.taskType === 'indomie' ? (
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0 text-rose-500" />
                            <span>
                              {errand.indomiePacks || 0} indomie, {errand.eggCount || 0} egg{Number(errand.eggCount || 0) === 1 ? '' : 's'}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                          <span>{errand.acceptedAt ? `Accepted ${formatTimeAgo(errand.acceptedAt)}` : formatTimeAgo(errand.createdAt)}</span>
                        </div>
                        {formatDueDate(errand) ? (
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 shrink-0 text-amber-500" />
                            <span>Due {formatDueDate(errand)}</span>
                          </div>
                        ) : null}
                      </div>

                      {timerState ? (
                        <div className={`mt-4 rounded-2xl border px-4 py-3 ${timerState.className}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-bold">
                                <Clock3 className="h-4 w-4 shrink-0" />
                                <span className="truncate">{timerState.label}</span>
                              </p>
                              <p className="mt-1 text-xs leading-5 opacity-80">{timerState.detail}</p>
                            </div>
                            {errand.completionDueAt ? (
                              <span className="shrink-0 rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide dark:bg-slate-900/70">
                                Timing
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-slate-900/80">
                            <div
                              className={`h-full rounded-full ${timerState.barClassName}`}
                              style={{ width: `${timerState.progress}%` }}
                            />
                          </div>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => router.push(`/tasker-dashboard/${errand._id}`)}
                        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      >
                        Open task
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}

        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Open Tasks
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Accept open tasks or see errands already being fulfilled.
            </p>
          </div>
        </div>
        
        {/* Empty State */}
        {errands.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-[2rem] border border-slate-200/70 bg-white/70 px-6 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/40"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-6"
            >
              <Search className="h-10 w-10 text-slate-400" />
            </motion.div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No tasks available
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Try adjusting your filters or check back soon. New tasks appear automatically.
            </p>
          </motion.div>
        ) : (
          <motion.div
            layout
            className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
          >
            {errands.map((errand) => (
              <motion.article
                key={errand._id}
                layout
                initial={{ opacity: 1, y: 0, scale: 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative z-10 h-full overflow-hidden rounded-3xl border border-slate-200 bg-white opacity-100 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Top accent bar */}
                <div className={`h-1.5 bg-linear-to-r ${taskTypeStyles[errand.taskType] || taskTypeStyles.others}`} />

                <div className="p-4">
                  {/* Header: Type & Time */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${taskTypeBg[errand.taskType] || taskTypeBg.others}`}>
                      {errand.taskType}
                    </span>
                    {errand.status !== 'pending' ? (
                      <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60">
                        Being fulfilled
                      </span>
                    ) : null}
                    {errand.isTestOrder ? (
                      <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60">
                        Test
                      </span>
                    ) : null}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock3 className="h-3 w-3" />
                      {formatTimeAgo(errand.createdAt)}
                    </span>
                  </div>

                  {/* Earnings Badge - Most Important for Taskers */}
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      className="flex-1 sm:max-w-md bg-linear-to-r from-emerald-500 to-teal-500 rounded-2xl p-3 text-white shadow-lg shadow-emerald-500/20"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="h-4 w-4 opacity-80" />
                        <span className="text-xs font-medium opacity-90">You Earn</span>
                      </div>
                      <p className="text-2xl font-bold">
                        {convertToNaira(getTaskerEarning(errand))}
                      </p>
                    </motion.div>
                    
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center min-w-20">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Budget</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {convertToNaira(errand.amount)}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4 line-clamp-2">
                    {errand.description}
                  </p>

                  {errand.serviceFeeDiscountApplied && errand.serviceFeeDiscountGrantedByPhone ? (
                    <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                      <div className="flex gap-2">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                        <p>
                          Customer discount. If you accept, reach out to {errand.serviceFeeDiscountGrantedByPhone} to collect your commission
                          {errand.discountCommissionAmount ? ` of ${convertToNaira(errand.discountCommissionAmount)}` : ''}.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Location & Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <span className="truncate">{errand.location}</span>
                    </div>

                    {errand.store && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                          <Store className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="truncate">{errand.store}</span>
                      </motion.div>
                    )}

                    {errand.packaging && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="capitalize">{errand.packaging}</span>
                      </motion.div>
                    )}

                    {errand.taskType === 'indomie' ? (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
                          <Package className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <span>
                          {errand.indomiePacks || 0} indomie, {errand.eggCount || 0} egg{Number(errand.eggCount || 0) === 1 ? '' : 's'}
                        </span>
                      </motion.div>
                    ) : null}

                    {errand.taskType === 'restaurant' && Number(errand.restaurantPeopleCount || 0) > 1 ? (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.12 }}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
                      >
                        <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                          <Info className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                        <span>
                          {errand.restaurantPeopleCount} people order: {convertToNaira(calculateRestaurantServiceFee(errand.restaurantPeopleCount))}
                        </span>
                      </motion.div>
                    ) : null}

                    {formatDueDate(errand) ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                          <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span>Due {formatDueDate(errand)}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Accept Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAcceptErrand(errand._id)}
                    disabled={submitting === errand._id || errand.status !== 'pending'}
                    className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20 dark:shadow-white/20"
                  >
                    {errand.status !== 'pending' ? (
                      <>
                        <Clock3 className="h-5 w-5" />
                        Being fulfilled
                      </>
                    ) : submitting === errand._id ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        Accept Task
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </motion.button>
                </div>

                {/* Hover glow effect */}
                <motion.div
                  className="absolute inset-0 bg-linear-to-r from-sky-500/0 via-sky-500/5 to-sky-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                  initial={false}
                />
              </motion.article>
            ))}
          </motion.div>
        )}
      </div>

      {/* Floating Status Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/90 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 md:bottom-6 md:left-auto md:right-6 md:w-[22rem] md:rounded-3xl md:border"
      >
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-500"
            />
            Live updates active
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {taskerProfile?.isSettlementSuspended
              ? 'Settlement Hold'
              : 'Verified Tasker'}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
