'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface ReviewableOrder {
  _id: string
  taskerId: string
  taskType: string
  description: string
  amount: number
  totalAmount?: number
  taskerName?: string
  createdAt: string
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Restaurant order',
  printing: 'Printing job',
  copy_notes: 'Copy notes task',
  shopping: 'Shopping task',
  dry_cleaning: 'Dry cleaning task',
  others: 'General errand',
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

function DashboardReviewsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightedOrderId = searchParams.get('orderId')

  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<ReviewableOrder[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (highlightedOrderId) {
      router.replace(`/dashboard/reviews/${highlightedOrderId}`)
      return
    }

    const fetchOrders = async () => {
      try {
        setLoading(true)

        const response = await fetch('/api/orders?status=completed&needsReview=true')
        if (!response.ok) throw new Error('Failed to load review reminders')

        const data = await response.json()
        setOrders(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reviews')
      } finally {
        setLoading(false)
      }
    }

    void fetchOrders()
  }, [highlightedOrderId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[#f7f9fc] via-white to-[#eef7ff] px-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Spinner className="size-5 text-sky-600" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading review reminders...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f7f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:px-6 md:py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            Reviews
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Rate your completed errands and help taskers improve their service.
          </p>
        </div>

        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {orders.length === 0 ? (
          <Card className="rounded-[1.75rem] border-0 bg-white/90 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-none dark:ring-slate-800">
            <CardContent className="space-y-4 px-5 py-6">
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                No reviews waiting right now
              </p>
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                When you complete another order, this page will hold any review you still need to submit.
              </p>
              <Button onClick={() => router.push('/dashboard/tasks')} className="h-12 rounded-2xl">
                Back to tracker
              </Button>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order._id} className="rounded-[1.75rem] border-0 bg-white/90 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-none dark:ring-slate-800">
              <CardHeader className="px-5 pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      {taskTypeLabels[order.taskType] || order.taskType}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {order.taskerName || 'Tasker'} - {formatCurrency(order.totalAmount || order.amount)}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    Review due
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-5 pb-5">
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {order.description}
                </p>

                <Button
                  onClick={() => router.push(`/dashboard/reviews/${order._id}`)}
                  variant="outline"
                  className="h-12 w-full rounded-2xl"
                >
                  Leave review
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default function DashboardReviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-linear-to-br from-[#f7f9fc] via-white to-[#eef7ff] px-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Spinner className="size-5 text-sky-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Loading review reminders...</p>
            </div>
          </div>
        </div>
      }
    >
      <DashboardReviewsPageContent />
    </Suspense>
  )
}
