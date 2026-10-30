import { NextRequest, NextResponse } from 'next/server'

import { createOrderResponse } from '@/lib/orders/order-route-service'
import type { SammyOrderRequest } from '@/lib/sammy/contracts'
import { assertSammyOrderRequest } from '@/lib/sammy/input'
import { compactSammyOrder } from '@/lib/sammy/orders'
import { readSammyBody, resolveSammyCustomer, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = assertSammyOrderRequest(await readSammyBody<SammyOrderRequest & Record<string, unknown>>(request))
    const { phone, user } = await resolveSammyCustomer(body.phone)

    const internalRequest = new NextRequest(new URL('/api/orders', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': body.idempotencyKey.trim() },
      body: JSON.stringify(body.order),
    })
    const response = await createOrderResponse(internalRequest, {
      principal: { id: String(user._id), name: user.name, email: user.email, role: user.role, taskerId: user.taskerId },
      source: 'whatsapp', customerPhone: phone, customerName: user.name || undefined,
    })
    const payload = await response.json()
    if (!response.ok) return NextResponse.json(payload, { status: response.status })
    return NextResponse.json(compactSammyOrder(payload), { status: response.status })
  })
}
