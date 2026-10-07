import { getCompletionWindowMinutes } from './completion-timer'
import { Order, type IOrder } from '../models/order'

// Resolve only this assigned order. A newer task is never read or mutated here.
export async function resolvePaymentDispute(order: IOrder, taskerId: string) {
  const receivedAt = new Date()
  const windowMinutes = getCompletionWindowMinutes(order.location, order.taskType, order.isTestOrder)
  return Order.findOneAndUpdate(
    {
      _id: order._id, taskerId, updatedAt: order.updatedAt,
      status: { $in: ['in_progress', 'paid'] },
      isDeclinedTask: true,
    },
    {
      $set: {
        isDeclinedTask: false,
        hasPaid: true,
        paymentStatus: 'paid',
        paymentVerifiedAt: receivedAt,
        paidAt: receivedAt,
        paymentEventuallyReceivedAt: receivedAt,
        paymentDisputeResolvedAt: receivedAt,
        paymentDisputeResolution: 'tasker_confirmed_received',
        completionTimerStartedAt: receivedAt,
        completionWindowMinutes: windowMinutes,
        completionExtensionMinutes: 0,
        completionDueAt: new Date(receivedAt.getTime() + windowMinutes * 60_000),
        completedBeforeTimer: false,
        platformFeeWaivedForFastCompletion: false,
      },
      // Keep declinedAt, declinedByTaskerAt, reason, message and transfer timestamp as history.
      $unset: { paymentFailureReason: 1, completionExtendedAt: 1 },
    },
    { new: true, runValidators: true },
  )
}
