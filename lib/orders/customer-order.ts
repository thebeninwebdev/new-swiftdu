import { emitOrderUpdated } from '@/lib/socket'
import { saveOrderLifecycle } from '@/lib/first-order-bonus'
import { canCustomerCancelOrder } from '@/lib/order-status'
import { ensureBookedAt } from '@/lib/order-response-time'
import type { IOrder } from '@/models/order'
import { clearNonPayableSettlement } from '@/lib/settlement-state'

export class CustomerCancellationError extends Error {
  code = 'ORDER_NOT_CANCELLABLE' as const
}

export async function cancelCustomerOrder(order: IOrder) {
  if (!canCustomerCancelOrder(order)) {
    throw new CustomerCancellationError('This order can no longer be cancelled.')
  }

  ensureBookedAt(order)
  order.status = 'cancelled'
  order.cancelledAt = new Date()
  if (!order.hasPaid) order.paymentStatus = 'cancelled'
  clearNonPayableSettlement(order, true)

  await saveOrderLifecycle(order)
  emitOrderUpdated(order)
  return order
}
