'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { convertToNaira, getTaskerId } from '@/lib/utils'
import { 
  History, 
  CheckCircle2, 
  Search, 
  MapPin, 
  Clock, 
  User, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Package
} from 'lucide-react'

interface Order {
  _id: string
  taskType: string
  description: string
  amount: number
  commission?: number
  platformFee?: number
  taskerFee?: number
  totalAmount?: number
  deadlineDate?: string
  deadlineValue?: number
  deadlineUnit?: string
  location: string
  status: string
  acceptedAt: string
  userId: {
    name: string
    profileImage?: string
  }
}

interface TaskHistory {
  orders: Order[]
  stats: {
    completedOrders: number
    totalEarnings: number // will be recalculated as sum of taskerFee
  }
  pagination: {
    total: number
    page: number
    pages: number
  }
}

const taskTypeLabels: Record<string, string> = {
  restaurant: 'Food Delivery',
  printing: 'Printing',
  copy_notes: 'Copy Notes',
  shopping: 'Shopping',
  water: 'Bag of Water',
  others: 'Other Errands',
}

const taskTypeIcons: Record<string, React.ReactNode> = {
  restaurant: <Package className="h-4 w-4" />,
  printing: <Package className="h-4 w-4" />,
  copy_notes: <Package className="h-4 w-4" />,
  shopping: <Package className="h-4 w-4" />,
  water: <Package className="h-4 w-4" />,
  others: <Package className="h-4 w-4" />,
}

function formatDeadline(deadlineDate?: string, deadlineValue?: number, deadlineUnit?: string) {
  if (deadlineDate) {
    return new Intl.DateTimeFormat('en-NG', {
      dateStyle: 'medium',
    }).format(new Date(deadlineDate))
  }

  if (deadlineValue && deadlineUnit) {
    return `${deadlineValue} ${deadlineUnit}`
  }

  return 'Not set'
}

const statusStyles: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
  pending: { 
    bg: 'bg-amber-100', 
    text: 'text-amber-700',
    darkBg: 'dark:bg-amber-950/50',
    darkText: 'dark:text-amber-300'
  },
  in_progress: { 
    bg: 'bg-sky-100', 
    text: 'text-sky-700',
    darkBg: 'dark:bg-sky-950/50',
    darkText: 'dark:text-sky-300'
  },
  completed: { 
    bg: 'bg-emerald-100', 
    text: 'text-emerald-700',
    darkBg: 'dark:bg-emerald-950/50',
    darkText: 'dark:text-emerald-300'
  },
  cancelled: { 
    bg: 'bg-rose-100', 
    text: 'text-rose-700',
    darkBg: 'dark:bg-rose-950/50',
    darkText: 'dark:text-rose-300'
  },
}

export default function HistoryPage() {
  const [taskerId, setTaskerId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [data, setData] = useState<TaskHistory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get taskerId from session
  useEffect(() => {
    getTaskerId().then((id) => {
      if (id) setTaskerId(id)
    }).catch((err) => {
      console.error('Failed to get tasker ID', err)
    })
  }, [])

  // Fetch task history
  useEffect(() => {
    if (!taskerId) return

    const fetchHistory = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams({
          taskerId,
          page: page.toString(),
          limit: '10',
          ...(statusFilter && { status: statusFilter }),
        })

        const response = await fetch(
          `/api/taskers/history?${queryParams}`
        )
        if (!response.ok) {
          throw new Error('Failed to fetch task history')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [taskerId, page, statusFilter])

  const handleStatusChange = (status: string) => {
    setStatusFilter(status)
    setPage(1)
  }

  const totalTaskValue = data?.stats.totalEarnings || 0

  // Filter orders by search query
  const filteredOrders = data?.orders.filter(order => 
    searchQuery === '' || 
    order.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    taskTypeLabels[order.taskType]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-linear-to-br from-[#f6f9fc] via-white to-[#eef7ff] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pt-10 sm:pt-0">
      {/* Sticky Header */}

      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Stats Cards */}
        {data && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {data.stats.completedOrders}
              </p>
            </div>
            
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-950/50">
                  <Wallet className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your Earnings</p>
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {convertToNaira(totalTaskValue)}
              </p>
            </div>
          </div>
        )}

        <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Search tasks
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by type, location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-white pl-10 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
          </div>
          
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Status filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Loading history...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            Failed to load task history. Please try again.
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && data && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <History className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              No tasks found
            </h3>
            <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
              {searchQuery || statusFilter 
                ? 'Try adjusting your filters to see more results.' 
                : 'Start accepting errands to build your history!'}
            </p>
          </div>
        )}

        {/* Tasks List */}
        {!isLoading && !error && data && filteredOrders.length > 0 && (
          <div className="space-y-3">
            {filteredOrders.map((order) => {
              const statusStyle = statusStyles[order.status] || statusStyles.pending
              
              return (
                <div
                  key={order._id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Card Header */}
                  <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                          {taskTypeIcons[order.taskType] || taskTypeIcons.others}
                        </span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          {taskTypeLabels[order.taskType] || order.taskType}
                        </span>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyle.bg} ${statusStyle.text} ${statusStyle.darkBg} ${statusStyle.darkText}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white line-clamp-2">
                        {order.description}
                      </h3>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                          {order.location}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {formatDeadline(order.deadlineDate, order.deadlineValue, order.deadlineUnit)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate text-xs text-slate-600 dark:text-slate-300">
                          {order.userId.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {new Date(order.acceptedAt).toLocaleDateString('en-NG', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Financial Details */}
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Order value</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {convertToNaira(order.amount)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400 dark:text-slate-500">Customer transfer: {convertToNaira(order.totalAmount || order.amount)}</span>
                        <span className="text-slate-400 dark:text-slate-500">Platform fee: {convertToNaira(order.platformFee || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && !error && data && data.pagination.pages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-10 w-10 rounded-full p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, data.pagination.pages) }, (_, i) => {
                const pageNum = i + 1
                const isActive = pageNum === page
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition ${
                      isActive
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {data.pagination.pages > 5 && (
                <span className="px-2 text-slate-400">...</span>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
              disabled={page === data.pagination.pages}
              className="h-10 w-10 rounded-full p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
