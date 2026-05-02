'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Users,
  ShoppingBag,
  Star,
  MessageSquare,
  DollarSign,
  TrendingUp,
  Activity,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react'

interface DashboardStats {
  totalUsers: number
  totalTaskers: number
  premiumTaskers: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  completedOrders: number
  totalReviews: number
  pendingTaskerApprovals: number
  grossRevenue:number
  totalPlatformFees: number
  paystackSettlementFees: number
  profit: number
  totalCompensation: number
  declinedTasks: number
}

interface RecentActivity {
  id: string
  type: 'order' | 'tasker' | 'review' | 'user' | 'declined'
  message: string
  timestamp: string
  status?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [isStatsLoading, setIsStatsLoading] = useState(false)

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

  // Fetch dashboard stats
  const fetchStats = async () => {
    setIsStatsLoading(true)
    try {
      const response = await fetch('/api/admin/dashboard')
      if (!response.ok) throw new Error('Failed to fetch stats')

      const data = await response.json()
      setStats(data.stats)
      setRecentActivity(data.recentActivity || [])
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setIsStatsLoading(false)
    }
  }

  useEffect(() => {
    if (admin) {
      fetchStats()
    }
  }, [admin])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
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
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage your Swiftdu platform</p>
            </div>
            <Badge variant="secondary" className="w-fit px-3 py-1">
              Admin Panel
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Income Breakdown */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 md:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₦{isStatsLoading ? '...' : (stats?.grossRevenue || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Amount + Commission (all orders)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paystack Fees</CardTitle>
              <TrendingUp className="h-4 w-4 rotate-180 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                â‚¦{isStatsLoading ? '...' : (stats?.paystackSettlementFees || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">1.5% settlement charge</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₦{isStatsLoading ? '...' : (stats?.profit || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Platform fees after Paystack</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Compensation</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₦{isStatsLoading ? '...' : (stats?.totalCompensation || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Total Tasker Fees</p>
            </CardContent>
          </Card>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5 md:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isStatsLoading ? '...' : stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Taskers</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isStatsLoading ? '...' : stats?.totalTaskers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Verified taskers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Taskers</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isStatsLoading ? '...' : stats?.premiumTaskers || 0}
              </div>
              <p className="text-xs text-muted-foreground">Receive new task emails</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isStatsLoading ? '...' : stats?.totalOrders || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.pendingOrders || 0} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reviews</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalReviews || 0}</div>
              <p className="text-xs text-muted-foreground">Total reviews</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Quick Actions */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common admin tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between text-left"
                onClick={() => router.push('/admin/taskers')}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Review Taskers
                </span>
                {stats?.pendingTaskerApprovals ? (
                  <Badge variant="destructive" className="ml-auto">
                    {stats.pendingTaskerApprovals}
                  </Badge>
                ) : null}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/admin/orders')}
              >
                <ShoppingBag className="w-4 h-4 mr-2" />
                Manage Orders
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between text-left"
                onClick={() => router.push('/admin/orders?declined=only')}
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Review Declined Tasks
                </span>
                {stats?.declinedTasks ? (
                  <Badge variant="destructive" className="ml-auto">
                    {stats.declinedTasks}
                  </Badge>
                ) : null}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between text-left"
                onClick={() => router.push('/admin/taskers?status=verified')}
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 mr-0" />
                  Manage Premium Access
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {stats?.premiumTaskers || 0}
                </Badge>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/admin/users')}
              >
                <Users className="w-4 h-4 mr-2" />
                User Management
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/admin/support')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Support Tickets
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/admin/reviews')}
              >
                <Star className="w-4 h-4 mr-2" />
                Review Management
              </Button>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest platform activity</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:space-x-3 sm:gap-0">
                      <div className={`p-2 rounded-full ${
                        activity.type === 'order' ? 'bg-blue-100 text-blue-600' :
                        activity.type === 'tasker' ? 'bg-green-100 text-green-600' :
                        activity.type === 'declined' ? 'bg-red-100 text-red-600' :
                        activity.type === 'review' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {activity.type === 'order' && <ShoppingBag className="w-4 h-4" />}
                        {activity.type === 'tasker' && <Users className="w-4 h-4" />}
                        {activity.type === 'declined' && <AlertCircle className="w-4 h-4" />}
                        {activity.type === 'review' && <Star className="w-4 h-4" />}
                        {activity.type === 'user' && <Users className="w-4 h-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString()}
                        </p>
                      </div>
                      {activity.status && (
                        <Badge variant={
                          activity.status === 'pending' ? 'secondary' :
                          activity.status === 'completed' ? 'default' :
                          activity.status === 'declined' ? 'destructive' :
                          'destructive'
                        } className="w-fit">
                          {activity.status}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Declined Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.declinedTasks || 0}</div>
              <p className="text-xs text-muted-foreground">Transfer disputes flagged by taskers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalOrders ?
                  Math.round(((stats.completedOrders || 0) / stats.totalOrders) * 100) : 0
                }%
              </div>
              <p className="text-xs text-muted-foreground">Orders completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Pending Approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats?.pendingTaskerApprovals || 0}
              </div>
              <p className="text-xs text-muted-foreground">Tasker applications</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
