import { type NextRequest } from 'next/server'

import { cancelCustomerOrder, CustomerCancellationError } from '@/lib/orders/customer-order'
import { findCurrentCustomerOrder, sammyTrackingUrl } from '@/lib/sammy/orders'
import { readSammyBody, resolveSammyCustomer, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string }>(request)
    const { user } = await resolveSammyCustomer(body.phone)
    const order = await findCurrentCustomerOrder(user)
    if (!order) return { cancelled: false, reason: 'You do not have an active order.', currentStatus: null, trackingUrl: null }
    try {
      await cancelCustomerOrder(order)
      return { cancelled: true, reason: null, currentStatus: order.status, trackingUrl: sammyTrackingUrl(order) }
    } catch (error) {
      if (error instanceof CustomerCancellationError) return { cancelled: false, reason: error.message, currentStatus: order.status, trackingUrl: sammyTrackingUrl(order) }
      throw error
    }
  })
}
