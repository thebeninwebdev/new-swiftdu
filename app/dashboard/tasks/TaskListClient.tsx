'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  XCircle,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type OrderStatus = 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
type TaskTab = 'in_progress' | 'completed' | 'cancelled'

interface Order {
  _id: string
  taskType: string
  description?: string
  amount: number
  totalAmount?: number
  location: string
  status: OrderStatus
  createdAt: string
  store?: string
}

const ACTIVE_STATUSES = new Set<OrderStatus>(['pending', 'in_progress', 'paid'])

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  copy_notes: 'Copy Notes',
  shopping: 'Shopping',
  indomie: 'Buy Indomie',
  dry_cleaning: 'Dry Cleaning',
  water: 'Bag of Water',
  others: 'General Errand',
}

const statusConfig: Record<OrderStatus, { label: string; color: string; bg: string; icon: typeof Package }> = {
  pending: {
    label: 'Finding tasker',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    icon: Loader2,
  },
  in_progress: {
    label: 'In progress',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    icon: Package,
  },
  paid: {
    label: 'Payment confirmed',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: CheckCircle2,
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    icon: XCircle,
  },
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount)

const formatDate = (date: string) => {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTaskTitle(order: Order) {
  if (order.description?.trim()) return order.description
  const label = taskTypeLabels[order.taskType] || order.taskType
  return order.store ? `${label} from ${order.store}` : label
}

function EmptyState({ tab }: { tab: TaskTab }) {
  const configs = {
    in_progress: {
      title: 'No active tasks',
      description: 'Post a new task and it will appear here while we find the right tasker for you.',
      action: 'Post a Task',
    },
    completed: {
      title: 'No completed tasks',
      description: 'Tasks you finish will show up here. Great work takes time!',
      action: null,
    },
    cancelled: {
      title: 'No cancelled tasks',
      description: 'Cancelled tasks will appear here if you change your mind.',
      action: null,
    },
  }

  const config = configs[tab]
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800">
        <Package className="h-7 w-7 text-slate-300 dark:text-slate-600" />
      </div>
      <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">{config.title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
        {config.description}
      </p>
      {config.action && (
        <Button
          onClick={() => router.push('/dashboard/post-task')}
          className="mt-6 h-11 rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white hover:bg-sky-700"
        >
          {config.action}
        </Button>
      )}
    </div>
  )
}

export default function TaskListClient() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState<TaskTab>('in_progress')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const loadOrders = useCallback(
    async (initial = false) => {
      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      try {
        setError(null)
        const response = await fetch('/api/orders?status=pending,in_progress,paid,completed,cancelled', {
          cache: 'no-store',
        })

        if (response.status === 401) {
          router.push('/login')
          return
        }

        if (!response.ok) {
          throw new Error('Failed to load your tasks.')
        }

        const data: Order[] = await response.json()
        setOrders(data)
      } catch (loadError) {
        console.error(loadError)
        setError('Could not load your tasks right now.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [router]
  )

  useEffect(() => {
    void loadOrders(true)
  }, [loadOrders])

  const groupedOrders = useMemo(
    () => ({
      in_progress: orders.filter((order) => ACTIVE_STATUSES.has(order.status)),
      completed: orders.filter((order) => order.status === 'completed'),
      cancelled: orders.filter((order) => order.status === 'cancelled'),
    }),
    [orders]
  )

  const filteredOrders = useMemo(() => {
    const tabOrders = groupedOrders[activeTab]
    if (!searchQuery.trim()) return tabOrders
    const q = searchQuery.toLowerCase()
    return tabOrders.filter(
      (order) =>
        getTaskTitle(order).toLowerCase().includes(q) ||
        order.location.toLowerCase().includes(q) ||
        order.taskType.toLowerCase().includes(q)
    )
  }, [groupedOrders, activeTab, searchQuery])

  const retryOrder = async (order: Order) => {
    if (retryingOrderId) return

    try {
      setRetryingOrderId(order._id)
      const response = await fetch(`/api/orders/${order._id}/retry`, { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry this task.')
      }

      toast.success('Task sent again. We are looking for taskers now.')
      router.push(`/dashboard/tasks/${data._id}`)
    } catch (retryError) {
      toast.error(retryError instanceof Error ? retryError.message : 'Failed to retry this task.')
    } finally {
      setRetryingOrderId(null)
    }
  }

  const renderOrder = (order: Order) => {
    const isActive = ACTIVE_STATUSES.has(order.status)
    const canRetry = order.status === 'completed' || order.status === 'cancelled'
    const config = statusConfig[order.status]
    const StatusIcon = config.icon

    return (
      <article
        key={order._id}
        className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Status indicator strip */}
        <div
          className={`absolute left-0 top-0 h-full w-1 ${
            order.status === 'pending'
              ? 'bg-amber-400'
              : order.status === 'in_progress'
                ? 'bg-sky-500'
                : order.status === 'paid'
                  ? 'bg-emerald-500'
                  : order.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-rose-500'
          }`}
        />

        <div className="p-5 pl-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              {/* Status icon */}
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.bg}`}
              >
                <StatusIcon
                  className={`h-5 w-5 ${order.status === 'pending' ? 'animate-spin' : ''} ${config.color}`}
                />
              </div>

              <div className="min-w-0 flex-1">
                {/* Title & Status badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-900 dark:text-white">
                    {getTaskTitle(order)}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${config.bg} ${config.color}`}
                  >
                    {config.label}
                  </span>
                </div>

                {/* Meta info */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    {formatCurrency(order.totalAmount || order.amount)}
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{order.location}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {formatDate(order.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              {isActive ? (
                <Button
                  type="button"
                  onClick={() => router.push(`/dashboard/tasks/${order._id}`)}
                  className="h-10 w-full rounded-xl bg-sky-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 hover:shadow sm:w-auto"
                >
                  Open
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : null}

              {canRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void retryOrder(order)}
                  disabled={Boolean(retryingOrderId)}
                  className="h-10 w-full rounded-xl border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
                >
                  {retryingOrderId === order._id ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                  )}
                  Retry
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </article>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/30">
            <Loader2 className="h-7 w-7 animate-spin text-sky-600" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading your tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      {/* Header */}
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              My Tasks
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950 dark:text-white">
              Track your tasks
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              Manage and monitor all your tasks in one place
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadOrders(false)}
            disabled={refreshing}
            className="h-11 rounded-xl border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Error banner */}
      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Tabs — stacked vertically, NOT side by side */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TaskTab)} className="flex flex-col">
        {/* Tab list */}
        <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2 dark:bg-slate-900">
          <TabsTrigger
            value="in_progress"
            className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-sky-400 sm:flex-row sm:gap-2 sm:text-sm"
          >
            <span>In progress</span>
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-400 data-[state=active]:bg-sky-100 data-[state=active]:text-sky-700">
              {groupedOrders.in_progress.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="completed"
            className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-emerald-400 sm:flex-row sm:gap-2 sm:text-sm"
          >
            <span>Completed</span>
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
              {groupedOrders.completed.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="cancelled"
            className="flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-all data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-rose-400 sm:flex-row sm:gap-2 sm:text-sm"
          >
            <span>Cancelled</span>
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-400">
              {groupedOrders.cancelled.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Search bar */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks by title, location, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab content — appears BELOW the tabs, not beside */}
        {(['in_progress', 'completed', 'cancelled'] as TaskTab[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
            {filteredOrders.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {filteredOrders.length} {filteredOrders.length === 1 ? 'task' : 'tasks'}
                  </p>
                </div>
                {filteredOrders.map(renderOrder)}
              </div>
            ) : (
              <EmptyState tab={tab} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
