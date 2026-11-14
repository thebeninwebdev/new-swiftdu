import { getEffectivePlatformFee } from '@/lib/order-finance'
import { hasVerifiedSettlement, type SettlementEligibilityOrder } from '@/lib/settlement-eligibility'

export type MutableSettlementOrder = SettlementEligibilityOrder & {
  settlementProvider?: 'paystack' | 'flutterwave'
  settlementReference?: string
  settlementAccessCode?: string
  settlementCheckoutUrl?: string
  settlementTransactionId?: string
  settlementInitializedAt?: Date
  settlementFailureReason?: string
}

export function clearNonPayableSettlement(order: MutableSettlementOrder, forceNoObligation = false) {
  if ((!forceNoObligation && getEffectivePlatformFee(order) > 0) || hasVerifiedSettlement(order)) return false
  order.settlementStatus = 'not_due'
  order.settlementDueAt = undefined
  order.settlementFailureReason = undefined
  order.settlementProvider = undefined
  order.settlementReference = undefined
  order.settlementAccessCode = undefined
  order.settlementCheckoutUrl = undefined
  order.settlementTransactionId = undefined
  order.settlementInitializedAt = undefined
  return true
}
