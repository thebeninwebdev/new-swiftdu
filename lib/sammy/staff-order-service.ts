import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import type { BackgroundScheduler } from '@/lib/order-creation-background'
import type { SammyOrderDraft } from '@/lib/sammy/contracts'
import { createOrderResponse } from '@/lib/orders/order-route-service'
import { compactSammyOrder } from '@/lib/sammy/orders'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { getStaffCustomerRecord, resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'

function correlationId(request: NextRequest) {
  const supplied = request.headers.get('x-swiftdu-correlation-id') || ''
  return /^[a-f0-9-]{16,64}$/i.test(supplied) ? supplied : randomUUID()
}

export async function handleSammyStaffOrder(request: NextRequest, scheduleBackground?: BackgroundScheduler) {
  const correlation = correlationId(request)
  const startedAt = performance.now()
  return withSammy(request, async () => {
    console.info('[Sammy order create]', { correlation, checkpoint: 'request_received' })
    const body = await readSammyBody<{
      telegram?: TelegramIdentity
      customerId?: string
      idempotencyKey?: string
      contactMethod?: 'whatsapp' | 'phone' | 'telegram_staff'
      order?: SammyOrderDraft
    }>(request)
    const staff = await resolveSammyStaff(body.telegram || { id: '' })
    console.info('[Sammy order create]', { correlation, checkpoint: 'staff_authorized', durationMs: Math.round(performance.now() - startedAt) })
    const idempotencyKey = String(body.idempotencyKey || '').trim()
    if (!body.customerId || !body.order) throw new SammyApiError(400, 'INVALID_DRAFT', 'Customer and order draft are required.')
    if (idempotencyKey.length < 12 || idempotencyKey.length > 200) {
      throw new SammyApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'A stable confirmation ID is required.')
    }
    const forbidden = body.order as SammyOrderDraft & {
      serviceFee?: unknown; platformFee?: unknown; taskerFee?: unknown; totalAmount?: unknown; userId?: unknown
    }
    if ('serviceFee' in forbidden || 'platformFee' in forbidden || 'taskerFee' in forbidden || 'totalAmount' in forbidden || 'userId' in forbidden) {
      throw new SammyApiError(400, 'SERVER_OWNED_FIELD', 'Identity, fees and totals are resolved by SwiftDU.')
    }

    const customer = await getStaffCustomerRecord(body.customerId)
    const whatsAppPhone = Array.isArray(customer.phones)
      ? (customer.phones as Array<{ type?: string; number?: string }>).find((phone) => phone.type === 'whatsapp')?.number
      : undefined
    console.info('[Sammy order create]', { correlation, checkpoint: 'customer_validated', durationMs: Math.round(performance.now() - startedAt) })
    const internalRequest = new NextRequest(new URL('/api/orders', request.url), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'x-swiftdu-correlation-id': correlation,
      },
      body: JSON.stringify(body.order),
    })
    const response = await createOrderResponse(internalRequest, {
      principal: {
        id: String(customer._id),
        name: customer.name,
        email: customer.email,
        role: customer.role,
        taskerId: customer.taskerId,
      },
      source: 'telegram_staff',
      customerPhone: whatsAppPhone || customer.phone,
      customerName: customer.name,
      customerContactMethod: body.contactMethod || 'whatsapp',
      createdByStaffId: String(staff._id),
      createdByStaffTelegramId: staff.telegramUserId,
      createdByStaffName: staff.name || staff.telegramFirstName,
      scheduleBackground,
    })
    const payload = await response.json()
    console.info('[Sammy order create]', { correlation, checkpoint: response.ok ? 'response_returned' : 'response_failed', status: response.status, durationMs: Math.round(performance.now() - startedAt) })
    if (!response.ok) return NextResponse.json(payload, { status: response.status })
    return NextResponse.json(compactSammyOrder(payload), { status: response.status })
  })
}