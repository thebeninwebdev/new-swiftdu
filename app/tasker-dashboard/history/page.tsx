'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface Order {
  _id: string
  taskType: string
  description: string
  amount: number
  deadlineValue: number
  deadlineUnit: string
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
    totalEarnings: number
  }
  pagination: {
    total: number
    page: number
    pages: number
  }
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
    const getTaskerId = async () => {
      try {
        const session = await fetch('/api/auth/session').then((r) => r.json())
        if (session?.user?.id) {
          setTaskerId(session.user.id)
        }
      } catch (error) {
        console.error('Error fetching session:', error)
      }
    }
    getTaskerId()
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

  const taskTypeLabels: Record<string, string> = {
    restaurant: 'Buy food from a restaurant',
    printing: 'Printing from cyber cafe',
    shopping: 'Buy items from a store',
    others: 'Small errands around campus',
  }

  const statusStyles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Task History</h1>
              <p className="text-muted-foreground mt-2">
                View all tasks you&apos;ve accepted and completed
              </p>
            </div>
          </div>

          {/* Stats */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Completed Tasks</p>
                <p className="text-3xl font-bold mt-2">
                  {data.stats.completedOrders}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-3xl font-bold mt-2">
                  ${data.stats.totalEarnings.toFixed(2)}
                </p>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Filters and Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <Input
              placeholder="Search by task type or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-4 py-2 rounded-md border border-border bg-background"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading your task history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load task history. Please try again.
          </div>
        )}

        {/* Empty State */}
        {data && data.orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              No tasks found. Start accepting errands to build your history!
            </p>
          </div>
        )}

        {/* Tasks List */}
        {data && data.orders.length > 0 && (
          <>
            <div className="space-y-4">
              {data.orders.map((order) => (
                <Card
                  key={order._id}
                  className="p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {taskTypeLabels[order.taskType] || order.taskType}
                        </h3>
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-medium ${
                            statusStyles[order.status] ||
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {order.status.charAt(0).toUpperCase() +
                            order.status.slice(1)}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {order.description.substring(0, 100)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        ${order.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Amount</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="font-medium text-sm">{order.location}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Deadline</p>
                      <p className="font-medium text-sm">
                        {order.deadlineValue} {order.deadlineUnit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Requested by
                      </p>
                      <p className="font-medium text-sm">{order.userId.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Accepted Date
                      </p>
                      <p className="font-medium text-sm">
                        {new Date(order.acceptedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {data.pagination.pages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.pagination.pages}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    setPage(Math.min(data.pagination.pages, page + 1))
                  }
                  disabled={page === data.pagination.pages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
