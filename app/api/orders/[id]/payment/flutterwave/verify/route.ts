import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { verifyFlutterwavePayment } from '@/lib/flutterwave'
import { emitOrderUpdated } from '@/lib/socket'
import { Order } from '@/models/order'

function roundAmount(value: number) {
  return Math.round(value)
}

function isDevelopmentMode() {
  return process.env.NODE_ENV === 'development'
}

function isSuccessfulRedirectStatus(status?: string) {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  return normalizedStatus === 'successful' || normalizedStatus === 'completed'
}

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
    const { txRef, status, transactionId } = await request.json()
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

    const reference = String(txRef || order.paymentReference || '').trim()

    if (!reference) {
      return NextResponse.json(
        { error: 'Missing Flutterwave payment reference.' },
        { status: 400 }
      )
    }

    if (order.hasPaid && order.paymentStatus === 'paid') {
      return NextResponse.json({ order })
    }

    if (status && !isSuccessfulRedirectStatus(status)) {
      order.paymentStatus = status === 'cancelled' ? 'cancelled' : 'failed'
      order.paymentFailureReason = `Flutterwave returned ${status}.`
      order.paymentReference = reference
      await order.save()

      return NextResponse.json(
        { error: 'Payment was not completed on Flutterwave.' },
        { status: 400 }
      )
    }

    let resolvedTransactionId = String(transactionId || '')

    if (!isDevelopmentMode()) {
      const verification = await verifyFlutterwavePayment(reference)
      const verifiedPayment = verification.data

      if (!verifiedPayment) {
        throw new Error('Flutterwave verification returned no transaction data.')
      }

      const verifiedStatus = String(verifiedPayment.status || '').toLowerCase()
      const verifiedAmount = Number(verifiedPayment.amount || 0)
      const verifiedCurrency = String(verifiedPayment.currency || '').toUpperCase()

      if (
        verifiedStatus !== 'successful' ||
        verifiedCurrency !== 'NGN' ||
        roundAmount(verifiedAmount) !== roundAmount(order.totalAmount || order.amount)
      ) {
        order.paymentStatus = 'failed'
        order.paymentFailureReason = 'Flutterwave verification did not match the order total.'
        order.paymentReference = reference
        await order.save()

        return NextResponse.json(
          { error: 'Flutterwave payment verification failed.' },
          { status: 400 }
        )
      }

      resolvedTransactionId = String(transactionId || verifiedPayment.id || '')
    }

    order.hasPaid = true
    order.paymentProvider = 'flutterwave'
    order.paymentStatus = 'paid'
    order.paymentReference = reference
    order.paymentTransactionId = resolvedTransactionId || reference
    order.paymentVerifiedAt = new Date()
    order.paidAt = new Date()
    order.paymentFailureReason = undefined
    await order.save()

    emitOrderUpdated({
      _id: order._id.toString(),
      userId: order.userId,
      taskerId: order.taskerId,
      taskerName: order.taskerName,
      status: order.status,
      hasPaid: order.hasPaid,
    })

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[POST /api/orders/[id]/payment/flutterwave/verify]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify Flutterwave payment.',
      },
      { status: 500 }
    )
  }
}
