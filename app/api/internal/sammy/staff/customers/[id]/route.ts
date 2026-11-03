import { type NextRequest } from 'next/server'

import { Order } from '@/models/order'
import { compactSammyOrder } from '@/lib/sammy/orders'
import { getStaffCustomer, resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'
import { readSammyBody, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })
    const { id } = await context.params
    const customer = await getStaffCustomer(id)
    const recentOrders = await Order.find({ userId: id })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('_id taskType status description location totalAmount paymentStatus')
      .lean()
    return { customer, recentOrders: recentOrders.map(order => compactSammyOrder(order)) }
  })
}
