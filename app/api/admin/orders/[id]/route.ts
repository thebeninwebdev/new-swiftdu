import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { ensureBookedAt } from '@/lib/order-response-time'
import { Order } from '@/models/order'
import { emitOrderUpdated } from '@/lib/socket'
import {
  formatPushTaskType,
  sendPushNotification,
} from '@/lib/push-notifications'
import { consumeServiceFeeDiscountForCompletedOrder } from '@/lib/service-fee-discount'
import { shouldSendOrderNotification } from '@/lib/test-orders'

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

    if (!['cancel', 'complete', 'clear-declined'].includes(action)) {
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

    const previousStatus = order.status

    ensureBookedAt(order)

    const clearDeclinedTask = () => {
      order.isDeclinedTask = false
      order.declinedAt = undefined
      order.declinedReason = undefined
      order.declinedMessage = undefined
      order.declinedByTaskerAt = undefined
    }

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
    } else if (action === 'clear-declined') {
      if (!order.isDeclinedTask) {
        return NextResponse.json(
          { error: 'Only declined tasks can be cleared with this action.' },
          { status: 400 }
        )
      }

      clearDeclinedTask()
    }

    await order.save()

    emitOrderUpdated(order)

    if (previousStatus !== 'completed' && order.status === 'completed') {
      if (!order.isTestOrder) {
        await consumeServiceFeeDiscountForCompletedOrder(order)
      }

      if (shouldSendOrderNotification(order)) {
        const pushResult = await sendPushNotification({
          audience: { userIds: [String(order.userId)] },
          title: 'Task completed',
          body: `Your ${formatPushTaskType(
            order.taskType
          ).toLowerCase()} task is complete. Add a quick review.`,
          url: `/dashboard/reviews/${order._id.toString()}`,
          tag: `order-completed-${order._id.toString()}`,
        })

        if (pushResult.skipped || pushResult.deliveredCount < pushResult.recipientCount) {
          console.warn('[Admin Order Complete Push Notification]:', pushResult)
        }
      }
    }

    return NextResponse.json(order)

  } catch (error) {
    console.error('[PATCH /api/admin/orders/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
