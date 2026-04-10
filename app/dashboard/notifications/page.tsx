'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellRing, CreditCard, MessageSquareMore } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

interface OrderReminder {
  _id: string
  taskType: string
  description: string
  amount: number
  totalAmount?: number
  taskerName?: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  hasPaid?: boolean
  taskerId?: string
  createdAt: string
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Restaurant order',
  printing: 'Printing job',
  shopping: 'Shopping task',
  others: 'General errand',
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount)

export default function DashboardNotifications() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [currentOrder, setCurrentOrder] = useState<OrderReminder | null>(null)
  const [pendingReviews, setPendingReviews] = useState<OrderReminder[]>([])

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true)

        const [currentResponse, reviewsResponse] = await Promise.all([
          fetch('/api/orders?current=true'),
          fetch('/api/orders?status=completed&needsReview=true'),
        ])

        const currentData = currentResponse.ok ? await currentResponse.json() : null
        const reviewsData = reviewsResponse.ok ? await reviewsResponse.json() : []

        setCurrentOrder(currentData)
        setPendingReviews(reviewsData)
      } finally {
        setLoading(false)
      }
    }

    void fetchNotifications()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-[#f7f9fc] via-white to-[#eef7ff] px-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <Spinner className="size-5 text-sky-600" />
            <p className="text-sm text-slate-600 dark:text-slate-300">Loading notifications...</p>
          </div>
        </div>
      </div>
    )
  }

  const needsPayment = !!currentOrder?.taskerId && !currentOrder.hasPaid

  return (
    <div className="min-h-screen bg-linear-to-br from-[#f7f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:px-6 md:py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Anything that still needs your attention shows up here.
          </p>
        </div>

        {needsPayment ? (
          <Card className="rounded-[1.75rem] border-0 bg-white/90 shadow-lg shadow-sky-100/70 ring-1 ring-sky-200 dark:bg-slate-900/90 dark:shadow-none dark:ring-sky-900">
            <CardHeader className="px-5 pt-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                    Payment needed
                  </CardTitle>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {currentOrder.taskerName || 'A tasker'} accepted your {taskTypeLabels[currentOrder.taskType] || 'order'}. Complete payment to get the errand moving.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(currentOrder.totalAmount || currentOrder.amount)}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                  {currentOrder.description}
                </p>
              </div>
              <Button
                onClick={() => router.push('/dashboard/tasks')}
                className="h-12 w-full rounded-2xl bg-linear-to-r from-sky-600 to-indigo-600 text-white"
              >
                Open order tracker
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Card className="rounded-[1.75rem] border-0 bg-white/90 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-none dark:ring-slate-800">
          <CardHeader className="px-5 pt-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                <MessageSquareMore className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  Reviews waiting for you
                </CardTitle>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Completed orders without feedback stay here until you review the tasker.
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 px-5 pb-5">
            {pendingReviews.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:text-slate-400 dark:ring-slate-800">
                No review reminders right now.
              </div>
            ) : (
              pendingReviews.map((order) => (
                <div
                  key={order._id}
                  className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-slate-950/70 dark:ring-slate-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {taskTypeLabels[order.taskType] || order.taskType}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {order.taskerName || 'Tasker'}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      Review due
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {order.description}
                  </p>

                  <Button
                    onClick={() => router.push(`/dashboard/reviews?orderId=${order._id}`)}
                    variant="outline"
                    className="mt-4 h-11 w-full rounded-2xl"
                  >
                    Leave review
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {!needsPayment && pendingReviews.length === 0 ? (
          <Card className="rounded-[1.75rem] border-0 bg-white/90 shadow-md shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-none dark:ring-slate-800">
            <CardContent className="px-5 py-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    No payments to confirm and no reviews waiting on you.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
