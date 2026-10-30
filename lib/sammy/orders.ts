import { getSiteUrl } from '@/lib/site'
import { ACTIVE_ORDER_STATUSES } from '@/lib/order-status'
import { applyCurrentSessionOrderScope, getActiveAcademicSession } from '@/lib/orders/order-session-scope'
import { shouldCreateTestOrder } from '@/lib/test-orders'
import { Order, type IOrder } from '@/models/order'

export function sammyTrackingUrl(order: { _id: unknown }) {
  return `${getSiteUrl()}/dashboard/tasks/${String(order._id)}`
}

export function compactSammyOrder(order: Pick<IOrder, '_id' | 'taskType' | 'status' | 'description' | 'location' | 'totalAmount' | 'paymentStatus'>) {
  return {
    _id: String(order._id),
    taskType: order.taskType,
    status: order.status,
    description: order.description || '',
    location: order.location,
    totalAmount: Number(order.totalAmount || 0),
    paymentStatus: order.paymentStatus,
    trackingUrl: sammyTrackingUrl(order),
  }
}

export async function findCurrentCustomerOrder(user: { _id: unknown; isExco?: boolean; excoRole?: string; testOrderMode?: boolean }) {
  const currentSession = await getActiveAcademicSession()
  const query = applyCurrentSessionOrderScope({
    userId: String(user._id),
    status: { $in: [...ACTIVE_ORDER_STATUSES] },
    isTestOrder: shouldCreateTestOrder(user) ? true : { $ne: true },
  }, currentSession)
  return Order.findOne(query).sort({ createdAt: -1 })
}
