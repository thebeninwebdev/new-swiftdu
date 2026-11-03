import { NextRequest, NextResponse } from 'next/server'

import type { SammyOrderDraft } from '@/lib/sammy/contracts'
import { createOrderResponse } from '@/lib/orders/order-route-service'
import { compactSammyOrder } from '@/lib/sammy/orders'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { getStaffCustomer, getStaffCustomerRecord, resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{
      telegram?: TelegramIdentity
      customerId?: string
      idempotencyKey?: string
      contactMethod?: 'whatsapp' | 'phone' | 'telegram_staff'
      order?: SammyOrderDraft
    }>(request)
    const staff = await resolveSammyStaff(body.telegram || { id: '' })
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

    const [customer, card] = await Promise.all([
      getStaffCustomerRecord(body.customerId),
      getStaffCustomer(body.customerId),
    ])
    const internalRequest = new NextRequest(new URL('/api/orders', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
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
      customerPhone: card.whatsapp || card.phone,
      customerName: card.name,
      customerContactMethod: body.contactMethod || 'whatsapp',
      createdByStaffId: String(staff._id),
      createdByStaffTelegramId: staff.telegramUserId,
      createdByStaffName: staff.name || staff.telegramFirstName,
    })
    const payload = await response.json()
    if (!response.ok) return NextResponse.json(payload, { status: response.status })
    return NextResponse.json(compactSammyOrder(payload), { status: response.status })
  })
}
