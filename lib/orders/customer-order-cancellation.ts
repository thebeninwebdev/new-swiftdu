import 'server-only'

import { saveOrderLifecycle } from '@/lib/first-order-bonus'
import { canCustomerCancelOrder } from '@/lib/order-status'
import { publishOrderUpdated } from '@/lib/socket'
import { Order } from '@/models/order'

export async function cancelCustomerOrder(userId: string, orderId: string) {
  const order = await Order.findOne({ _id: orderId, userId })
  if (!order) throw new Error('Order not found.')
  if (!canCustomerCancelOrder(order)) throw new Error('This order can no longer be cancelled.')
  order.status = 'cancelled'
  order.cancelledAt = new Date()
  if (!order.hasPaid) order.paymentStatus = 'cancelled'
  order.settlementStatus = 'not_due'
  order.settlementReference = undefined
  order.settlementAccessCode = undefined
  order.settlementCheckoutUrl = undefined
  order.settlementTransactionId = undefined
  order.settlementInitializedAt = undefined
  order.settlementPaidAt = undefined
  order.settlementDueAt = undefined
  order.settlementFailureReason = undefined
  await saveOrderLifecycle(order)
  await publishOrderUpdated(order)
  return order
}
