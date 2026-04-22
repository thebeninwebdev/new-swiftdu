import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { emitOrderUpdated } from '@/lib/socket'
import { Order } from '@/models/order'
import { DECLINED_TRANSFER_MESSAGE } from '@/lib/tasker-access'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const order = await Order.findById(id)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      )
    }

    if (!order.taskerId) {
      return NextResponse.json(
        { error: 'A tasker must accept this order before you can confirm a transfer.' },
        { status: 400 }
      )
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json(
        { error: 'This order is no longer active.' },
        { status: 400 }
      )
    }

    if (order.isDeclinedTask) {
      return NextResponse.json(
        { error: order.declinedMessage || DECLINED_TRANSFER_MESSAGE },
        { status: 400 }
      )
    }

    if (order.hasPaid && order.paymentStatus === 'paid') {
      return NextResponse.json({ order })
    }

    order.hasPaid = true
    order.isDeclinedTask = false
    order.declinedAt = undefined
    order.declinedReason = undefined
    order.declinedMessage = undefined
    order.declinedByTaskerAt = undefined
    order.paymentProvider = 'manual_transfer'
    order.paymentStatus = 'paid'
    order.paymentVerifiedAt = new Date()
    order.customerTransferredAt = new Date()
    order.paidAt = new Date()
    order.paymentFailureReason = undefined
    await order.save()

    emitOrderUpdated(order)

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[POST /api/orders/[id]/confirm-transfer]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to confirm tasker transfer.',
      },
      { status: 500 }
    )
  }
}
