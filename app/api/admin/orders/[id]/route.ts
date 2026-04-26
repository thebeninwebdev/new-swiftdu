import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ensureBookedAt } from '@/lib/order-response-time'
import { Order } from '@/models/order'
import { emitOrderUpdated } from '@/lib/socket'

// ─── PATCH /api/admin/orders/[id] ───────────────────────────────────────────
// Update order status (cancel, complete).
// Restricted to admin role only.

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin auth check
    // const session = await authClient.getSession()
    // const user = session?.data?.user
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()

    const { id } = await context.params;
    const { action } = await req.json()

    if (!['cancel', 'complete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const order = await Order.findById(id)

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    ensureBookedAt(order)

    if (action === 'cancel') {
      order.status = 'cancelled'
      order.cancelledAt = new Date()
      if (!order.hasPaid) {
        order.paymentStatus = 'cancelled'
      }
      order.settlementStatus = 'not_due'
      order.settlementReference = undefined
      order.settlementAccessCode = undefined
      order.settlementCheckoutUrl = undefined
      order.settlementTransactionId = undefined
      order.settlementInitializedAt = undefined
      order.settlementPaidAt = undefined
      order.settlementDueAt = undefined
      order.settlementFailureReason = undefined
    } else if (action === 'complete') {
      order.status = 'completed'
      order.completedAt = new Date()
    }

    await order.save()

    emitOrderUpdated(order)

    return NextResponse.json(order)

  } catch (error) {
    console.error('[PATCH /api/admin/orders/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
