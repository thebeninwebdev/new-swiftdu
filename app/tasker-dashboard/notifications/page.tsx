'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BellRing, CreditCard, Loader2 } from 'lucide-react'
import { io } from 'socket.io-client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { convertToNaira } from '@/lib/utils'

interface UnpaidOrder {
  _id: string
  platformFee: number
  description: string
  paidAt?: string
  status: string
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
    : 'Recently'

export default function TaskerNotificationsPage() {
  const [orders, setOrders] = useState<UnpaidOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/taskers/unpaid-platform-fees')
      if (!response.ok) {
        throw new Error('Failed to load notifications')
      }

      const data = await response.json()
      setOrders(data.orders || [])
      setError(null)
    } catch {
      setOrders([])
      setError('Failed to load notifications right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const socket = io({
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socket.on('tasks:updated', () => {
      void fetchNotifications()
    })

    return () => {
      socket.disconnect()
    }
  }, [fetchNotifications])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <div className="rounded-[2rem] border border-slate-200 bg-white/90 px-6 py-5 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-slate-950/60">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Loading notifications...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] px-4 py-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:px-6 md:py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
            Tasker dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
            Notifications
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            The layout only shows one toast at a time. Everything still waiting on you appears
            here.
          </p>
        </div>

        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {!error && orders.length === 0 ? (
          <Card className="rounded-[2rem] border-0 bg-white/90 shadow-xl shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-slate-950/60 dark:ring-slate-800">
            <CardContent className="px-5 py-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <BellRing className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    No unpaid platform fee reminders are waiting right now.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : !error ? (
          <>
            <Card className="rounded-[2rem] border-0 bg-white/90 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-slate-950/60 dark:ring-slate-800">
              <CardHeader className="px-5 pt-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                      Platform fee reminders
                    </CardTitle>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {orders.length} payment reminder{orders.length === 1 ? '' : 's'} are still open.
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="space-y-4">
              {orders.map((order) => (
                <Card
                  key={order._id}
                  className="rounded-[2rem] border-0 bg-white/90 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200 dark:bg-slate-900/90 dark:shadow-slate-950/60 dark:ring-slate-800"
                >
                  <CardContent className="space-y-4 px-5 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                          Platform fee due
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                          {order.description}
                        </p>
                      </div>

                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold capitalize text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="rounded-[1.5rem] bg-slate-50 p-4 dark:bg-slate-950/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Amount due
                      </p>
                      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                        {convertToNaira(order.platformFee)}
                      </p>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Customer payment confirmed {formatDate(order.paidAt)}.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Link
                        href={`/tasker-dashboard/payment/${order._id}`}
                        className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-linear-to-r from-amber-500 to-orange-500 px-4 text-sm font-semibold text-white transition hover:from-amber-600 hover:to-orange-600"
                      >
                        Pay now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>

                      <Link
                        href={`/tasker-dashboard/${order._id}`}
                        className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Open task page
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
