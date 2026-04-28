import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getAppBaseUrl, initializePaystackCheckout } from '@/lib/paystack-settlement'
import { getSettlementDueAt } from '@/lib/order-finance'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import { emitOrderUpdated } from '@/lib/socket'
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

    await syncTaskerSettlementStatus(String(session.user.taskerId))

    if (order.status !== 'completed') {
      return NextResponse.json(
        { error: 'Platform settlement becomes payable after the task is completed.' },
        { status: 400 }
      )
    }

    if (order.taskerHasPaid || order.settlementStatus === 'paid') {
      return NextResponse.json(
        { error: 'The platform settlement for this task has already been paid.' },
        { status: 400 }
      )
    }

    if (!order.platformFee || order.platformFee <= 0) {
      return NextResponse.json(
        { error: 'This order does not have a platform settlement amount.' },
        { status: 400 }
      )
    }

    const reference = `swiftdu-settlement-${order._id.toString()}-${Date.now()}`
    const callbackUrl = `${getAppBaseUrl(
      request.nextUrl.origin
    )}/api/orders/${order._id.toString()}/pay-platform-fee/callback`
    const fullName = String(session.user.name || 'Tasker').trim() || 'Tasker'

    const checkout = await initializePaystackCheckout({
      amount: Number(order.platformFee || 0),
      email: session.user.email || `tasker-${session.user.id}@swiftdu.local`,
      reference,
      customer_name: fullName,
      phone: session.user.phone || undefined,
      callback_url: callbackUrl,
      metadata: {
        orderId: order._id.toString(),
        taskerId: session.user.taskerId,
        taskerUserId: session.user.id,
        settlementType: 'platform_fee',
      },
    })

    const checkoutUrl = checkout.data?.authorization_url
    const accessCode = checkout.data?.access_code

    if (!checkoutUrl) {
      throw new Error('Paystack did not return a checkout URL.')
    }

    order.settlementProvider = 'paystack'
    order.settlementStatus = 'initialized'
    order.settlementReference = reference
    order.settlementAccessCode = accessCode || undefined
    order.settlementCheckoutUrl = checkoutUrl
    order.settlementTransactionId = undefined
    order.settlementInitializedAt = new Date()
    order.settlementDueAt =
      order.settlementDueAt || getSettlementDueAt(order.completedAt || new Date())
    order.settlementFailureReason = undefined
    await order.save()

    emitOrderUpdated(order)

    return NextResponse.json({
      checkoutUrl,
      reference,
    })
  } catch (error) {
    console.error('[POST /api/orders/[id]/pay-platform-fee]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize Paystack settlement.',
      },
      { status: 500 }
    )
  }
}
