import type { IOrder } from '@/models/order'

/**
 * Training orders deliberately keep their platform-fee step after completion
 * so taskers can practise the settlement flow. Live orders retain the normal
 * fast-completion waiver.
 */
export function shouldWaivePlatformFeeForFastCompletion(order: {
  isTestOrder?: boolean | null
  platformFee?: number | null
}, completedBeforeTimer: boolean) {
  return order.isTestOrder !== true && completedBeforeTimer && Number(order.platformFee || 0) > 0
}

/**
 * Completes a settlement without a provider, but only for persisted training
 * orders. Keeping this separate from the Paystack verifier makes the bypass
 * impossible to accidentally apply to a live order.
 */
export function completeTrainingSettlement(order: IOrder, paidAt = new Date()) {
  if (order.isTestOrder !== true) {
    throw new Error('Training settlement is only available for test orders.')
  }

  if (order.status !== 'completed') {
    throw new Error('Platform settlement becomes payable after the task is completed.')
  }

  if (order.platformFee <= 0 || order.platformFeeWaivedForFastCompletion) {
    throw new Error('No platform settlement is due for this order.')
  }

  order.taskerHasPaid = true
  order.settlementProvider = undefined
  order.settlementStatus = 'paid'
  order.settlementReference = undefined
  order.settlementAccessCode = undefined
  order.settlementCheckoutUrl = undefined
  order.settlementTransactionId = undefined
  order.settlementInitializedAt = undefined
  order.settlementPaidAt = order.settlementPaidAt || paidAt
  order.settlementFailureReason = undefined
  order.settlementSimulation = true
  order.settlementSimulationAt = order.settlementSimulationAt || paidAt

  return order
}
