import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
  PendingSettlementVerificationError,
  verifyAndMarkOrderSettlementPaid,
} from '@/lib/settlement-payment'
import { emitOrderUpdated } from '@/lib/socket'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
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

    if (!session?.user?.taskerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { reference, transactionId } = await request.json()
    const order = await Order.findById(id)

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.taskerId !== session.user.taskerId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      )
    }

    const updatedOrder = await verifyAndMarkOrderSettlementPaid({
      order,
      reference,
      transactionId,
    })

    await syncTaskerSettlementStatus(String(session.user.taskerId))
    emitOrderUpdated(updatedOrder)

    return NextResponse.json({ order: updatedOrder })
  } catch (error) {
    if (error instanceof PendingSettlementVerificationError) {
      return NextResponse.json(
        {
          order: error.order,
          pending: true,
          error: error.message,
        },
        { status: 202 }
      )
    }

    console.error('[POST /api/orders/[id]/pay-platform-fee/verify]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify Flutterwave settlement.',
      },
      { status: 500 }
    )
  }
}
