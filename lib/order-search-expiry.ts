import { emitOrderUpdated } from '@/lib/socket'
import { TASKER_SEARCH_TIMEOUT_MS } from '@/lib/order-tracking'
import { Order } from '@/models/order'

export async function expireUnmatchedOrder(orderId: string, userId: string) {
  const cancelledAt = new Date()
  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      userId,
      status: 'pending',
      taskerId: { $in: [null, ''] },
      cafeInquiryStatus: { $in: [null, 'waiting_for_tasker'] },
      createdAt: { $lte: new Date(cancelledAt.getTime() - TASKER_SEARCH_TIMEOUT_MS) },
    },
    {
      $set: {
        status: 'cancelled',
        cancelledAt,
        paymentStatus: 'cancelled',
        settlementStatus: 'not_due',
      },
      $unset: {
        settlementReference: 1,
        settlementAccessCode: 1,
        settlementCheckoutUrl: 1,
        settlementTransactionId: 1,
        settlementInitializedAt: 1,
        settlementPaidAt: 1,
        settlementDueAt: 1,
        settlementFailureReason: 1,
      },
    },
    { new: true },
  )
  if (order) emitOrderUpdated(order)
  return order
}
