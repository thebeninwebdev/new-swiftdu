import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import Tasker from "@/models/tasker"
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { emitOrderUpdated } from '@/lib/socket'
import { ensureCompletionTimer } from '@/lib/completion-timer'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications'
import { sendWhatsAppText } from '@/lib/whatsapp/send-message'
import {
  getTaskerMode,
  getTaskerOrderModeFilter,
  shouldSendOrderNotification,
} from '@/lib/test-orders'

export const dynamic = 'force-dynamic'

const ERRAND_LIST_FIELDS = [
  'userId',
  'taskType',
  'description',
  'amount',
  'commission',
  'platformFee',
  'taskerFee',
  'serviceFeeDiscountApplied',
  'serviceFeeDiscountGrantedByName',
  'serviceFeeDiscountGrantedByPhone',
  'discountCommissionAmount',
  'totalAmount',
  'dueDate',
  'deadline',
  'deadlineDate',
  'location',
  'store',
  'packaging',
  'restaurantPeopleCount',
  'restaurantTakeawayCount',
  'restaurantPackagingFee',
  'indomiePacks',
  'eggCount',
  'status',
  'taskerId',
  'acceptedBy',
  'acceptedAt',
  'completionTimerStartedAt',
  'completionDueAt',
  'completionWindowMinutes',
  'completionExtensionMinutes',
  'completedBeforeTimer',
  'platformFeeWaivedForFastCompletion',
  'prematureCompletionReported',
  'hasPaid',
  'isDeclinedTask',
  'isTestOrder',
  'createdInMode',
  'createdAt',
].join(' ')

const allowedSortFields = new Set([
  'acceptedAt',
  'bookedAt',
  'createdAt',
  'deadline',
  'deadlineDate',
  'dueDate',
  'updatedAt',
])

// GET - Fetch all pending errands for taskers
export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const taskType = request.nextUrl.searchParams.get('taskType')
    const location = request.nextUrl.searchParams.get('location')
    const status = request.nextUrl.searchParams.get('status')
    const taskerId = request.nextUrl.searchParams.get('taskerId')
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'createdAt'
    const accepted = request.nextUrl.searchParams.get('accepted')
    const available = request.nextUrl.searchParams.get('available')
    const fast = request.nextUrl.searchParams.get('fast') === 'true'
    const limit = Math.max(0, Number(request.nextUrl.searchParams.get('limit') || 0))
    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : 'createdAt'
    const taskerForMode = taskerId
      ? await Tasker.findById(taskerId).select('taskerMode isVerified').lean()
      : null

    // Keep the mode filter in $and so later available-task $or clauses cannot replace it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {
      $and: [getTaskerOrderModeFilter(taskerForMode || undefined)],
    }

    if (accepted === 'true' && taskerId) {
      // Accepted errands for this tasker: in_progress or paid
      filter.taskerId = taskerId
      filter.status = { $in: ['in_progress', 'paid'] }
    } else if (available === 'true') {
      filter.$or = [
        {
          status: 'pending',
          $or: [
            { taskerId: { $exists: false } },
            { taskerId: null },
            { taskerId: '' },
          ],
        },
        taskerId
          ? {
              status: 'in_progress',
              taskerId: { $nin: [taskerId, null, ''] },
            }
          : {
              status: 'in_progress',
            },
      ]
    } else if (status) {
      const statuses = status.split(',').map((s) => s.trim())
      if (statuses.length === 1) {
        filter.status = statuses[0]
      } else if (statuses.length > 1) {
        filter.status = { $in: statuses }
      }
    } else {
      filter.status = 'pending'
    }

    if (taskerId && accepted !== 'true' && available !== 'true') {
      filter.taskerId = taskerId
    }

    if (taskType && taskType !== 'all') {
      filter.taskType = taskType
    }

    if (location && location !== 'all') {
      filter.location = { $regex: location, $options: 'i' } // Case-insensitive search
    }

    // Fetch only the fields the tasker dashboard cards need.
    let ordersQuery = Order.find(filter)
      .select(ERRAND_LIST_FIELDS)
      .sort({ [safeSortBy]: -1 })

    if (limit > 0) {
      ordersQuery = ordersQuery.limit(limit)
    }

    const orders = accepted === 'true' && !fast
      ? await ordersQuery
      : await ordersQuery.lean()

    if (accepted === 'true' && !fast) {
      await Promise.all(
        orders.map(async (order) => {
          if (ensureCompletionTimer(order)) {
            await order.save()
            emitOrderUpdated(order)
          }
        })
      )
    }

    return NextResponse.json(orders, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    console.error('GET /api/errands error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch errands' },
      { status: 500 }
    )
  }
}

// POST - Accept an errand (for taskers)
export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orderId, taskerName } = body

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      )
    }

    // Verify tasker exists and is verified
    const tasker = await Tasker.findOne({ userId: session.user.id })

    if (!tasker) {
      return NextResponse.json(
        { error: 'Tasker profile not found' },
        { status: 404 }
      )
    }

    if (!tasker.isVerified) {
      return NextResponse.json(
        { error: 'You must be verified to accept errands' },
        { status: 403 }
      )
    }

    if (tasker.isRejected) {
      return NextResponse.json(
        { error: 'Your tasker account has been rejected' },
        { status: 403 }
      )
    }

    const settlementStatus = await syncTaskerSettlementStatus(tasker._id.toString())

    if (settlementStatus.isSettlementSuspended || tasker.isSettlementSuspended) {
      return NextResponse.json(
        {
          error:
            'Your tasker account is temporarily suspended because a previous platform settlement is overdue.',
        },
        { status: 403 }
      )
    }

    // Find and update the order
    const order = await Order.findById(orderId)

    if (!order) {
      return NextResponse.json(
        { error: 'Errand not found' },
        { status: 404 }
      )
    }

    if (
      order.status !== 'pending'
    ) {
      return NextResponse.json(
        { error: 'This errand has already been accepted or completed' },
        { status: 409 }
      )
    }

    const taskerMode = getTaskerMode(tasker)
    if (
      (taskerMode === 'training' && order.isTestOrder !== true) ||
      (taskerMode === 'live' && order.isTestOrder === true)
    ) {
      return NextResponse.json(
        { error: 'This errand is not available in your current tasker mode.' },
        { status: 403 }
      )
    }

    const acceptedAt = new Date()

    const updatedOrder = await Order.findOneAndUpdate(
      {
        _id: orderId,
        status: 'pending',
        ...getTaskerOrderModeFilter(tasker),
      },
      {
        $set: {
          acceptedBy: session.user.id,
          acceptedAt,
          bookedAt: order.bookedAt || acceptedAt,
          status: 'in_progress',
          paymentProvider: 'manual_transfer',
          taskerId: tasker._id.toString(),
          taskerName: taskerName || session.user.name || 'Anonymous',
        },
      },
      { new: true }
    )

    if (!updatedOrder) {
      return NextResponse.json(
        { error: 'This errand has already been accepted or completed' },
        { status: 409 }
      )
    }

    emitOrderUpdated(updatedOrder)

    if (shouldSendOrderNotification(updatedOrder)) {
      const pushResult = await sendPushNotification({
        audience: { userIds: [String(updatedOrder.userId)] },
        title: 'Your task has been accepted',
        body: `${updatedOrder.taskerName || 'A tasker'} accepted your ${formatPushTaskType(
          updatedOrder.taskType
        ).toLowerCase()} task.`,
        url: '/dashboard/tasks',
        tag: `order-accepted-${updatedOrder._id.toString()}`,
      })

      if (pushResult.skipped || pushResult.deliveredCount < pushResult.recipientCount) {
        console.warn('[Errands Accept Push Notification]:', pushResult)
      }
    }

    if (updatedOrder.source === 'whatsapp' && updatedOrder.customerPhone && shouldSendOrderNotification(updatedOrder)) {
      try {
        await sendWhatsAppText(
          updatedOrder.customerPhone,
          `${updatedOrder.taskerName || 'A tasker'} has accepted your SwiftDU order.

Please stay close to WhatsApp. SwiftDU will contact you with the next step.`
        )
      } catch (whatsAppError) {
        console.error('[Errands Accept WhatsApp Notification]:', whatsAppError)
      }
    }

    return NextResponse.json(updatedOrder, { status: 200 })
  } catch (error) {
    console.error('POST /api/errands error:', error)
    return NextResponse.json(
      { error: 'Failed to accept errand' },
      { status: 500 }
    )
  }
}
