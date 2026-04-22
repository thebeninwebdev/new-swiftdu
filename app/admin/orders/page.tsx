'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ShoppingBag,
  Search,
  MapPin,
  Clock,
  User,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle
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
  deadlineValue: number
  deadlineUnit: 'mins' | 'hours' | 'days'
  location: string
  store?: string
  status: 'pending' | 'in_progress' | 'paid' | 'completed' | 'cancelled'
  taskerId?: string
  taskerName?: string
  isDeclinedTask?: boolean
  declinedMessage?: string
  declinedAt?: string
  paymentFailureReason?: string
  requiresPremiumTasker?: boolean
  userId: string
  userName: string
  userEmail: string
  createdAt: string
  updatedAt: string
}

interface AdminUser {
  id: string
  role?: string | null
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [taskTypeFilter, setTaskTypeFilter] = useState('all')
  const [declinedFilter, setDeclinedFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) {
          router.push('/login')
          return
        }
        // TODO: Add admin role check
        setAdmin(data.user)
      } catch {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setIsFetching(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        status: statusFilter,
        taskType: taskTypeFilter,
        declined: declinedFilter
      })

      const res = await fetch(`/api/admin/orders?${params}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to load orders')
        return
      }

      setOrders(data.orders)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('Failed to load orders')
    } finally {
      setIsFetching(false)
    }
  }, [currentPage, searchTerm, statusFilter, taskTypeFilter, declinedFilter])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    setDeclinedFilter(params.get('declined') || 'all')
  }, [])

  useEffect(() => {
    if (admin) fetchOrders()
  }, [admin, fetchOrders])

  // Handle order actions
  const handleOrderAction = async (orderId: string, action: 'cancel' | 'complete') => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Action failed')
        return
      }

      toast.success(
        action === 'cancel' ? 'Order cancelled' :
        'Order marked as completed'
      )

      // Refresh orders list
      fetchOrders()
    } catch {
      toast.error('Something went wrong')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'paid':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-4 h-4" />
      case 'in_progress':
        return <Clock className="w-4 h-4" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'paid':
        return <CheckCircle className="w-4 h-4" />
      case 'cancelled':
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!admin) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Order Management</h1>
              <p className="text-muted-foreground mt-1">Monitor and manage all platform orders</p>
            </div>
            <Badge variant="secondary" className="w-fit px-3 py-1">
              Admin Panel
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={taskTypeFilter} onValueChange={(value) => setTaskTypeFilter(value ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="printing">Printing</SelectItem>
                  <SelectItem value="shopping">Shopping</SelectItem>
                  <SelectItem value="water">Buy Water</SelectItem>
                  <SelectItem value="others">Others</SelectItem>
                </SelectContent>
              </Select>

              <Select value={declinedFilter} onValueChange={(value) => setDeclinedFilter(value ?? 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by payment review" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payment States</SelectItem>
                  <SelectItem value="only">Declined Tasks</SelectItem>
                  <SelectItem value="exclude">No Declined Tasks</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={() => setCurrentPage(1)} disabled={isFetching}>
                {isFetching ? 'Loading...' : 'Apply Filters'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No orders found</p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order._id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:space-x-4 sm:gap-0">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6 text-primary" />
                      </div>

                      <div>
                        <h3 className="font-semibold text-lg capitalize">{order.taskType} Task</h3>
                        <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                          <div className="flex items-center">
                            <User className="w-4 h-4 mr-1" />
                            {order.userName}
                          </div>
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            {order.location}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {order.deadlineValue} {order.deadlineUnit}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
                      <div className="text-left sm:text-right">
                        <div className="mb-2 flex flex-wrap items-center gap-2 sm:justify-end">
                          {getStatusIcon(order.status)}
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {order.isDeclinedTask ? (
                            <Badge variant="destructive">DECLINED TASK</Badge>
                          ) : null}
                        </div>
                        <p className="text-lg font-bold">₦{(order.totalAmount || order.amount).toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedId(expandedId === order._id ? null : order._id)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {order.status === 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOrderAction(order._id, 'cancel')}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}

                        {order.status === 'in_progress' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOrderAction(order._id, 'complete')}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === order._id && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Order ID</p>
                          <p className="text-sm font-mono">{order._id}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Customer</p>
                          <p className="text-sm">{order.userName}</p>
                          <p className="text-xs text-muted-foreground">{order.userEmail}</p>
                        </div>

                        {order.taskerName && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Assigned Tasker</p>
                            <p className="text-sm">{order.taskerName}</p>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Task Type</p>
                          <p className="text-sm capitalize">{order.taskType}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Location</p>
                          <p className="text-sm">{order.location}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Amount</p>
                          <p className="text-sm font-semibold">₦{order.amount.toLocaleString()}</p>
                          {order.totalAmount && (
                            <p className="text-xs text-muted-foreground mt-1">
                              (+₦{order.platformFee || order.commission || 0} service fee = ₦{order.totalAmount.toLocaleString()} total)
                            </p>
                          )}
                          {order.requiresPremiumTasker ? (
                            <p className="text-xs text-emerald-600 mt-1">Premium taskers only</p>
                          ) : null}
                        </div>

                        {order.store && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Store</p>
                            <p className="text-sm">{order.store}</p>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Deadline</p>
                          <p className="text-sm">{order.deadlineValue} {order.deadlineUnit}</p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Created</p>
                          <p className="text-sm">
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">Last Updated</p>
                          <p className="text-sm">
                            {new Date(order.updatedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                        <p className="text-sm bg-muted/50 p-3 rounded-lg">{order.description}</p>
                      </div>

                      {order.isDeclinedTask ? (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
                            <div>
                              <p className="text-sm font-semibold text-red-900">Transfer dispute flagged</p>
                              <p className="mt-1 text-sm text-red-700">
                                {order.declinedMessage ||
                                  order.paymentFailureReason ||
                                  'The tasker reported that the transaction was not found.'}
                              </p>
                              {order.declinedAt ? (
                                <p className="mt-2 text-xs text-red-600">
                                  Flagged {new Date(order.declinedAt).toLocaleString()}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <span className="px-4 py-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
