export type SettlementEligibilityOrder = {
  status?: string | null
  platformFee?: number | null
  platformFeeWaivedForFastCompletion?: boolean | null
  taskerHasPaid?: boolean | null
  settlementStatus?: string | null
  settlementPaidAt?: Date | string | null
  settlementDueAt?: Date | string | null
  isTestOrder?: boolean | null
}

export function hasVerifiedSettlement(order: SettlementEligibilityOrder) {
  return Boolean(order.taskerHasPaid || order.settlementStatus === 'paid' || order.settlementPaidAt)
}

export function isOutstandingSettlement(order: SettlementEligibilityOrder) {
  return order.status === 'completed' &&
    Number(order.platformFee || 0) > 0 &&
    order.platformFeeWaivedForFastCompletion !== true &&
    !hasVerifiedSettlement(order)
}

export function isLiveSettlementObligation(order: SettlementEligibilityOrder) {
  return order.isTestOrder !== true && isOutstandingSettlement(order)
}

export function isAutomaticSettlementOverdue(
  order: SettlementEligibilityOrder,
  now: Date = new Date()
) {
  if (!isLiveSettlementObligation(order) || !order.settlementDueAt) return false
  const dueAt = new Date(order.settlementDueAt)
  return Number.isFinite(dueAt.getTime()) && dueAt.getTime() <= now.getTime()
}
