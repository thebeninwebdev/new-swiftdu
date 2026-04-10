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
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-1 py-2 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-2 md:px-3">
      <div className="mx-auto max-w-6xl space-y-5 px-2 py-3 sm:px-3 sm:py-4 md:space-y-6 md:px-4">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60">
          <div className="bg-linear-to-r from-sky-600 via-cyan-600 to-indigo-600 px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                  Tasker dashboard
                </p>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                  Browse new errands fast
                </h1>
                <p className="mt-3 text-sm leading-6 text-sky-50 sm:text-base">
                  This page stays focused on available tasks. Once you accept one, we move you
                  straight into its live task page so mobile tracking stays simple.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadDashboard(false)}
                className="inline-flex h-12 items-center justify-center gap-2 self-start rounded-2xl bg-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Live acceptance flow
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    New task postings and task status changes refresh here automatically through
                    socket updates.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Accepted task redirect
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    If you already have an active accepted task, this dashboard automatically opens
                    that task page instead of leaving you on the listing screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 shadow-sm dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <div>
              <label
                htmlFor="task-type-filter"
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Task type
              </label>
              <select
                id="task-type-filter"
                value={taskTypeFilter}
                onChange={(event) => setTaskTypeFilter(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
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
                className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
              >
                Delivery location
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="location-filter"
                  type="text"
                  placeholder="Search by hostel, hall, gate, or building..."
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">
                Available errands
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {errands.length === 0
                  ? 'No open errands match your current filters.'
                  : `${errands.length} open errand${errands.length === 1 ? '' : 's'} ready for pickup.`}
              </p>
            </div>
          </div>

          {errands.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/85 px-5 py-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                No errands available right now
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                Try adjusting your filters or check again shortly. This page refreshes live when new
                tasks come in.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {errands.map((errand) => (
                <article
                  key={errand._id}
                  className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-md shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-slate-950/50"
                >
                  <div className="space-y-5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            taskTypeStyles[errand.taskType] || taskTypeStyles.others
                          }`}
                        >
                          {formatTaskType(errand.taskType)}
                        </span>
                        <h3 className="mt-3 text-lg font-semibold leading-7 text-slate-900 dark:text-white">
                          {errand.description}
                        </h3>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Payout
                        </p>
                        <p className="mt-1 text-xl font-bold text-sky-700 dark:text-sky-300">
                          {convertToNaira(errand.totalAmount || errand.amount)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Location
                        </p>
                        <p className="mt-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                          <span>{errand.location}</span>
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Deadline
                        </p>
                        <p className="mt-2 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                          <span>{formatDeadline(errand.deadlineValue, errand.deadlineUnit)}</span>
                        </p>
                      </div>
                    </div>

                    {errand.store || errand.packaging ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {errand.store ? (
                          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Store
                            </p>
                            <p className="mt-2 text-slate-700 dark:text-slate-200">{errand.store}</p>
                          </div>
                        ) : null}

                        {errand.packaging ? (
                          <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Packaging
                            </p>
                            <p className="mt-2 capitalize text-slate-700 dark:text-slate-200">
                              {errand.packaging}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <Button
                      onClick={() => handleAcceptErrand(errand._id)}
                      disabled={submitting === errand._id}
                      className="h-12 w-full rounded-2xl bg-linear-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700"
                    >
                      {submitting === errand._id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Accepting errand...
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
        </section>
      </div>
    </div>
  )
}
