import { NextRequest, NextResponse } from 'next/server'

import { connectDB } from '@/lib/db'
import { getAppBaseUrl } from '@/lib/flutterwave'
import {
  PendingSettlementVerificationError,
  verifyAndMarkOrderSettlementPaid,
} from '@/lib/settlement-payment'
import { emitOrderUpdated } from '@/lib/socket'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import { Order } from '@/models/order'

function buildPaymentPageUrl(request: NextRequest, orderId: string) {
  return new URL(
    `/tasker-dashboard/payment/${orderId}`,
    getAppBaseUrl(request.nextUrl.origin)
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB()

  const { id } = await params
  const redirectUrl = buildPaymentPageUrl(request, id)
  const status = String(request.nextUrl.searchParams.get('status') || '').toLowerCase()
  const reference = String(
    request.nextUrl.searchParams.get('tx_ref') ||
      request.nextUrl.searchParams.get('reference') ||
      ''
  ).trim()
  const transactionId = String(
    request.nextUrl.searchParams.get('transaction_id') || ''
  ).trim()

  if (status && status !== 'successful' && status !== 'pending') {
    redirectUrl.searchParams.set(
      'settlement',
      status === 'cancelled' ? 'cancelled' : 'failed'
    )
    redirectUrl.searchParams.set(
      'message',
      status === 'cancelled'
        ? 'Flutterwave checkout was cancelled.'
        : 'Flutterwave payment was not successful.'
    )

    return NextResponse.redirect(redirectUrl)
  }

  const order = await Order.findById(id)

  if (!order) {
    redirectUrl.searchParams.set('settlement', 'failed')
    redirectUrl.searchParams.set('message', 'Order not found.')
    return NextResponse.redirect(redirectUrl)
  }

  try {
    const updatedOrder = await verifyAndMarkOrderSettlementPaid({
      order,
      reference,
      transactionId,
    })

    if (updatedOrder.taskerId) {
      await syncTaskerSettlementStatus(String(updatedOrder.taskerId))
    }

    emitOrderUpdated(updatedOrder)

    redirectUrl.searchParams.set('settlement', 'paid')
    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    if (error instanceof PendingSettlementVerificationError) {
      if (reference) {
        redirectUrl.searchParams.set('reference', reference)
      }

      if (transactionId) {
        redirectUrl.searchParams.set('transaction_id', transactionId)
      }

      redirectUrl.searchParams.set('status', 'pending')
      return NextResponse.redirect(redirectUrl)
    }

    console.error('[GET /api/orders/[id]/pay-platform-fee/callback]', error)

    redirectUrl.searchParams.set('settlement', 'failed')
    redirectUrl.searchParams.set(
      'message',
      error instanceof Error
        ? error.message
        : 'Failed to verify Flutterwave settlement.'
    )

    return NextResponse.redirect(redirectUrl)
  }
}
