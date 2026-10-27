import { releaseCancelledBonus } from '@/lib/first-order-bonus'
import { emitOrderUpdated } from '@/lib/socket'
import { TASKER_SEARCH_TIMEOUT_MS } from '@/lib/order-tracking'
import { Order } from '@/models/order'

type ExpiryFilterOptions = { orderId?: string; userId?: string; now?: Date }

/**
 * The single database-side definition of an unmatched order whose tasker
 * search may time out. Keep this aligned with isTaskerSearchExpired: the
 * createdAt fallback is deliberately limited to unscheduled legacy orders.
 */
export function unmatchedOrderExpiryFilter({ orderId, userId, now = new Date() }: ExpiryFilterOptions = {}) {
  const cutoff = new Date(now.getTime() - TASKER_SEARCH_TIMEOUT_MS)
  return {
    ...(orderId ? { _id: orderId } : {}),
    ...(userId ? { userId } : {}),
    status: 'pending',
    hasPaid: { $ne: true },
    paymentStatus: { $ne: 'paid' },
    cafeInquiryFeePaid: { $ne: true },
    taskerId: { $in: [null, ''] },
    batchingStatus: { $ne: 'waiting' },
    cafeInquiryStatus: { $in: [null, 'waiting_for_tasker'] },
    $or: [
      { taskerSearchStartedAt: { $lte: cutoff } },
      {
        taskerSearchStartedAt: { $exists: false },
        createdAt: { $lte: cutoff },
        $or: [{ scheduledFor: { $exists: false } }, { scheduledFor: null }],
      },
    ],
  }
}

export async function expireUnmatchedOrder(orderId: string, userId?: string, now = new Date()) {
  const cancelledAt = now
  const order = await Order.findOneAndUpdate(
    unmatchedOrderExpiryFilter({ orderId, userId, now: cancelledAt }),
    {
      $set: {
        status: 'cancelled',
        cancellationReason: 'tasker_search_timeout',
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
  if (order) { await releaseCancelledBonus(order); emitOrderUpdated(order) }
  return order
}

/** Server-owned cleanup. Per-order transitions retain bonus and socket effects. */
export async function expireStaleUnmatchedOrders(now = new Date()) {
  const candidates = await Order.find(unmatchedOrderExpiryFilter({ now })).select('_id').lean()
  let expired = 0
  for (const candidate of candidates) {
    if (await expireUnmatchedOrder(String(candidate._id), undefined, now)) expired += 1
  }
  const result = { candidates: candidates.length, expired, skipped: candidates.length - expired }
  console.info(`Order expiry cleanup: candidates=${result.candidates} expired=${result.expired} skipped=${result.skipped}`)
  return result
}
