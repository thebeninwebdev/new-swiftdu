'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

import { authClient } from '@/lib/auth-client'
import { convertToNaira } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DASHBOARD_REFRESH_MS = 5000

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
  deadlineValue: number
  deadlineUnit: string
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
}

const taskTypes = [
  { value: 'all', label: 'All Tasks' },
  { value: 'restaurant', label: 'Food Delivery' },
  { value: 'printing', label: 'Printing' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'others', label: 'Other Errands' },
]

const taskTypeStyles: Record<string, string> = {
  restaurant: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
  printing: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  shopping: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  others: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
}

const formatTaskType = (type: string) =>
  taskTypes.find((taskType) => taskType.value === type)?.label || type

const formatDeadline = (value: number, unit: string) => `${value} ${unit}`

export default function TaskerDashboardPage() {
  const router = useRouter()

  const [errands, setErrands] = useState<Errand[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [redirectingOrderId, setRedirectingOrderId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const fetchingRef = useRef(false)

  const loadDashboard = useCallback(
    async (initial = false) => {
      if (fetchingRef.current) {
        return
      }

      fetchingRef.current = true

      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        const { data } = await authClient.getSession()

        if (!data?.user?.id) {
          router.push('/login')
          return
        }

        const taskerId =
          data.user.taskerId === null || data.user.taskerId === undefined
            ? undefined
            : String(data.user.taskerId)

        if (!taskerId) {
          setError('Tasker profile not found for this account.')
          setErrands([])
          return
        }

        const taskerRes = await fetch(`/api/taskers?taskerId=${taskerId}`)
        if (!taskerRes.ok) {
          setError('Failed to load your tasker profile.')
          setErrands([])
          return
        }

        const { tasker }: { tasker: TaskerData } = await taskerRes.json()

        if (!tasker?.isVerified) {
          setError(
            'Your tasker account is still awaiting verification. You can browse this dashboard once verification is complete.'
          )
          setErrands([])
          return
        }

        const params = new URLSearchParams()
        if (taskTypeFilter !== 'all') {
          params.append('taskType', taskTypeFilter)
        }
        if (locationFilter.trim()) {
          params.append('location', locationFilter.trim())
        }
        params.append('status', 'pending')

        const [availableRes, acceptedRes] = await Promise.all([
          fetch(`/api/errands?${params.toString()}`),
          fetch(`/api/errands?accepted=true&taskerId=${tasker._id}`),
        ])

        if (!availableRes.ok || !acceptedRes.ok) {
          throw new Error('Failed to load errands')
        }

        const [availableErrands, acceptedErrands]: [Errand[], Errand[]] = await Promise.all([
          availableRes.json(),
          acceptedRes.json(),
        ])

        if (acceptedErrands.length > 0) {
          const activeErrand = acceptedErrands[0]
          setRedirectingOrderId(activeErrand._id)
          router.replace(`/tasker-dashboard/${activeErrand._id}`)
          return
        }

        setRedirectingOrderId(null)
        setErrands(availableErrands)
        setError(null)
      } catch (dashboardError) {
        console.error('Failed to load tasker dashboard', dashboardError)
        setError('Failed to load errands. Please try again.')
      } finally {
        fetchingRef.current = false
        setLoading(false)
        setRefreshing(false)
      }
    },
    [locationFilter, router, taskTypeFilter]
  )

  useEffect(() => {
    void loadDashboard(true)

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadDashboard(false)
      }
    }, DASHBOARD_REFRESH_MS)

    const handleFocus = () => {
      void loadDashboard(false)
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadDashboard])

  useEffect(() => {
    const socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socket.on('tasks:updated', () => {
      void loadDashboard(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [loadDashboard])

  const handleAcceptErrand = async (errandId: string) => {
    try {
      setSubmitting(errandId)

      const session = await authClient.getSession()
      if (!session?.data?.user?.id) {
        setError('User not authenticated')
        return
      }

      const response = await fetch('/api/errands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: errandId,
          taskerId: session.data.user.id,
          taskerName: session.data.user.name,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.error || 'Failed to accept errand')
        return
      }

      toast.success('Errand accepted. Opening the live task page now.')
      router.replace(`/tasker-dashboard/${payload._id}`)
    } catch (acceptError) {
      console.error('Error accepting errand:', acceptError)
      setError('Failed to accept errand')
    } finally {
      setSubmitting(null)
    }
  }

  if (loading || redirectingOrderId) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {redirectingOrderId ? 'Opening your active task' : 'Loading errands'}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {redirectingOrderId
                    ? 'You already have an accepted task, so we are taking you straight there.'
                    : 'Checking your verification and pulling the latest task list.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:pt-0 pt-10">
      {/* Compact Mobile Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
              Available Tasks
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {errands.length} open {errands.length === 1 ? 'errand' : 'errands'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                showFilters 
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
              aria-label="Toggle filters"
            >
              {showFilters ? <X className="h-5 w-5" /> : <Filter className="h-5 w-5" />}
            </button>
            
            <button
              type="button"
              onClick={() => void loadDashboard(false)}
              disabled={refreshing}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Filters */}
      {showFilters && (
        <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
          <div className="mx-auto max-w-6xl space-y-3">
            <div>
              <label
                htmlFor="task-type-filter"
                className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Task type
              </label>
              <select
                id="task-type-filter"
                value={taskTypeFilter}
                onChange={(event) => setTaskTypeFilter(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {taskTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="location-filter"
                className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Location
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="location-filter"
                  type="text"
                  placeholder="Search location..."
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  className="h-11 rounded-xl border-slate-200 bg-white pl-10 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        <div className="mx-auto max-w-6xl space-y-3">
          
          {/* Error Message */}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {/* Desktop Info Cards - Hidden on mobile */}
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Live updates
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    New tasks appear automatically via socket updates
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Auto-redirect
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Active tasks open automatically
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          {errands.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/85 px-4 py-12 text-center dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Search className="h-5 w-5" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                No errands available
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                Try adjusting filters or check again shortly. New tasks appear automatically.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {errands.map((errand) => (
                <article
                  key={errand._id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Card Header - Compact on mobile */}
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          taskTypeStyles[errand.taskType] || taskTypeStyles.others
                        }`}
                      >
                        {formatTaskType(errand.taskType)}
                      </span>
                      <span className="text-lg font-bold text-sky-700 dark:text-sky-300">
                        {convertToNaira(errand.totalAmount || errand.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-3 p-4">
                    <h3 className="text-base font-semibold leading-snug text-slate-900 dark:text-white">
                      {errand.description}
                    </h3>

                    {/* Info Grid - 2 columns on mobile, more compact */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/70">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Location
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200">
                          <MapPin className="h-3 w-3 shrink-0 text-sky-600" />
                          <span className="truncate">{errand.location}</span>
                        </p>
                      </div>

                      <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/70">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Deadline
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-700 dark:text-slate-200">
                          <Clock3 className="h-3 w-3 shrink-0 text-sky-600" />
                          <span>{formatDeadline(errand.deadlineValue, errand.deadlineUnit)}</span>
                        </p>
                      </div>

                      {errand.store ? (
                        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Store
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-700 dark:text-slate-200">
                            {errand.store}
                          </p>
                        </div>
                      ) : null}

                      {errand.packaging ? (
                        <div className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Packaging
                          </p>
                          <p className="mt-0.5 text-xs capitalize text-slate-700 dark:text-slate-200">
                            {errand.packaging}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <Button
                      onClick={() => handleAcceptErrand(errand._id)}
                      disabled={submitting === errand._id}
                      className="h-11 w-full rounded-xl bg-linear-to-r from-sky-600 to-indigo-600 text-sm font-semibold text-white hover:from-sky-700 hover:to-indigo-700"
                    >
                      {submitting === errand._id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Accepting...
                        </>
                      ) : (
                        <>
                          Accept errand
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}