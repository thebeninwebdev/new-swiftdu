import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'
import { Order } from '@/models/order'
import {Review} from '@/models/review'
import {
  EFFECTIVE_PLATFORM_FEE_EXPRESSION,
  calculateNetPlatformProfit,
  calculatePaystackSettlementFee,
  excludeCancelledOrders,
  excludeTestOrders,
} from '@/lib/order-finance'
import { getApprovedExpenditureTotal } from '@/lib/expenditures'

// ─── GET /api/admin/dashboard ────────────────────────────────────────────────
// Returns dashboard statistics and recent activity.
// Restricted to admin role only.

export async function GET(request: NextRequest) {
  const requestedPage = Number(request.nextUrl.searchParams.get('activityPage') || '1')
  const requestedLimit = Number(request.nextUrl.searchParams.get('activityLimit') || '10')
  const activityPage = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1
  const activityLimit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, Math.floor(requestedLimit))) : 10
  const activityOffset = (activityPage - 1) * activityLimit
  const activityFetchLimit = activityOffset + activityLimit
  try {
    // TODO: Add admin auth check
    // const session = await authClient.getSession()
    // const user = session?.data?.user
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()
    const financeMatch = excludeCancelledOrders()
    const nonTestMatch = excludeTestOrders()

    // Get stats
    const [
      totalUsers,
      totalTaskers,
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
      totalReviews,
      pendingTaskerApprovals,
      declinedTasks
    ] = await Promise.all([
      User.countDocuments(),
      Tasker.countDocuments({ isVerified: true }),
      Order.countDocuments(nonTestMatch),
      Order.aggregate([
        { $match: excludeTestOrders({ status: 'completed' }) },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Order.countDocuments(excludeTestOrders({ status: 'pending' })),
      Order.countDocuments(excludeTestOrders({ status: 'completed' })),
      Review.countDocuments(),
      Tasker.countDocuments({ isVerified: false, isRejected: false }),
      Order.countDocuments(excludeTestOrders({ isDeclinedTask: true }))
    ])

    // Calculate gross revenue, profit, Paystack settlement fees, and total compensation.
    const [grossRevenueAgg, platformFeeAgg, compensationAgg] = await Promise.all([
      Order.aggregate([
        { $match: financeMatch },
        { $group: { _id: null, total: { $sum: { $add: ["$amount", "$commission"] } } } }
      ]),
      Order.aggregate([
        { $match: financeMatch },
        { $group: { _id: null, total: { $sum: EFFECTIVE_PLATFORM_FEE_EXPRESSION } } }
      ]),
      Order.aggregate([
        { $match: financeMatch },
        { $group: { _id: null, total: { $sum: "$taskerFee" } } }
      ])
    ])

    const grossRevenue = grossRevenueAgg[0]?.total || 0
    const totalPlatformFees = platformFeeAgg[0]?.total || 0
    const paystackSettlementFees = calculatePaystackSettlementFee(totalPlatformFees)
    const profit = calculateNetPlatformProfit(totalPlatformFees)
    const approvedExpenditures = await getApprovedExpenditureTotal()
    const businessProfit = profit - approvedExpenditures
    const totalCompensation = compensationAgg[0]?.total || 0

    // Get recent activity (last 10 items)
    const recentOrders = await Order.find(nonTestMatch)
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .populate('taskerId', 'name')
      .lean()

    const recentTaskers = await Tasker.find({ isVerified: false, isRejected: false })
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .populate('userId', 'name')
      .lean()

    const recentReviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(activityFetchLimit)
      .populate('userId', 'name')
      .lean()


    const recentDeclinedOrders = await Order.find(excludeTestOrders({ isDeclinedTask: true }))
      .sort({ declinedAt: -1, updatedAt: -1 })
      .limit(activityFetchLimit)
      .lean()

    const recentActivity = [
      ...recentOrders.map(order => ({
        id: order._id.toString(), type: 'order' as const,
        message: `New order: ${order.taskType} task in ${order.location}`,
        timestamp: order.createdAt, status: order.status
      })),
      ...recentTaskers.map(tasker => ({
        id: tasker._id.toString(), type: 'tasker' as const,
        message: `${(tasker as { userId?: { name?: string } }).userId?.name || 'New user'} applied to be a tasker`,
        timestamp: tasker.createdAt, status: 'pending'
      })),
      ...recentReviews.map(review => ({
        id: review._id.toString(), type: 'review' as const,
        message: `${(review as { userId?: { name?: string } }).userId?.name || 'User'} left a review`,
        timestamp: review.createdAt
      })),
      ...recentDeclinedOrders.map(order => ({
        id: order._id.toString(), type: 'declined' as const,
        message: `Transfer issue flagged for ${order.taskType} in ${order.location}`,
        timestamp: order.declinedAt || order.updatedAt || order.createdAt, status: 'declined'
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(activityOffset, activityOffset + activityLimit)

    const totalActivityItems = (await Promise.all([
      Order.countDocuments(nonTestMatch),
      Tasker.countDocuments({ isVerified: false, isRejected: false }),
      Review.countDocuments(),
      Order.countDocuments(excludeTestOrders({ isDeclinedTask: true }))
    ])).reduce((total, count) => total + count, 0)

    const stats = {
      totalUsers, totalTaskers, totalOrders, grossRevenue, profit: businessProfit,
      netPlatformProfit: profit, approvedExpenditures, totalPlatformFees,
      paystackSettlementFees, totalCompensation, totalRevenue: totalRevenue[0]?.total || 0,
      pendingOrders, completedOrders, totalReviews, pendingTaskerApprovals, declinedTasks
    }

    return NextResponse.json({ stats, recentActivity, activityPagination: { page: activityPage, limit: activityLimit, totalItems: totalActivityItems, totalPages: Math.max(1, Math.ceil(totalActivityItems / activityLimit)) } })
  } catch (error) {
    console.error('[GET /api/admin/dashboard]', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}