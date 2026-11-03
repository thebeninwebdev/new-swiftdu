import { type NextRequest } from 'next/server'
import { Types } from 'mongoose'

import { cancelCustomerOrder, CustomerCancellationError } from '@/lib/orders/customer-order'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'
import { Order } from '@/models/order'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })
    const { id } = await context.params
    if (!Types.ObjectId.isValid(id)) throw new SammyApiError(400, 'INVALID_ORDER', 'Choose a valid order.')
    const order = await Order.findById(id)
    if (!order) throw new SammyApiError(404, 'ORDER_NOT_FOUND', 'Order not found.')
    try {
      await cancelCustomerOrder(order)
      return { cancelled: true, status: order.status }
    } catch (error) {
      if (error instanceof CustomerCancellationError) {
        return { cancelled: false, status: order.status, reason: error.message }
      }
      throw error
    }
  })
}
