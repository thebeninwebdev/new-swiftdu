import { splitServiceFee } from './order-finance'
import { CAFE_INQUIRY_EXTRA_FEE, type PricingResult } from './pricing'

export type FirstOrderBonusFields = {
  firstOrderBonusApplied?: boolean
  platformFeeBeforeFirstOrderBonus?: number
  firstOrderBonusAmount?: number
}
export function canReleaseFirstOrderReservation(order: {
  status: string; isTestOrder?: boolean; hasPaid?: boolean; paymentStatus?: string
  cafeInquiryFeePaid?: boolean; customerTransferredAt?: Date | string; paidAt?: Date | string
}) {
  return !order.isTestOrder && order.status === 'cancelled' && !order.hasPaid && order.paymentStatus !== 'paid' &&
    !order.cafeInquiryFeePaid && !order.customerTransferredAt && !order.paidAt
}

// Input must be the normal calculated price, before either discount.
export function priceWithOrderDiscounts(pricing: PricingResult, options: {
  firstOrderBonus?: boolean
  serviceFeeDiscount?: boolean
  cafeInquiry?: boolean
} = {}) {
  const normal = pricing.pricingModel === 'tiered' ? splitServiceFee(pricing.serviceFee) : {
    serviceFee: pricing.serviceFee, platformFee: pricing.platformFee || 0, taskerFee: pricing.taskerFee || 0,
  }
  const broaderDiscount = options.serviceFeeDiscount && pricing.serviceFee > 0
  const retainedInquiryFee = options.cafeInquiry ? CAFE_INQUIRY_EXTRA_FEE : 0
  const totalBeforeBonus = broaderDiscount
    ? Math.max(0, pricing.totalAmount - pricing.serviceFee + retainedInquiryFee)
    : pricing.totalAmount
  const effectiveFees = broaderDiscount
    ? pricing.pricingModel === 'tiered'
      ? splitServiceFee(retainedInquiryFee)
      : { serviceFee: retainedInquiryFee, platformFee: 0, taskerFee: retainedInquiryFee }
    : normal
  const firstOrder = Boolean(options.firstOrderBonus)

  // On a customer's first live order SwiftDU waives its platform share. The
  // customer pays the normal tasker share only, and the tasker still earns
  // that normal tasker share.
  const firstOrderBonusAmount = firstOrder ? Math.max(0, effectiveFees.platformFee) : 0
  return {
    commission: Math.max(0, effectiveFees.serviceFee - firstOrderBonusAmount),
    serviceFee: Math.max(0, effectiveFees.serviceFee - firstOrderBonusAmount),
    taskerFee: effectiveFees.taskerFee,
    platformFee: firstOrder ? 0 : effectiveFees.platformFee,
    totalAmount: Math.max(0, totalBeforeBonus - firstOrderBonusAmount),
    firstOrderBonusApplied: firstOrder,
    platformFeeBeforeFirstOrderBonus: firstOrder ? effectiveFees.platformFee : undefined,
    firstOrderBonusAmount: firstOrder ? firstOrderBonusAmount : undefined,
  }
}
