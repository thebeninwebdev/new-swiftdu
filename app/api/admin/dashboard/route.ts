import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'
import { Order } from '@/models/order'
import {Review} from '@/models/review'

// ─── GET /api/admin/dashboard ────────────────────────────────────────────────
// Returns dashboard statistics and recent activity.
// Restricted to admin role only.

export async function GET(req: NextRequest) {
  try {
    // TODO: Add admin auth check
    // const session = await authClient.getSession()
    // const user = session?.data?.user
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()

    // Get stats
    const [
      totalUsers,
      totalTaskers,
      premiumTaskers,
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
      Tasker.countDocuments({ isVerified: true, isPremium: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'completed' }),
      Review.countDocuments(),
      Tasker.countDocuments({ isVerified: false, isRejected: false }),
      Order.countDocuments({ isDeclinedTask: true })
    ])

    // Calculate gross revenue, profit, and total compensation (only for completed orders)
    const [grossRevenueAgg, profitAgg, compensationAgg] = await Promise.all([
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: { $add: ["$amount", "$commission"] } } } }
      ]),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: "$platformFee" } } }
      ]),
      Order.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: "$taskerFee" } } }
      ])
    ])

    const grossRevenue = grossRevenueAgg[0]?.total || 0
    const profit = profitAgg[0]?.total || 0
    const totalCompensation = compensationAgg[0]?.total || 0

    // Get recent activity (last 10 items)
    const recentOrders = await Order.find()
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

    const recentDeclinedOrders = await Order.find({ isDeclinedTask: true })
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
        message: `${(tasker as any).userId?.name || 'New user'} applied to be a tasker`,
        timestamp: tasker.createdAt,
        status: 'pending'
      })),
      ...recentReviews.map(review => ({
        id: review._id.toString(),
        type: 'review' as const,
        message: `${(review as any).userId?.name || 'User'} left a review`,
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
      premiumTaskers,
      totalOrders,
      grossRevenue,
      profit,
      totalCompensation,
      totalRevenue: totalRevenue[0]?.total || 0, // legacy
      pendingOrders,
      completedOrders,
      totalReviews,
      pendingTaskerApprovals,
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
