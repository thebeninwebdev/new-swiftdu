import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { getOrderResponseTime } from '@/lib/order-response-time'
import { Order } from '@/models/order'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'
import mongoose from 'mongoose'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import { IndomieBatch } from '@/models/indomie-batch'
import { LIVE_ORDER_STATUSES, isAdminOrderStatus } from '@/lib/admin-workspaces'
import { applyCurrentSessionOrderScope, getActiveAcademicSession, NoActiveOrderSessionError, serializeOrderSession } from '@/lib/orders/order-session-scope'

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
    if (!await getAdminDashboardAccess(req.headers)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10)
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const limit = 20
    const skip = (page - 1) * limit

    const currentSession = await getActiveAcademicSession()

    // Build filters
    const filters: Record<string, unknown> = {}

    if (searchParams.get('view') === 'indomie-batches') {
      const sessionWindow = { $gte: currentSession.startDate, $lte: currentSession.endDate }
      const [orders, batches] = await Promise.all([
        Order.find(applyCurrentSessionOrderScope({ taskType: 'indomie' }, currentSession))
          .select('_id batchId batchStatus batchingStatus batchWindowStart batchWindowEnd indomieRunAt indomieRunStatus scheduledFor indomieReservationGroupId indomiePacks eggCount indomieSlotCount status paymentStatus taskerId taskerName location deliveryDestinationKey isTestOrder createdAt')
          .sort({ indomieRunAt: -1, scheduledFor: -1, createdAt: -1 })
          .lean(),
        IndomieBatch.find({ createdAt: sessionWindow }).sort({ windowStart: -1, createdAt: -1 }).lean(),
      ])

      return NextResponse.json({
        orders,
        batches,
        session: {
          ...serializeOrderSession(currentSession),
        },
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const search = searchParams.get('search')
    if (search) {
      filters.$or = [
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ]
    }

    const scope = searchParams.get('scope') === 'live' ? 'live' : 'all'
    const statusParam = searchParams.get('status')
    const statuses = statusParam && statusParam !== 'all'
      ? statusParam.split(',').map((value) => value.trim()).filter(Boolean)
      : []
    if (statuses.some((status) => !isAdminOrderStatus(status))) {
      return NextResponse.json({ error: 'Choose a valid order status.' }, { status: 400 })
    }
    if (scope === 'live') {
      const liveStatuses = statuses.length ? statuses : [...LIVE_ORDER_STATUSES]
      if (liveStatuses.some((status) => !(LIVE_ORDER_STATUSES as readonly string[]).includes(status))) {
        return NextResponse.json({ error: 'Completed and cancelled orders are not part of the Live workspace.' }, { status: 400 })
      }
      filters.status = { $in: liveStatuses }
    } else if (statuses.length) {
      filters.status = statuses.length === 1 ? statuses[0] : { $in: statuses }
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
      Order.find(applyCurrentSessionOrderScope(filters, currentSession))
        .select(ADMIN_ORDER_FIELDS)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(applyCurrentSessionOrderScope(filters, currentSession)),
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

    const totalPages = Math.max(1, Math.ceil(totalOrders / limit))

    return NextResponse.json({
      orders: ordersWithDetails,
      currentPage: page,
      totalPages,
      totalOrders,
      session: {
        ...serializeOrderSession(currentSession),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (error) {
    if (error instanceof NoActiveOrderSessionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('[GET /api/admin/orders]', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

