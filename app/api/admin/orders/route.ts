import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getOrderResponseTime } from '@/lib/order-response-time'
import { Order } from '@/models/order'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'

// ─── GET /api/admin/orders ──────────────────────────────────────────────────
// Returns paginated list of orders with user and tasker details.
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

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const skip = (page - 1) * limit

    // Build filters
    const filters: any = {}

    const search = searchParams.get('search')
    if (search) {
      filters.$or = [
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ]
    }

    const status = searchParams.get('status')
    if (status && status !== 'all') {
      filters.status = status
    }

    const taskType = searchParams.get('taskType')
    if (taskType && taskType !== 'all') {
      filters.taskType = taskType
    }

    const declined = searchParams.get('declined')
    if (declined === 'only') {
      filters.isDeclinedTask = true
    } else if (declined === 'exclude') {
      filters.isDeclinedTask = { $ne: true }
    }

    // Get orders with user and tasker details
    const orders = await Order.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    // Get user details
    const userIds = [...new Set(orders.map(o => o.userId))]
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email')
      .lean()

    const userMap = Object.fromEntries(
      users.map(u => [u._id.toString(), u])
    )

    // Get tasker details
    const taskerIds = orders
      .map(o => o.taskerId)
      .filter(id => id)
      .map(id => id.toString())

    const taskers = await Tasker.find({ _id: { $in: taskerIds } })
      .select('_id userId')
      .populate('userId', 'name')
      .lean()

    const taskerMap = Object.fromEntries(
      taskers.map(t => [t._id.toString(), (t as any).userId?.name || 'Unknown'])
    )

    // Attach user and tasker details
    const ordersWithDetails = orders.map(order => ({
      ...order,
      bookedAt: order.bookedAt || order.createdAt,
      userName: userMap[order.userId.toString()]?.name || 'Unknown User',
      userEmail: userMap[order.userId.toString()]?.email || '',
      taskerName: order.taskerId ? taskerMap[order.taskerId.toString()] : undefined,
      ...(() => {
        const responseTiming = getOrderResponseTime(order)

        return {
          responseOutcome: responseTiming.responseOutcome,
          firstResponseAt: responseTiming.firstResponseAt?.toISOString() || null,
          responseTimeMs: responseTiming.responseTimeMs,
        }
      })()
    }))

    const totalOrders = await Order.countDocuments(filters)
    const totalPages = Math.ceil(totalOrders / limit)

    return NextResponse.json({
      orders: ordersWithDetails,
      currentPage: page,
      totalPages,
      totalOrders
    })

  } catch (error) {
    console.error('[GET /api/admin/orders]', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

