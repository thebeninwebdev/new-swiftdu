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
} from 'lucide-react'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { acquireSharedSocket, releaseSharedSocket } from '@/lib/client-socket'
import { PREMIUM_TASKER_MIN_BUDGET } from '@/lib/tasker-access'
import { convertToNaira } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const DASHBOARD_REFRESH_MS = 5000
const REALTIME_REVALIDATE_DELAY_MS = 1200

interface Errand {
  _id: string
  userId: string
  taskType: string
  description: string
  amount: number
  commission?: number
  platformFee?: number
  taskerFee?: number
  totalAmount?: number
  requiresPremiumTasker?: boolean
  location: string
  store?: string
  packaging?: string
  status: string
  acceptedBy?: string
  acceptedAt?: string
  createdAt: string
}

interface TaskerData {
  _id: string
  isVerified: boolean
  isPremium: boolean
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
  totalAmount?: number
  requiresPremiumTasker?: boolean
  location?: string
  store?: string
  packaging?: string
  status?: string
  taskerId?: string
  acceptedAt?: string
  createdAt?: string
}

const taskTypes = [
  { value: 'all', label: 'All Tasks', icon: Sparkles, color: 'bg-slate-500' },
  { value: 'restaurant', label: 'Food', icon: Package, color: 'bg-orange-500' },
  { value: 'printing', label: 'Print', icon: Package, color: 'bg-sky-500' },
  { value: 'shopping', label: 'Shop', icon: Package, color: 'bg-emerald-500' },
  { value: 'water', label: 'Water', icon: Package, color: 'bg-cyan-500' },
  { value: 'others', label: 'Other', icon: Package, color: 'bg-slate-500' },
]

const taskTypeStyles: Record<string, string> = {
  restaurant: 'from-orange-500 to-amber-500',
  printing: 'from-sky-500 to-blue-500',
  shopping: 'from-emerald-500 to-teal-500',
  water: 'from-cyan-500 to-blue-500',
  others: 'from-slate-500 to-gray-500',
}

const taskTypeBg: Record<string, string> = {
  restaurant: 'bg-orange-50 text-orange-700 border-orange-200',
  printing: 'bg-sky-50 text-sky-700 border-sky-200',
  shopping: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  water: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  others: 'bg-slate-50 text-slate-700 border-slate-200',
}

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
  exit: {
    opacity: 0,
    x: -100,
    transition: { duration: 0.3 },
  },
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
    totalAmount: payload.totalAmount,
    requiresPremiumTasker: payload.requiresPremiumTasker,
    location: payload.location || '',
    store: payload.store,
    packaging: payload.packaging,
    status: payload.status || 'pending',
    acceptedAt: payload.acceptedAt,
    createdAt: payload.createdAt || new Date().toISOString(),
  }
}

export default function TaskerDashboardPage() {
  const router = useRouter()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const [errands, setErrands] = useState<Errand[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [redirectingOrderId, setRedirectingOrderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [newTaskAlert, setNewTaskAlert] = useState(false)
  const [taskerProfile, setTaskerProfile] = useState<TaskerData | null>(null)
  const [loadingTaskerProfile, setLoadingTaskerProfile] = useState(true)

  const fetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const queuedInitialRef = useRef(false)
  const prevErrandsCount = useRef(0)
  const alertTimeoutRef = useRef<number | null>(null)
  const refreshTimeoutRef = useRef<number | null>(null)
  const loadDashboardRef = useRef<(initial?: boolean) => Promise<void>>(async () => {})

  const taskerUserId = session?.user?.id ? String(session.user.id) : null
  const taskerId = session?.user?.taskerId ? String(session.user.taskerId) : null
  const taskerName = session?.user?.name || 'Anonymous'

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
      router.push('/login')
      return
    }

    if (!taskerId) {
      setTaskerProfile(null)
      setLoadingTaskerProfile(false)
      setErrands([])
      setError('Tasker profile not found for this account.')
      return
    }

    let cancelled = false

    const loadTaskerProfile = async () => {
      try {
        setLoadingTaskerProfile(true)
        const taskerRes = await fetch(`/api/taskers?taskerId=${taskerId}`, {
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
    async (initial = false) => {
      if (sessionPending || loadingTaskerProfile) {
        return
      }

      if (!session?.user?.id) {
        router.push('/login')
        return
      }

      if (!taskerId) {
        setErrands([])
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
        setError('Your account is awaiting verification.')
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (taskerProfile.isSettlementSuspended) {
        setErrands([])
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
      } else {
        setRefreshing(true)
      }

      try {
        const params = new URLSearchParams()
        if (taskTypeFilter !== 'all') params.append('taskType', taskTypeFilter)
        if (locationFilter.trim()) params.append('location', locationFilter.trim())
        params.append('status', 'pending')
        params.append('viewerTaskerId', taskerProfile._id)

        const [availableRes, acceptedRes] = await Promise.all([
          fetch(`/api/errands?${params.toString()}`, {
            cache: 'no-store',
          }),
          fetch(`/api/errands?accepted=true&taskerId=${taskerProfile._id}`, {
            cache: 'no-store',
          }),
        ])

        if (!availableRes.ok || !acceptedRes.ok) {
          throw new Error('Failed to load errands')
        }

        const [availableErrands, acceptedErrands]: [Errand[], Errand[]] = await Promise.all([
          availableRes.json(),
          acceptedRes.json(),
        ])

        if (!initial && availableErrands.length > prevErrandsCount.current) {
          triggerNewTaskAlert()
        }
        prevErrandsCount.current = availableErrands.length

        if (acceptedErrands.length > 0) {
          const activeErrand = acceptedErrands[0]
          setRedirectingOrderId(activeErrand._id)
          router.replace(`/tasker-dashboard/${activeErrand._id}`)
          return
        }

        setRedirectingOrderId(null)
        setErrands(sortErrands(availableErrands))
        setError(null)
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
      void loadDashboardRef.current(false)
    }, REALTIME_REVALIDATE_DELAY_MS)
  }, [])

  useEffect(() => {
    if (sessionPending || loadingTaskerProfile) {
      return
    }

    void loadDashboard(true)

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadDashboard(false)
      }
    }, DASHBOARD_REFRESH_MS)

    const handleFocus = () => void loadDashboard(false)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadDashboard, loadingTaskerProfile, sessionPending])

  useEffect(() => {
    if (sessionPending || loadingTaskerProfile || !taskerProfile?._id) {
      return
    }

    const socket = acquireSharedSocket()
    const handleConnect = () => {
      void loadDashboardRef.current(false)
    }
    const handleTaskUpdate = (payload?: RealtimeTaskPayload) => {
      if (payload?.taskerId && payload.taskerId === taskerProfile._id && payload.status !== 'cancelled') {
        setRedirectingOrderId(payload._id)
        router.replace(`/tasker-dashboard/${payload._id}`)
        return
      }

      if (payload) {
        const shouldShow =
          payload.status === 'pending' &&
          !payload.taskerId &&
          (!payload.requiresPremiumTasker || Boolean(taskerProfile?.isPremium)) &&
          matchesRealtimeFilters(payload, taskTypeFilter, locationFilter)

        if (shouldShow) {
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
      }

      scheduleDashboardRefresh()
    }

    socket.on('connect', handleConnect)
    socket.on('tasks:updated', handleTaskUpdate)
    handleConnect()

    return () => {
      socket.off('connect', handleConnect)
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
    taskerProfile?.isPremium,
    triggerNewTaskAlert,
  ])

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

      if (!taskerUserId) {
        setError('User not authenticated')
        return
      }

      const response = await fetch('/api/errands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: errandId,
          taskerId: taskerUserId,
          taskerName,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.error || 'Failed to accept errand')
        return
      }

      toast.success('Task accepted! Redirecting...')
      router.replace(`/tasker-dashboard/${payload._id}`)
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

  if (loading || redirectingOrderId) {
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
                  {redirectingOrderId ? (
                    <ArrowRight className="h-8 w-8 text-white" />
                  ) : (
                    <Loader2 className="h-8 w-8 text-white" />
                  )}
                </div>
                <motion.div
                  variants={pulseVariants}
                  animate="pulse"
                  className="absolute inset-0 rounded-2xl bg-sky-500/30 blur-xl"
                />
              </motion.div>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {redirectingOrderId ? 'Active Task Found' : 'Loading Tasks'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {redirectingOrderId
                  ? 'Taking you to your current task...'
                  : 'Finding available errands near you'}
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
        className="sticky top-16 z-40 border-b border-slate-200/50 bg-white/80 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/80 lg:top-0"
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <motion.h1 
                className="text-xl font-bold text-slate-900 dark:text-white"
                layoutId="header-title"
              >
                Available Tasks
              </motion.h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>{errands.length} open {errands.length === 1 ? 'task' : 'tasks'}</span>
              </p>
              {!taskerProfile?.isPremium ? (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Orders from {convertToNaira(PREMIUM_TASKER_MIN_BUDGET)} are reserved for premium taskers.
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowFilters(!showFilters)}
                className={`relative h-11 w-11 rounded-2xl flex items-center justify-center transition-colors ${
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
                className="h-11 w-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center disabled:opacity-50"
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
              <div className="p-4 space-y-4">
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
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
          >
            {errands.map((errand) => (
              <motion.article
                key={errand._id}
                variants={cardVariants}
                layoutId={errand._id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Top accent bar */}
                <div className={`h-1.5 bg-linear-to-r ${taskTypeStyles[errand.taskType] || taskTypeStyles.others}`} />

                <div className="p-4">
                  {/* Header: Type & Time */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${taskTypeBg[errand.taskType] || taskTypeBg.others}`}>
                      {errand.taskType}
                    </span>
                    {errand.requiresPremiumTasker ? (
                      <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60">
                        Premium only
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
                        {convertToNaira(errand.taskerFee || 0)}
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
                  </div>

                  {/* Accept Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAcceptErrand(errand._id)}
                    disabled={submitting === errand._id}
                    className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-900/20 dark:shadow-white/20"
                  >
                    {submitting === errand._id ? (
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
              : taskerProfile?.isPremium
                ? 'Premium Tasker'
                : 'Verified Tasker'}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
