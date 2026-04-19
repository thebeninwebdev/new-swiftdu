'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  Wallet,
  XCircle,
} from 'lucide-react'
import { io } from 'socket.io-client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { convertToNaira } from '@/lib/utils'

const DETAIL_REFRESH_MS = 5000

interface ErrandDetail {
  _id: string
  userId: string
  taskType: string
  description: string
  amount: number
  commission: number
  platformFee: number
  taskerFee: number
  totalAmount: number
  deadlineValue: number
  deadlineUnit: string
  location: string
  store?: string
  packaging?: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerId?: string
  taskerName?: string
  acceptedAt?: string
  createdAt: string
  hasPaid?: boolean
}

interface UserInfo {
  name: string
  email: string
  phone: string
  location: string
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food delivery',
  printing: 'Printing task',
  shopping: 'Shopping errand',
  water: 'Water delivery',
  others: 'General errand',
}

const statusStyles: Record<ErrandDetail['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  in_progress: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
}

const formatDate = (date: string) =>
  new Date(date).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function ErrandDetailPage() {
  const router = useRouter()
  const params = useParams()
  const errandId = String(params?.id || '')

  const [errand, setErrand] = useState<ErrandDetail | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<'complete' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState<'complete' | 'cancel' | null>(null)

  const previousSnapshotRef = useRef<{ status: ErrandDetail['status']; hasPaid: boolean } | null>(
    null
  )
  const fetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)

  const loadErrand = useCallback(
    async (initial = false) => {
      if (!errandId) {
        return
      }

      if (fetchingRef.current) {
        queuedRefreshRef.current = true
        return
      }

      fetchingRef.current = true

      try {
        const errandRes = await fetch(`/api/orders/${errandId}`, {
          cache: 'no-store',
        })
        if (errandRes.status === 401) {
          router.push('/login')
          return
        }
        if (!errandRes.ok) {
          throw new Error('Failed to fetch errand details')
        }

        const errandData: ErrandDetail = await errandRes.json()
        setErrand(errandData)

        const userRes = await fetch(`/api/users/${errandData.userId}`)
        if (userRes.ok) {
          const userData = await userRes.json()
          setUserInfo(userData)
        } else {
          setUserInfo(null)
        }

          if (!initial && previousSnapshotRef.current) {
            if (!previousSnapshotRef.current.hasPaid && Boolean(errandData.hasPaid)) {
              toast.success('SwiftDU has confirmed the customer payment. You can complete the delivery once finished.')
            }

          if (
            previousSnapshotRef.current.status !== errandData.status &&
            errandData.status === 'cancelled'
          ) {
            toast.error('This errand was cancelled.')
          }
        }

        previousSnapshotRef.current = {
          status: errandData.status,
          hasPaid: Boolean(errandData.hasPaid),
        }

        setError(null)
      } catch (loadError) {
        console.error('Failed to load errand detail', loadError)
        setError('Failed to load errand details')
      } finally {
        fetchingRef.current = false
        setLoading(false)

        if (queuedRefreshRef.current) {
          queuedRefreshRef.current = false
          void loadErrand(false)
        }
      }
    },
    [errandId, router]
  )

  useEffect(() => {
    void loadErrand(true)
  }, [loadErrand])

  useEffect(() => {
    if (!errandId) {
      return
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadErrand(false)
      }
    }, DETAIL_REFRESH_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [errandId, loadErrand])

  useEffect(() => {
    if (!errandId) {
      return
    }

    const socket = io({
      withCredentials: true,
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      socket.emit('order:watch', errandId)
    })

    socket.on('order:updated', (payload?: { _id?: string }) => {
      if (!payload?._id || payload._id === errandId) {
        void loadErrand(false)
      }
    })

    return () => {
      if (socket.connected) {
        socket.emit('order:unwatch', errandId)
      }
      socket.disconnect()
    }
  }, [errandId, loadErrand])

  const handleAction = async (action: 'complete' | 'cancel') => {
    try {
      setActionLoading(action)
      setShowConfirmModal(null)

      const nextStatus = action === 'complete' ? 'completed' : 'cancelled'
      const response = await fetch(`/api/orders/${errandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.error || `Failed to ${action} errand`)
        return
      }

      setErrand(payload)
      previousSnapshotRef.current = {
        status: payload.status,
        hasPaid: Boolean(payload.hasPaid),
      }

      toast.success(
        action === 'complete'
          ? 'Errand marked as completed.'
          : 'Errand cancelled successfully.'
      )

      window.setTimeout(() => {
        router.replace('/tasker-dashboard')
      }, 1200)
    } catch (actionError) {
      console.error(`Failed to ${action} errand`, actionError)
      setError(`Failed to ${action} errand`)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="rounded-[2rem] border border-slate-200 bg-white/90 px-6 py-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Loading live task details...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!errand) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white/90 px-6 py-8 text-center shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60">
            <XCircle className="mx-auto h-12 w-12 text-rose-500" />
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              Task not found
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              This task may have been removed or you no longer have access to it.
            </p>
            <Button
              onClick={() => router.push('/tasker-dashboard')}
              className="mt-6 h-11 rounded-2xl bg-linear-to-r from-sky-600 to-indigo-600 text-white"
            >
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isActive = errand.status === 'pending' || errand.status === 'in_progress' || errand.status === 'paid'
  const paymentConfirmed = Boolean(errand.hasPaid || errand.status === 'paid')

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-1 py-2 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-2 md:px-3">
      {showConfirmModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {showConfirmModal === 'complete' ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <XCircle className="h-6 w-6" />
              )}
            </div>

            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              {showConfirmModal === 'complete'
                ? 'Mark this errand as completed?'
                : 'Cancel this errand?'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {showConfirmModal === 'complete'
                ? 'Only confirm completion after you have delivered the task successfully.'
                : 'This will close the task and return you to the dashboard.'}
            </p>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(null)}
                className="h-11 flex-1 rounded-2xl"
              >
                Go back
              </Button>
              <Button
                onClick={() => handleAction(showConfirmModal)}
                className={`h-11 flex-1 rounded-2xl text-white ${
                  showConfirmModal === 'complete'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {showConfirmModal === 'complete' ? 'Complete' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl space-y-5 px-2 py-3 sm:px-3 sm:py-4 md:space-y-6 md:px-4">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60">
          <div className="bg-linear-to-r from-sky-600 via-cyan-600 to-indigo-600 px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => router.push('/tasker-dashboard')}
                  className="inline-flex items-center gap-2 text-sm font-medium text-sky-100 transition hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to dashboard
                </button>

                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-sky-100">
                  Live task page
                </p>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                  {taskTypeLabels[errand.taskType] || errand.taskType}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50 sm:text-base">
                  This page updates automatically when the customer confirms payment or the order
                  status changes.
                </p>
              </div>

              <span
                className={`inline-flex shrink-0 rounded-full px-4 py-2 text-sm font-semibold capitalize ${
                  statusStyles[errand.status]
                }`}
              >
                {errand.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Task summary
              </p>
              <p className="mt-3 text-lg font-semibold leading-7">{errand.description}</p>

              <div className="mt-5 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{errand.location}</span>
                </div>
                {errand.store ? (
                  <div className="flex items-start gap-2">
                    <Store className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <span>{errand.store}</span>
                  </div>
                ) : null}
                <div className="flex items-start gap-2">
                  <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{convertToNaira(errand.amount)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Payment status
              </p>
              <p className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
                {paymentConfirmed ? 'SwiftDU payment confirmed' : 'Waiting for SwiftDU payment confirmation'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {paymentConfirmed
                  ? 'The customer checkout has been verified through Flutterwave. Finish the task and then complete it here.'
                  : 'You can prepare the errand, but completion stays locked until SwiftDU confirms the customer payment.'}
              </p>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Accepted
                </p>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  {errand.acceptedAt ? formatDate(errand.acceptedAt) : formatDate(errand.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-md shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer details</h2>

              {userInfo ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Full name
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {userInfo.name}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <a
                      href={`tel:${userInfo.phone}`}
                      className="rounded-2xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/70"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Phone
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                        <Phone className="h-4 w-4 text-sky-600" />
                        {userInfo.phone}
                      </p>
                    </a>

                    <a
                      href={`mailto:${userInfo.email}`}
                      className="rounded-2xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/70"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Email
                      </p>
                      <p className="mt-2 inline-flex items-center gap-2 break-all text-sm font-medium text-slate-900 dark:text-white">
                        <Mail className="h-4 w-4 text-sky-600" />
                        {userInfo.email}
                      </p>
                    </a>
                  </div>

                  <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Delivery location
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      {errand.location}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Customer information is not available right now.
                </p>
              )}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-md shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Task details</h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Description
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {errand.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Deadline
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      {errand.deadlineValue} {errand.deadlineUnit}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Created
                    </p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                      {formatDate(errand.createdAt)}
                    </p>
                  </div>
                </div>

                {errand.packaging ? (
                  <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Packaging
                    </p>
                    <p className="mt-2 capitalize text-sm text-slate-700 dark:text-slate-200">
                      {errand.packaging}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-md shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Payment summary
              </h2>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-950/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Total amount
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                    {convertToNaira((errand.amount+errand.taskerFee))}
                  </p>
                </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Customer budget
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {convertToNaira(errand.amount || 0)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Tasker Fee
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {convertToNaira(errand.taskerFee || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            {isActive ? (
              <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-md shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Task actions</h2>

                <div className="mt-5 space-y-3">
                  <Button
                    onClick={() => setShowConfirmModal('complete')}
                    disabled={!paymentConfirmed || Boolean(actionLoading)}
                    className="h-12 w-full rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {actionLoading === 'complete' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing task...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark as completed
                      </>
                    )}
                  </Button>

                  {!paymentConfirmed ? (
                    <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                      Completion unlocks automatically once the customer confirms payment.
                    </p>
                  ) : null}

                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmModal('cancel')}
                    disabled={Boolean(actionLoading)}
                    className="h-12 w-full rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    {actionLoading === 'cancel' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling task...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel errand
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-md shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/50">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Task closed</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  This errand is no longer active. You can head back to your dashboard to pick up
                  the next one.
                </p>
                <Button
                  onClick={() => router.push('/tasker-dashboard')}
                  className="mt-5 h-12 w-full rounded-2xl bg-linear-to-r from-sky-600 to-indigo-600 text-white"
                >
                  Return to dashboard
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
