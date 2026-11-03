import { type NextRequest } from 'next/server'
import { Types } from 'mongoose'

import { applyCurrentSessionOrderScope, getActiveAcademicSession, NoActiveOrderSessionError } from '@/lib/orders/order-session-scope'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { resolveSammyStaff, searchStaffCustomers, type TelegramIdentity } from '@/lib/sammy/staff'
import { Order } from '@/models/order'
import { User } from '@/models/user'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity; query?: unknown; customerId?: string }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })
    const query = String(body.query || '').trim()
    let orderFilter: Record<string, unknown> = {}
    if (body.customerId) {
      if (!Types.ObjectId.isValid(body.customerId)) throw new SammyApiError(400, 'INVALID_CUSTOMER', 'Choose a valid customer.')
      orderFilter.userId = body.customerId
    } else if (Types.ObjectId.isValid(query)) {
      orderFilter = { $or: [{ _id: new Types.ObjectId(query) }, { trackingToken: query }] }
    } else if (query) {
      const customers = await searchStaffCustomers(query, 5)
      const customerIds = customers.map(customer => customer.id)
      orderFilter = {
        $or: [
          { trackingToken: query },
          { userId: { $in: customerIds } },
          { customerPhone: { $regex: query.replace(/\D/g, '').slice(-10) + '$' } },
        ],
      }
    } else {
      throw new SammyApiError(400, 'INVALID_ORDER_SEARCH', 'Enter an order ID, tracking code, phone or email.')
    }

    let session
    try {
      session = await getActiveAcademicSession()
    } catch (error) {
      if (error instanceof NoActiveOrderSessionError) {
        throw new SammyApiError(409, 'NO_ACTIVE_SESSION', 'No academic session is active.')
      }
      throw error
    }
    const orders = await Order.find(applyCurrentSessionOrderScope(orderFilter, session))
      .sort({ createdAt: -1 })
      .limit(8)
      .select('_id userId trackingToken taskType status paymentStatus totalAmount createdAt customerName customerPhone source')
      .lean()
    const userIds = [...new Set(orders.map(order => order.userId))]
    const users = await User.find({ _id: { $in: userIds.filter(id => Types.ObjectId.isValid(id)) } })
      .select('_id name')
      .lean()
    const names = new Map(users.map(user => [String(user._id), user.name || 'Customer']))
    return {
      orders: orders.map(order => ({
        id: String(order._id),
        trackingCode: order.trackingToken,
        customerId: order.userId,
        customerName: order.customerName || names.get(order.userId) || 'Customer',
        customerPhone: order.customerPhone,
        service: order.taskType,
        status: order.status,
        payment: order.paymentStatus,
        total: Number(order.totalAmount || 0),
        createdAt: order.createdAt,
        source: order.source || 'website',
      })),
    }
  })
}
