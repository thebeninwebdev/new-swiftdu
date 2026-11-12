export type SettlementEligibilityOrder = {
  status?: string | null
  platformFee?: number | null
  platformFeeWaivedForFastCompletion?: boolean | null
  taskerHasPaid?: boolean | null
  settlementStatus?: string | null
  settlementPaidAt?: Date | string | null
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
