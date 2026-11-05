import { type NextRequest } from 'next/server'

import { Order } from '@/models/order'
import { compactSammyOrder } from '@/lib/sammy/orders'
import { getStaffCustomer, resolveSammyStaff, updateStaffCustomer, type TelegramIdentity } from '@/lib/sammy/staff'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'

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

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity; email?: unknown; roomNumber?: unknown; clearRoomNumber?: unknown }>(request)
    const allowed = ['telegram', 'email', 'roomNumber', 'clearRoomNumber']
    if (Object.keys(body).some(key => !allowed.includes(key))) throw new SammyApiError(400, 'INVALID_CUSTOMER_UPDATE', 'Unsupported customer update fields.')
    const staff = await resolveSammyStaff(body.telegram || { id: '' })
    const { id } = await context.params
    return updateStaffCustomer(id, { email: body.email, roomNumber: body.roomNumber, clearRoomNumber: body.clearRoomNumber }, staff)
  })
}