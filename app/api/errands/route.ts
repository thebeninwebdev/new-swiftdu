import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import Tasker from "@/models/tasker"
import { NextRequest, NextResponse } from 'next/server'
import { emitOrderUpdated } from '@/lib/socket'
import { ensureBookedAt } from '@/lib/order-response-time'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import { PREMIUM_TASKER_MIN_BUDGET, requiresPremiumTasker } from '@/lib/tasker-access'

export const dynamic = 'force-dynamic'

// GET - Fetch all pending errands for taskers
export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const taskType = request.nextUrl.searchParams.get('taskType')
    const location = request.nextUrl.searchParams.get('location')
    const status = request.nextUrl.searchParams.get('status')
    const taskerId = request.nextUrl.searchParams.get('taskerId')
    const viewerTaskerId = request.nextUrl.searchParams.get('viewerTaskerId')
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'createdAt'
    const accepted = request.nextUrl.searchParams.get('accepted')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {}

    if (accepted === 'true' && taskerId) {
      // Accepted errands for this tasker: in_progress or paid
      filter.taskerId = taskerId
      filter.status = { $in: ['in_progress', 'paid'] }
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

    if (taskerId) {
      filter.taskerId = taskerId
    }

    if (taskType && taskType !== 'all') {
      filter.taskType = taskType
    }

    if (location && location !== 'all') {
      filter.location = { $regex: location, $options: 'i' } // Case-insensitive search
    }

    if (accepted !== 'true' && viewerTaskerId) {
      const viewerTasker = await Tasker.findById(viewerTaskerId)
        .select('isPremium')
        .lean()

      if (viewerTasker && !viewerTasker.isPremium) {
        filter.amount = { $lt: PREMIUM_TASKER_MIN_BUDGET }
      }
    }

    // Fetch pending orders with sorting
    const orders = await Order.find(filter)
      .sort({ [sortBy]: -1 })
      .lean()

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

    const body = await request.json()
    const { orderId, taskerId, taskerName } = body

    if (!orderId || !taskerId) {
      return NextResponse.json(
        { error: 'orderId and taskerId are required' },
        { status: 400 }
      )
    }

    // Verify tasker exists and is verified
    const tasker = await Tasker.findOne({ userId: taskerId })

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

    if (requiresPremiumTasker(order.amount) && !tasker.isPremium) {
      return NextResponse.json(
        {
          error:
            'Only premium taskers can accept orders with a budget of N10,000 and above.',
        },
        { status: 403 }
      )
    }

    // Update order with tasker info
    // acceptedBy stays as the tasker's userId (for session-based matching)
    ensureBookedAt(order)
    order.acceptedBy = taskerId
    order.acceptedAt = new Date()
    order.status = 'in_progress'
    order.paymentProvider = 'manual_transfer'

    // taskerId should be tasker._id from the Tasker collection (not the userId)
    order.taskerId = tasker._id
    order.taskerName = taskerName || "Anonymous"

    const updatedOrder = await order.save()
    emitOrderUpdated(updatedOrder)

    return NextResponse.json(updatedOrder, { status: 200 })
  } catch (error) {
    console.error('POST /api/errands error:', error)
    return NextResponse.json(
      { error: 'Failed to accept errand' },
      { status: 500 }
    )
  }
}
