import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getOrderResponseTime } from '@/lib/order-response-time'
import { Order } from '@/models/order'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'
import mongoose from 'mongoose'
import { AcademicSession } from '@/models/academic-session'

const ADMIN_ORDER_FIELDS = [
  'userId', 'source', 'customerPhone', 'customerName', 'taskType', 'description',
  'amount', 'commission', 'platformFee', 'taskerFee', 'totalAmount', 'noteSize',
  'numberOfPages', 'copyNotesType', 'copyNotesPages', 'deadline', 'dueDate',
  'deadlineDate', 'deadlineValue', 'deadlineUnit', 'location', 'store', 'status',
  'taskerId', 'bookedAt', 'acceptedAt', 'cancelledAt', 'isDeclinedTask',
  'declinedMessage', 'declinedAt', 'paymentFailureReason', 'cafeInquiry',
  'cafeInquiryStatus', 'cafeAvailableItems', 'cafeSelectedItems', 'createdAt',
  'updatedAt',
].join(' ')

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

    const currentSession = await AcademicSession.findOne({ isActive: true })
      .select('_id name startDate endDate')
      .lean()

    if (!currentSession) {
      return NextResponse.json(
        { error: 'No active academic session is configured.' },
        { status: 409 }
      )
    }

    // Build filters
    const filters: Record<string, unknown> = {
      createdAt: {
        $gte: currentSession.startDate,
        $lte: currentSession.endDate,
      },
    }

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

    const source = searchParams.get('source')
    if (source && source !== 'all') {
      filters.source = source
    }

    const declined = searchParams.get('declined')
    if (declined === 'only') {
      filters.isDeclinedTask = true
    } else if (declined === 'exclude') {
      filters.isDeclinedTask = { $ne: true }
    }

    // Get orders with user and tasker details
    const [orders, totalOrders] = await Promise.all([
      Order.find(filters)
        .select(ADMIN_ORDER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filters),
    ])

    // Get user details
    const userIds = [
      ...new Set(
        orders
          .map(o => o.userId?.toString())
          .filter((id): id is string => Boolean(id && mongoose.Types.ObjectId.isValid(id)))
      )
    ]
    // Get tasker details
    const taskerIds = [...new Set(orders
      .map(o => o.taskerId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id))
      .map(id => id.toString()))]

    const [users, taskers] = await Promise.all([
      User.find({ _id: { $in: userIds } })
        .select('_id name email')
        .lean(),
      Tasker.find({ _id: { $in: taskerIds } })
        .select('_id userId')
        .populate('userId', 'name')
        .lean(),
    ])

    const userMap = Object.fromEntries(
      users.map(u => [u._id.toString(), u])
    )

    const taskerMap = Object.fromEntries(
      taskers.map((tasker) => {
        const populatedUser = tasker.userId as { name?: string } | undefined
        return [tasker._id.toString(), populatedUser?.name || 'Unknown']
      })
    )

    // Attach user and tasker details
    const ordersWithDetails = orders.map(order => ({
      ...order,
      bookedAt: order.bookedAt || order.createdAt,
      userName:
        userMap[order.userId.toString()]?.name ||
        order.customerName ||
        (order.source === 'whatsapp' ? 'WhatsApp Customer' : 'Unknown User'),
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

    const totalPages = Math.ceil(totalOrders / limit)

    return NextResponse.json({
      orders: ordersWithDetails,
      currentPage: page,
      totalPages,
      totalOrders,
      session: {
        id: currentSession._id.toString(),
        name: currentSession.name,
        startDate: currentSession.startDate,
        endDate: currentSession.endDate,
      },
    })

  } catch (error) {
    console.error('[GET /api/admin/orders]', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

