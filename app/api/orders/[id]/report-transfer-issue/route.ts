import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { emitOrderUpdated } from '@/lib/socket'
import { DECLINED_TRANSFER_MESSAGE } from '@/lib/tasker-access'
import { Order } from '@/models/order'

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

    if (!session.user.taskerId || order.taskerId !== session.user.taskerId) {
      return NextResponse.json(
        { error: 'Only the assigned tasker can report a transfer issue.' },
        { status: 403 }
      )
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json(
        { error: 'This order is no longer active.' },
        { status: 400 }
      )
    }

    if (!order.hasPaid && order.paymentStatus !== 'paid') {
      return NextResponse.json(
        { error: 'The customer has not marked this transfer as sent yet.' },
        { status: 400 }
      )
    }

    if (order.isDeclinedTask) {
      return NextResponse.json({ order })
    }

    order.hasPaid = false
    order.paidAt = undefined
    order.paymentStatus = 'failed'
    order.paymentVerifiedAt = undefined
    order.paymentFailureReason = DECLINED_TRANSFER_MESSAGE
    order.isDeclinedTask = true
    order.declinedAt = new Date()
    order.declinedByTaskerAt = new Date()
    order.declinedReason = 'transaction_not_found'
    order.declinedMessage = DECLINED_TRANSFER_MESSAGE

    await order.save()

    emitOrderUpdated(order)

    return NextResponse.json({
      message: DECLINED_TRANSFER_MESSAGE,
      order,
    })
  } catch (error) {
    console.error('[POST /api/orders/[id]/report-transfer-issue]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to report the transfer issue.',
      },
      { status: 500 }
    )
  }
}
