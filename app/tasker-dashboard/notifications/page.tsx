'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, BellRing, CreditCard, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { io } from 'socket.io-client'

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
      <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-6 py-4 shadow-lg dark:border-slate-800 dark:bg-slate-900/90">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Loading notifications...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-10 sm:pt-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Notifications</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {orders.length > 0 ? `${orders.length} pending` : 'All caught up'}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <BellRing className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="space-y-3">
          {/* Error Message */}
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/30">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
            </div>
          ) : null}

          {/* Empty State */}
          {!error && orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                You&apos;re all caught up
              </h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                No manual payment actions are waiting. SwiftDU now collects customer payments directly.
              </p>
            </div>
          ) : null}

          {/* Summary Card - Only show if there are orders */}
          {!error && orders.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 px-4 py-3 dark:border-amber-900/50 dark:from-amber-950/30 dark:to-orange-950/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
                  <CreditCard className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Manual actions
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {orders.length} notification{orders.length === 1 ? '' : 's'} waiting
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Orders List */}
          {!error && orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Card Header */}
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Payment handled by SwiftDU
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {order.description}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Customer payment was recorded {formatDate(order.paidAt)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950/50">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Service fee collected
                      </p>
                      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                        {convertToNaira(order.platformFee)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/tasker-dashboard/${order._id}`}
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-orange-500 px-4 text-sm font-semibold text-white transition active:scale-95 hover:from-amber-600 hover:to-orange-600"
                      >
                        View task
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>

                      <Link
                        href="/tasker-dashboard"
                        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition active:scale-95 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        Dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
