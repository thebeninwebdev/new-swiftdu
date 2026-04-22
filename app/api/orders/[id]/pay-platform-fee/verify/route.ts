import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { getSettlementDueAt } from '@/lib/order-finance'
import { verifyPaystackTransaction } from '@/lib/paystack'
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
    const { reference } = await request.json()
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

    const resolvedReference = String(reference || order.settlementReference || '').trim()

    if (!resolvedReference) {
      return NextResponse.json(
        { error: 'Missing Paystack settlement reference.' },
        { status: 400 }
      )
    }

    if (order.taskerHasPaid && order.settlementStatus === 'paid') {
      return NextResponse.json({ order })
    }

    const verification = await verifyPaystackTransaction(resolvedReference)
    const transaction = verification.data

    if (!transaction) {
      throw new Error('Paystack verification returned no transaction data.')
    }

    const verifiedStatus = String(transaction.status || '').toLowerCase()
    const verifiedAmount = Number(transaction.amount || 0)
    const verifiedCurrency = String(transaction.currency || '').toUpperCase()
    const expectedAmount = Math.round((order.platformFee || 0) * 100)

    if (
      verifiedStatus !== 'success' ||
      verifiedCurrency !== 'NGN' ||
      verifiedAmount !== expectedAmount
    ) {
      order.settlementStatus = 'failed'
      order.settlementReference = resolvedReference
      order.settlementFailureReason =
        'Paystack verification did not match the expected settlement amount.'
      await order.save()

      return NextResponse.json(
        { error: 'Paystack settlement verification failed.' },
        { status: 400 }
      )
    }

    order.taskerHasPaid = true
    order.settlementProvider = 'paystack'
    order.settlementStatus = 'paid'
    order.settlementReference = resolvedReference
    order.settlementTransactionId = String(transaction.id || resolvedReference)
    order.settlementPaidAt = new Date(
      String(transaction.paid_at || transaction.paidAt || new Date().toISOString())
    )
    order.settlementDueAt =
      order.settlementDueAt || getSettlementDueAt(order.completedAt || new Date())
    order.settlementFailureReason = undefined
    await order.save()

    await syncTaskerSettlementStatus(String(session.user.taskerId))
    emitOrderUpdated(order)

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[POST /api/orders/[id]/pay-platform-fee/verify]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify Paystack settlement.',
      },
      { status: 500 }
    )
  }
}
