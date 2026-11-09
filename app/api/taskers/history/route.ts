import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'
import { NextRequest, NextResponse } from 'next/server'
import { getTaskerOrderModeFilter } from '@/lib/test-orders'
import { applyCurrentSessionOrderScope, getActiveAcademicSession, NoActiveOrderSessionError, serializeOrderSession } from '@/lib/orders/order-session-scope'
import { parseOrderPagination, TASKER_HISTORY_FIELDS } from '@/lib/orders/order-list-fields'

const NON_TEST_ORDER_MATCH = {
  $or: [{ isTestOrder: false }, { isTestOrder: { $exists: false } }],
}

export async function GET(req: NextRequest) {
  try {
    await connectDB()

    const taskerId = req.nextUrl.searchParams.get('taskerId')
    const status = req.nextUrl.searchParams.get('status')
    const { page, limit, skip } = parseOrderPagination(
      req.nextUrl.searchParams.get('page'),
      req.nextUrl.searchParams.get('limit') || '10'
    )

    if (!taskerId) {
      return NextResponse.json(
        { error: 'taskerId is required' },
        { status: 400 }
      )
    }

    const currentSession = await getActiveAcademicSession()
    const tasker = await Tasker.findById(taskerId).select('taskerMode isVerified').lean()
    let query: Record<string, unknown> = applyCurrentSessionOrderScope(
      { taskerId, ...getTaskerOrderModeFilter(tasker || undefined) },
      currentSession
    )

    // Filter by status if provided
    if (status) {
      query = { $and: [query, { status }] }
    }

    const completedQuery = applyCurrentSessionOrderScope({
      taskerId, status: 'completed', ...NON_TEST_ORDER_MATCH,
    }, currentSession)

    const [orders, statsAgg] = await Promise.all([
      Order.find(query)
        .select(TASKER_HISTORY_FIELDS)
        .skip(skip)
        .limit(limit)
        .sort({ acceptedAt: -1 })
        .lean(),
      Order.aggregate<{ completedOrders: number; totalEarnings: number }>([
        { $match: completedQuery },
        {
          $group: {
            _id: null,
            completedOrders: { $sum: 1 },
            totalEarnings: { $sum: '$taskerFee' },
          },
        },
      ]),
    ])

    const total = (skip === 0 && orders.length < limit)
      ? orders.length
      : await Order.countDocuments(query)

    // Hydrate user info safely for tasker history cards
    const userIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))]
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select('_id name email profileImage').lean()
      : []
    const userMap = new Map(users.map((u) => [u._id.toString(), u]))

    const populatedOrders = orders.map((o) => ({
      ...o,
      userId: userMap.get(String(o.userId)) || { name: 'Customer', email: '', profileImage: '' },
    }))

    const statsSummary = statsAgg[0] || { completedOrders: 0, totalEarnings: 0 }

    return NextResponse.json({
      orders: populatedOrders,
      stats: {
        completedOrders: statsSummary.completedOrders,
        totalEarnings: statsSummary.totalEarnings,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      session: serializeOrderSession(currentSession),
    })
  } catch (error) {
    if (error instanceof NoActiveOrderSessionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('Error fetching task history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch task history' },
      { status: 500 }
    )
  }
}
