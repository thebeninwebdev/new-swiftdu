'use client'
import { type CafeInquiryFields } from '@/lib/cafe-inquiry'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskerHome } from '@/components/tasker/TaskerHome'
import { useTaskerWork } from '@/components/tasker/WorkProvider'
import { authClient } from '@/lib/auth-client'
import { acquireSharedSocket, fetchWithSocketPause, releaseSharedSocket } from '@/lib/client-socket'
import { useVisibleInterval } from '@/hooks/use-visible-interval'
import { Building2, CheckCircle2, ShieldCheck } from 'lucide-react'

const REALTIME_REVALIDATE_DELAY_MS = 1200
const REALTIME_POLL_INTERVAL_MS = 10000

interface Errand extends CafeInquiryFields {
  cafeInquiry?: boolean
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
  bankDetails?: {
    bankName?: string
    accountNumber?: string
    accountName?: string
  }
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

export default function TaskerDashboardPage() {
  const router = useRouter()
  const work = useTaskerWork()
  const { data: session, isPending: sessionPending } = authClient.useSession()

  const [errands, setErrands] = useState<Errand[]>([])
  const [acceptedErrands, setAcceptedErrands] = useState<Errand[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [newTaskAlert, setNewTaskAlert] = useState(false)
  const [taskerProfile, setTaskerProfile] = useState<TaskerData | null>(null)
  const [loadingTaskerProfile, setLoadingTaskerProfile] = useState(true)
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountNumber: '', accountName: '' })
  const [savingBankDetails, setSavingBankDetails] = useState(false)
  const [bankDetailsError, setBankDetailsError] = useState<string | null>(null)

  const fetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const queuedInitialRef = useRef(false)
  const prevErrandsCount = useRef(0)
  const alertTimeoutRef = useRef<number | null>(null)
  const refreshTimeoutRef = useRef<number | null>(null)
  const loadDashboardRef = useRef<
    (initial?: boolean, options?: { silent?: boolean }) => Promise<void>
  >(async () => {})

  const taskerName = session?.user?.name || 'Anonymous'
  const needsBankDetails = Boolean(taskerProfile && !taskerProfile.bankDetails?.accountNumber)


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

    let cancelled = false

    const loadTaskerProfile = async () => {
      try {
        setLoadingTaskerProfile(true)
        const taskerRes = await fetchWithSocketPause('/api/taskers/me', {
          cache: 'no-store',
        })

        const payload = await taskerRes.json()
        if (!taskerRes.ok) {
          throw new Error(payload.error || 'Failed to load your tasker profile.')
        }

        const { tasker }: { tasker: TaskerData } = payload

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
          setError(profileError instanceof Error ? profileError.message : 'Failed to load your tasker profile.')
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
  }, [router, session?.user?.id, sessionPending])

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

      if (!taskerProfile) {
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (!taskerProfile.bankDetails?.accountNumber) {
        setErrands([])
        setAcceptedErrands([])
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

        const availableRes = work.data?.checkedIn ? await fetch(`/api/errands?${params.toString()}`, {
          cache: 'no-store',
        }) : null

        if (availableRes && !availableRes.ok) {
          throw new Error('Failed to load errands')
        }

        const availableErrands: Errand[] = availableRes ? await availableRes.json() : []

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
      work.data?.checkedIn,
      locationFilter,
      router,
      session?.user?.id,
      sessionPending,
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
    if (sessionPending || loadingTaskerProfile || needsBankDetails || !taskerProfile?._id) {
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

        if (work.data?.checkedIn && isPendingAvailable && shouldShow) {
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
    needsBankDetails,
    router,
    scheduleDashboardRefresh,
    sessionPending,
    taskTypeFilter,
    taskerProfile?._id,
    taskerProfile?.taskerMode,
    triggerNewTaskAlert,
    work.data?.checkedIn,
  ])

  const shouldPollForTasks =
    !sessionPending &&
    !loadingTaskerProfile &&
    !needsBankDetails &&
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

  const saveBankDetails = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSavingBankDetails(true)
    setBankDetailsError(null)
    try {
      const response = await fetch('/api/taskers/me/bank-details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankDetails),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save your bank details.')
      setTaskerProfile((current) => current ? { ...current, bankDetails: payload.bankDetails } : current)
    } catch (saveError) {
      setBankDetailsError(saveError instanceof Error ? saveError.message : 'Could not save your bank details.')
    } finally {
      setSavingBankDetails(false)
    }
  }

  if (!loadingTaskerProfile && needsBankDetails) {
    return <div className="min-h-screen bg-[#faf9ff] px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100"><div className="mx-auto flex max-w-md items-center gap-2 px-1 text-xl font-black tracking-tight text-violet-700 dark:text-violet-300">SwiftDU <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Tasker</span></div><div className="mx-auto mt-7 w-full max-w-md"><div role="dialog" aria-modal="true" aria-labelledby="bank-details-title" className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="bg-violet-50 px-6 pb-5 pt-6 dark:bg-violet-950/30"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-500/25"><Building2 className="h-6 w-6" /></div><p className="mt-5 text-sm font-bold text-violet-700 dark:text-violet-300">Before you start</p><h1 id="bank-details-title" className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">Add the account for your earnings</h1><p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">Customers will use these details when they pay you for a task.</p></div><div className="p-6"><div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100"><ShieldCheck className="h-5 w-5 shrink-0" /><p><span className="font-bold">Your details are private.</span> Only use an account in your own name.</p></div><form onSubmit={saveBankDetails} className="space-y-5"><label className="block text-sm font-bold">Your bank<input required autoComplete="off" value={bankDetails.bankName} onChange={(event) => setBankDetails((current) => ({ ...current, bankName: event.target.value }))} placeholder="For example: GTBank" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-medium outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950" /></label><label className="block text-sm font-bold">Your 10-digit account number<div className="relative mt-2"><input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="off" value={bankDetails.accountNumber} onChange={(event) => setBankDetails((current) => ({ ...current, accountNumber: event.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="0123456789" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-16 text-base font-semibold tracking-[0.12em] outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950" /><span className="absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-slate-400">{bankDetails.accountNumber.length}/10</span></div></label><label className="block text-sm font-bold">Name on this account<input required autoComplete="name" value={bankDetails.accountName} onChange={(event) => setBankDetails((current) => ({ ...current, accountName: event.target.value }))} placeholder="Enter your full name" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base font-medium outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-violet-950" /></label>{bankDetailsError && <p role="alert" className="rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">{bankDetailsError}</p>}<button type="submit" disabled={savingBankDetails} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-60">{savingBankDetails ? 'Saving your account…' : <>Save and continue <CheckCircle2 className="h-5 w-5" /></>}</button></form><p className="mt-5 text-center text-xs leading-5 text-slate-500">Please double-check your account number before saving.</p></div></div></div></div>
  }

  return <TaskerHome name={taskerName} errands={errands} accepted={acceptedErrands} loading={loading} refreshing={refreshing} error={error} newTaskAlert={newTaskAlert} refresh={() => void loadDashboard(false)} taskType={taskTypeFilter} setTaskType={setTaskTypeFilter} location={locationFilter} setLocation={setLocationFilter} />
}
