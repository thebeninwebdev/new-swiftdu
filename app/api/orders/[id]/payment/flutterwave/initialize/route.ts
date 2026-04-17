import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getAppBaseUrl, initializeFlutterwaveCheckout } from '@/lib/flutterwave'
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

    if (order.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this order' },
        { status: 403 }
      )
    }

    if (!order.taskerId) {
      return NextResponse.json(
        { error: 'A tasker must accept this order before payment starts.' },
        { status: 400 }
      )
    }

    if (order.hasPaid || order.paymentStatus === 'paid') {
      return NextResponse.json(
        { error: 'This order has already been paid for.' },
        { status: 400 }
      )
    }

    if (order.status === 'cancelled' || order.status === 'completed') {
      return NextResponse.json(
        { error: 'This order is no longer active.' },
        { status: 400 }
      )
    }

    const txRef = `swiftdu-${order._id.toString()}-${Date.now()}`
    const redirectUrl = `${getAppBaseUrl(request.nextUrl.origin)}/dashboard/tasks?orderId=${order._id.toString()}`
    const checkout = await initializeFlutterwaveCheckout({
      amount: order.totalAmount || order.amount,
      tx_ref: txRef,
      redirect_url: redirectUrl,
      customer: {
        email: session.user.email || `customer-${session.user.id}@swiftdu.local`,
        name: session.user.name || 'SwiftDU Customer',
      },
      customizations: {
        title: 'SwiftDU Task Payment',
        description: order.description,
      },
      meta: {
        orderId: order._id.toString(),
        userId: session.user.id,
      },
    })

    const checkoutUrl = checkout.data?.link

    if (!checkoutUrl) {
      throw new Error('Flutterwave did not return a checkout link.')
    }

    order.paymentProvider = 'flutterwave'
    order.paymentStatus = 'initialized'
    order.paymentReference = txRef
    order.paymentLink = checkoutUrl
    order.paymentTransactionId = undefined
    order.paymentInitializedAt = new Date()
    order.paymentVerifiedAt = undefined
    order.paymentFailureReason = undefined
    await order.save()

    return NextResponse.json({
      checkoutUrl,
      paymentReference: txRef,
    })
  } catch (error) {
    console.error('[POST /api/orders/[id]/payment/flutterwave/initialize]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to initialize Flutterwave checkout.',
      },
      { status: 500 }
    )
  }
}
