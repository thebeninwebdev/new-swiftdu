import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'
import DryCleaner from '@/models/dry-cleaner'
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

export async function GET() {
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
      activeDryCleaners,
      pendingDryCleanerApprovals,
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
      DryCleaner.countDocuments({ status: 'approved' }),
      DryCleaner.countDocuments({ status: 'pending' }),
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
      .limit(5)
      .populate('taskerId', 'name')
      .lean()

    const recentTaskers = await Tasker.find({ isVerified: false, isRejected: false })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate('userId', 'name')
      .lean()

    const recentReviews = await Review.find()
      .sort({ createdAt: -1 })
      .limit(2)
      .populate('userId', 'name')
      .lean()

    const recentDryCleaners = await DryCleaner.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()

    const recentDeclinedOrders = await Order.find(excludeTestOrders({ isDeclinedTask: true }))
      .sort({ declinedAt: -1, updatedAt: -1 })
      .limit(3)
      .lean()

    const recentActivity = [
      ...recentOrders.map(order => ({
        id: order._id.toString(),
        type: 'order' as const,
        message: `New order: ${order.taskType} task in ${order.location}`,
        timestamp: order.createdAt,
        status: order.status
      })),
      ...recentTaskers.map(tasker => ({
        id: tasker._id.toString(),
        type: 'tasker' as const,
        message: `${(tasker as { userId?: { name?: string } }).userId?.name || 'New user'} applied to be a tasker`,
        timestamp: tasker.createdAt,
        status: 'pending'
      })),
      ...recentDryCleaners.map(dryCleaner => ({
        id: dryCleaner._id.toString(),
        type: 'dry-cleaner' as const,
        message: `${dryCleaner.businessName} applied to be a dry cleaner`,
        timestamp: dryCleaner.createdAt,
        status: 'pending'
      })),
      ...recentReviews.map(review => ({
        id: review._id.toString(),
        type: 'review' as const,
        message: `${(review as { userId?: { name?: string } }).userId?.name || 'User'} left a review`,
        timestamp: review.createdAt
      })),
      ...recentDeclinedOrders.map(order => ({
        id: order._id.toString(),
        type: 'declined' as const,
        message: `Transfer issue flagged for ${order.taskType} in ${order.location}`,
        timestamp: order.declinedAt || order.updatedAt || order.createdAt,
        status: 'declined'
      }))
    ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)

    const stats = {
      totalUsers,
      totalTaskers,
      totalOrders,
      grossRevenue,
      profit: businessProfit,
      netPlatformProfit: profit,
      approvedExpenditures,
      totalPlatformFees,
      paystackSettlementFees,
      totalCompensation,
      totalRevenue: totalRevenue[0]?.total || 0, // legacy
      pendingOrders,
      completedOrders,
      totalReviews,
      pendingTaskerApprovals,
      activeDryCleaners,
      pendingDryCleanerApprovals,
      declinedTasks
    }

    return NextResponse.json({
      stats,
      recentActivity,
    })

  } catch (error) {
    console.error('[GET /api/admin/dashboard]', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
