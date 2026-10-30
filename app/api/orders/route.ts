import { type NextRequest } from 'next/server'

import { createOrderResponse, GET } from '@/lib/orders/order-route-service'

export { GET }

export async function POST(request: NextRequest) {
  return createOrderResponse(request)
}
