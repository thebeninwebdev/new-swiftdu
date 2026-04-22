'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { convertToNaira } from '@/lib/utils'

interface SettlementOrder {
  _id: string
  description?: string
  taskType: string
  amount: number
  platformFee: number
  taskerFee: number
  totalAmount: number
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerHasPaid?: boolean
  settlementStatus?: 'not_due' | 'pending' | 'initialized' | 'paid' | 'failed' | 'overdue'
  settlementDueAt?: string
  settlementPaidAt?: string
}

const formatDate = (date?: string) =>
  date
    ? new Date(date).toLocaleString('en-NG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not available'

export default function TaskerPaymentPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const orderId = String(params?.id || '')

  const [order, setOrder] = useState<SettlementOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [startingPayment, setStartingPayment] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const processedReferenceRef = useRef<string | null>(null)

  const loadOrder = useCallback(async () => {
    if (!orderId) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/orders/${orderId}`, {
        cache: 'no-store',
      })

      if (response.status === 401) {
        router.push('/login')
        return
      }

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load the settlement details.')
      }

      setOrder(payload)
      setError(null)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load the settlement details.'
      )
    } finally {
      setLoading(false)
    }
  }, [orderId, router])

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  useEffect(() => {
    const reference = searchParams.get('reference')

    if (!reference || !orderId || processedReferenceRef.current === reference) {
      return
    }

    processedReferenceRef.current = reference
    setVerifying(true)

    void (async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}/pay-platform-fee/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reference }),
        })
        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to verify the Paystack payment.')
        }

        setOrder(payload.order)
        toast.success('Platform settlement paid successfully.')
      } catch (verifyError) {
        toast.error(
          verifyError instanceof Error
            ? verifyError.message
            : 'Failed to verify the Paystack payment.'
        )
      } finally {
        setVerifying(false)
        router.replace(`/tasker-dashboard/payment/${orderId}`)
        void loadOrder()
      }
    })()
  }, [loadOrder, orderId, router, searchParams])

  const handleStartPayment = async () => {
    if (!order) {
      return
    }

    try {
      setStartingPayment(true)
      const response = await fetch(`/api/orders/${order._id}/pay-platform-fee`, {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to open the Paystack checkout.')
      }

      if (!payload.checkoutUrl) {
        throw new Error('Paystack did not return a checkout link.')
      }

      window.location.assign(payload.checkoutUrl)
    } catch (paymentError) {
      toast.error(
        paymentError instanceof Error
          ? paymentError.message
          : 'Failed to open the Paystack checkout.'
      )
    } finally {
      setStartingPayment(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto mt-16 flex max-w-md items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
          Loading settlement details...
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settlement unavailable</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          The settlement details for this task could not be loaded right now.
        </p>
        <Button onClick={() => router.push('/tasker-dashboard/notifications')} className="mt-6 w-full">
          Back to notifications
        </Button>
      </div>
    )
  }

  const isCompleted = order.status === 'completed'
  const isPaid = Boolean(order.taskerHasPaid || order.settlementStatus === 'paid')
  const isOverdue = order.settlementStatus === 'overdue'

  return (
    <div className="mx-auto mt-10 max-w-xl px-4">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => router.push('/tasker-dashboard/notifications')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to notifications
        </button>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">
            Platform settlement
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            {convertToNaira(order.platformFee)}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Pay the platform fee for{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              {order.description || order.taskType}
            </span>
            .
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Settlement status
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {isPaid ? 'Paid' : order.settlementStatus?.replace('_', ' ') || 'Pending'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Due date
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {formatDate(order.settlementDueAt)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/70">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Customer transfer total</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {convertToNaira(order.totalAmount || order.amount)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Your tasker fee</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {convertToNaira(order.taskerFee || 0)}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {!isCompleted ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            This task must be completed before the platform settlement becomes payable.
          </div>
        ) : null}

        {isOverdue ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            This settlement is overdue. Tasker access can stay restricted until it is paid.
          </div>
        ) : null}

        {isPaid ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Settlement completed</p>
                <p className="mt-1">
                  Paid {formatDate(order.settlementPaidAt)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => void handleStartPayment()}
            disabled={!isCompleted || isPaid || startingPayment || verifying}
            className="flex-1 bg-amber-500 text-white hover:bg-amber-600"
          >
            {startingPayment || verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {verifying ? 'Verifying...' : 'Opening Paystack...'}
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay with Paystack
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/tasker-dashboard/${order._id}`)} className="flex-1">
            View task
          </Button>
        </div>

        {!isPaid ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Paystack is used only for the platform share. The customer transfer goes directly to
              your bank account.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
