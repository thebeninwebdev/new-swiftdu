'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
  settlementReference?: string
  settlementDueAt?: string
  settlementPaidAt?: string
}

const MAX_VERIFY_RETRIES = 12
const VERIFY_RETRY_MS = 5000

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

const getPendingSettlementStorageKey = (orderId: string) =>
  `swiftdu:pending-settlement:${orderId}`

function TaskerPaymentPageContent() {
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
  const processedRedirectRef = useRef<string | null>(null)
  const autoVerifyingReferenceRef = useRef<string | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
  }, [])

  const getStoredPendingReference = useCallback(() => {
    if (typeof window === 'undefined' || !orderId) {
      return null
    }

    return window.localStorage.getItem(getPendingSettlementStorageKey(orderId))
  }, [orderId])

  const storePendingReference = useCallback(
    (reference?: string | null) => {
      if (typeof window === 'undefined' || !orderId) {
        return
      }

      const normalizedReference = String(reference || '').trim()

      if (!normalizedReference) {
        return
      }

      window.localStorage.setItem(
        getPendingSettlementStorageKey(orderId),
        normalizedReference
      )
    },
    [orderId]
  )

  const clearStoredPendingReference = useCallback(() => {
    if (typeof window === 'undefined' || !orderId) {
      return
    }

    window.localStorage.removeItem(getPendingSettlementStorageKey(orderId))
  }, [orderId])

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

  const verifySettlement = useCallback(
    async ({
      reference,
      transactionId,
      attempt = 0,
      allowRetry = false,
      showSuccessToast = true,
    }: {
      reference?: string | null
      transactionId?: string | null
      attempt?: number
      allowRetry?: boolean
      showSuccessToast?: boolean
    }) => {
      if (!orderId) {
        return
      }

      const resolvedReference = String(
        reference || order?.settlementReference || getStoredPendingReference() || ''
      ).trim()
      const resolvedTransactionId = String(transactionId || '').trim()

      if (!resolvedReference && !resolvedTransactionId) {
        return
      }

      setVerifying(true)
      clearRetryTimeout()

      try {
        const response = await fetch(`/api/orders/${orderId}/pay-platform-fee/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reference: resolvedReference || undefined,
            transactionId: resolvedTransactionId || undefined,
          }),
        })
        const payload = await response.json()

        if (response.status === 202 || payload.pending) {
          setOrder(payload.order)
          setError(null)
          storePendingReference(resolvedReference)

          if (allowRetry && attempt + 1 < MAX_VERIFY_RETRIES) {
            retryTimeoutRef.current = window.setTimeout(() => {
              void verifySettlement({
                reference: resolvedReference,
                transactionId: resolvedTransactionId,
                attempt: attempt + 1,
                allowRetry: true,
                showSuccessToast,
              })
            }, VERIFY_RETRY_MS)
          }

          return
        }

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to verify the Flutterwave payment.')
        }

        setOrder(payload.order)
        setError(null)
        clearStoredPendingReference()
        autoVerifyingReferenceRef.current = null

        if (showSuccessToast) {
          toast.success('Platform settlement paid successfully.')
        }
      } catch (verifyError) {
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : 'Failed to verify the Flutterwave payment.'
        )
        toast.error(
          verifyError instanceof Error
            ? verifyError.message
            : 'Failed to verify the Flutterwave payment.'
        )
      } finally {
        setVerifying(false)
      }
    },
    [
      clearRetryTimeout,
      clearStoredPendingReference,
      getStoredPendingReference,
      order?.settlementReference,
      orderId,
      storePendingReference,
    ]
  )

  useEffect(() => {
    void loadOrder()
  }, [loadOrder])

  useEffect(() => {
    return () => {
      clearRetryTimeout()
    }
  }, [clearRetryTimeout])

  useEffect(() => {
    if (!order) {
      return
    }

    const isPaid = Boolean(order.taskerHasPaid || order.settlementStatus === 'paid')

    if (isPaid) {
      clearRetryTimeout()
      clearStoredPendingReference()
      autoVerifyingReferenceRef.current = null
    }
  }, [clearRetryTimeout, clearStoredPendingReference, order])

  useEffect(() => {
    const settlement = String(searchParams.get('settlement') || '').toLowerCase()
    const message = String(searchParams.get('message') || '').trim()
    const redirectKey = settlement ? `${settlement}:${message}` : null

    if (!redirectKey || !orderId || processedRedirectRef.current === redirectKey) {
      return
    }

    processedRedirectRef.current = redirectKey

    if (settlement === 'paid') {
      clearStoredPendingReference()
      toast.success('Platform settlement paid successfully.')
    } else if (settlement === 'cancelled') {
      clearStoredPendingReference()
      toast.error(message || 'Flutterwave checkout was cancelled.')
    } else {
      toast.error(message || 'Failed to verify the Flutterwave payment.')
    }

    router.replace(`/tasker-dashboard/payment/${orderId}`)
    void loadOrder()
  }, [clearStoredPendingReference, loadOrder, orderId, router, searchParams])

  useEffect(() => {
    const settlement = String(searchParams.get('settlement') || '').toLowerCase()
    const reference = searchParams.get('tx_ref') || searchParams.get('reference')
    const transactionId = searchParams.get('transaction_id')
    const status = String(searchParams.get('status') || '').toLowerCase()

    if (
      settlement ||
      !reference ||
      !orderId ||
      processedReferenceRef.current === reference
    ) {
      return
    }

    if (status && status !== 'successful' && status !== 'pending') {
      processedReferenceRef.current = reference
      toast.error(
        status === 'cancelled'
          ? 'Flutterwave checkout was cancelled.'
          : 'Flutterwave payment was not successful.'
      )
      router.replace(`/tasker-dashboard/payment/${orderId}`)
      void loadOrder()
      return
    }

    processedReferenceRef.current = reference
    storePendingReference(reference)

    void verifySettlement({
      reference,
      transactionId,
      allowRetry: true,
    }).finally(() => {
      router.replace(`/tasker-dashboard/payment/${orderId}`)
      void loadOrder()
    })
  }, [loadOrder, orderId, router, searchParams, storePendingReference, verifySettlement])

  useEffect(() => {
    if (!order || !orderId || verifying) {
      return
    }

    const storedReference = getStoredPendingReference()
    const orderReference = String(order.settlementReference || '').trim()
    const isPaid = Boolean(order.taskerHasPaid || order.settlementStatus === 'paid')
    const canAutoVerify =
      Boolean(storedReference) &&
      Boolean(orderReference) &&
      storedReference === orderReference &&
      (order.settlementStatus === 'initialized' || order.settlementStatus === 'pending')

    if (!canAutoVerify || isPaid || autoVerifyingReferenceRef.current === orderReference) {
      return
    }

    autoVerifyingReferenceRef.current = orderReference

    void verifySettlement({
      reference: orderReference,
      allowRetry: true,
    })
  }, [getStoredPendingReference, order, orderId, verifySettlement, verifying])

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
        throw new Error(payload.error || 'Failed to open the Flutterwave checkout.')
      }

      if (!payload.checkoutUrl) {
        throw new Error('Flutterwave did not return a checkout link.')
      }

      storePendingReference(payload.reference)
      window.location.assign(payload.checkoutUrl)
    } catch (paymentError) {
      toast.error(
        paymentError instanceof Error
          ? paymentError.message
          : 'Failed to open the Flutterwave checkout.'
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
  const isAwaitingConfirmation = order.settlementStatus === 'pending'

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

        {isAwaitingConfirmation ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
            Flutterwave has not finished confirming this payment yet. We will keep checking
            automatically for you.
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
                {verifying ? 'Verifying...' : 'Opening Flutterwave...'}
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay with Flutterwave
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/tasker-dashboard/${order._id}`)} className="flex-1">
            View task
          </Button>
        </div>

        {!isPaid && order.settlementReference ? (
          <Button
            variant="outline"
            onClick={() =>
              void verifySettlement({
                reference: order.settlementReference,
                allowRetry: true,
              })
            }
            disabled={startingPayment || verifying}
            className="mt-3 w-full"
          >
            {verifying ? 'Checking payment status...' : 'I already paid, check status'}
          </Button>
        ) : null}

        {!isPaid ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p>
              Flutterwave is used only for the platform share. The customer transfer goes directly to
              your bank account.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function TaskerPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-slate-500">
          Loading payment details...
        </div>
      }
    >
      <TaskerPaymentPageContent />
    </Suspense>
  )
}
