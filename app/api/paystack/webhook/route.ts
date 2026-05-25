import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

import { connectDB } from '@/lib/db'
import { emitOrderUpdated } from '@/lib/socket'
import { verifyAndMarkOrderSettlementPaid } from '@/lib/settlement-payment'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'
import { Order } from '@/models/order'

interface PaystackWebhookPayload {
  event?: string
  data?: {
    id?: string | number
    reference?: string
  }
}

function isValidPaystackSignature(body: string, signature: string | null) {
  const secretKey =
    process.env.PAYSTACK_SECRET_KEY?.trim() || process.env.PAYSTACK_SECRET?.trim()

  if (!secretKey || !signature) {
    return false
  }

  const expected = createHmac('sha512', secretKey).update(body).digest('hex')
  const signatureBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  )
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-paystack-signature')

  if (!isValidPaystackSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: PaystackWebhookPayload

  try {
    payload = JSON.parse(body) as PaystackWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const reference = String(payload.data?.reference || '').trim()

  if (payload.event !== 'charge.success' || !reference.startsWith('swiftdu-settlement-')) {
    return NextResponse.json({ received: true })
  }

  await connectDB()

  const order = await Order.findOne({ settlementReference: reference })

  if (!order) {
    return NextResponse.json({ received: true })
  }

  const updatedOrder = await verifyAndMarkOrderSettlementPaid({
    order,
    reference,
    transactionId: payload.data?.id,
  })

  if (updatedOrder.taskerId) {
    await syncTaskerSettlementStatus(String(updatedOrder.taskerId))
  }

  emitOrderUpdated(updatedOrder)

  return NextResponse.json({ received: true })
}
