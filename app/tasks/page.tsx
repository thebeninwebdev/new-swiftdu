'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Store,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import DashboardMenu from '@/components/dashboard-menu'
import { CompleteProfileGate } from '@/components/complete-profile-gate'

const ACTIVE_ORDER_STATUSES = new Set(['pending', 'in_progress', 'paid'])

interface Order {
  _id: string
  taskType: string
  description?: string
  amount: number
  totalAmount?: number
  deadline?: string
  dueDate?: string
  deadlineDate?: string
  deadlineValue?: number
  deadlineUnit?: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerId?: string
  taskerName?: string
  createdAt: string
  hasPaid?: boolean
  isDeclinedTask?: boolean
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  copy_notes: 'Copy Notes',
  shopping: 'Shopping',
  dry_cleaning: 'Dry Cleaning',
  water: 'Bag of Water',
  others: 'General Errand',
}

const statusConfig: Record<
  Order['status'],
  { label: string; tone: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Finding tasker',
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: 'In progress',
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  paid: {
    label: 'On the way',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  completed: {
    label: 'Completed',
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
}

const declinedStatusConfig = {
  label: 'Payment under review',
  tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  icon: <AlertCircle className="h-3.5 w-3.5" />,
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (date: string) =>
  new Date(date).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

function formatDeadline(
  dueDate?: string,
  deadlineDate?: string,
  deadlineValue?: number,
  deadlineUnit?: string
) {
  const exactDeadline = dueDate || deadlineDate

  if (exactDeadline) {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(exactDeadline))
  }

  if (deadlineValue && deadlineUnit) {
    return `${deadlineValue} ${deadlineUnit}`
  }

  return 'Not set'
}

function isActiveOrder(order: Pick<Order, 'status'>) {
  return ACTIVE_ORDER_STATUSES.has(order.status)
}

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <CompleteProfileGate>
      <div className="min-h-screen overflow-x-hidden lg:flex">
        <DashboardMenu pageTitle="My Tasks" />
        {children}
      </div>
    </CompleteProfileGate>
  )
}

export default function TasksPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOrders = async (initial = false) => {
    if (initial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      setError(null)
      const response = await fetch('/api/orders', { cache: 'no-store' })

      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to load orders')
      }

      const data: Order[] = await response.json()
      setOrders(data)
    } catch (loadError) {
      console.error(loadError)
      setError('Could not load your orders right now.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadOrders(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeOrders = useMemo(() => orders.filter(isActiveOrder), [orders])
  const pastOrders = useMemo(() => orders.filter((order) => !isActiveOrder(order)), [orders])

  const renderOrder = (order: Order) => {
    const status = order.isDeclinedTask ? declinedStatusConfig : statusConfig[order.status]
    const active = isActiveOrder(order)
    const title =
      order.description ||
      (order.store
        ? `${taskTypeLabels[order.taskType] || order.taskType} from ${order.store}`
        : taskTypeLabels[order.taskType] || 'Order')

    return (
      <article
        key={order._id}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <Package className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-slate-950 dark:text-white">
                  {title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(order.createdAt)}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.tone}`}
              >
                {status.icon}
                {status.label}
              </span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{order.location}</span>
              </span>
              {order.store ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
                  <Store className="h-4 w-4 shrink-0" />
                  <span className="truncate">{order.store}</span>
                </span>
              ) : null}
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/60">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {formatDeadline(
                    order.dueDate || order.deadline,
                    order.deadlineDate,
                    order.deadlineValue,
                    order.deadlineUnit
                  )}
                </span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
            <p className="text-base font-black text-slate-950 dark:text-white">
              {formatCurrency(order.totalAmount || order.amount)}
            </p>
            {active ? (
              <Button
                type="button"
                onClick={() => router.push(`/dashboard/tasks/${order._id}`)}
                className="h-10 rounded-lg bg-sky-600 px-4 text-white hover:bg-sky-700"
              >
                Track
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <main className="min-w-0 flex-1 bg-[#f6f9fc] px-4 py-10 pt-24 dark:bg-slate-950 lg:pt-10">
          <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Loading orders...
              </p>
            </div>
          </div>
        </main>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <main className="min-w-0 flex-1 bg-[#f6f9fc] px-4 py-6 pt-24 dark:bg-slate-950 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mx-auto max-w-5xl">
          <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-300">
                Orders
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950 dark:text-white">
                My Tasks
              </h1>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadOrders(false)}
              disabled={refreshing}
              className="h-10 rounded-lg"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </header>

        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            {error}
          </div>
        ) : null}

        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              Tasks still in progress
            </h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {activeOrders.length} active
            </span>
          </div>
          {activeOrders.length > 0 ? (
            <div className="space-y-3">{activeOrders.map(renderOrder)}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="font-bold text-slate-950 dark:text-white">No active orders</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                New orders that are still moving will appear here.
              </p>
            </div>
          )}
        </section>

        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-950 dark:text-white">
              All orders
            </h2>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {orders.length} total
            </span>
          </div>
          {orders.length > 0 ? (
            <div className="space-y-3">
              {activeOrders.map(renderOrder)}
              {pastOrders.map(renderOrder)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="font-bold text-slate-950 dark:text-white">No orders yet</p>
              <Button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="mt-5 h-10 rounded-lg bg-sky-600 px-4 text-white hover:bg-sky-700"
              >
                Book a task
              </Button>
            </div>
          )}
        </section>
        </div>
      </main>
    </DashboardShell>
  )
}
