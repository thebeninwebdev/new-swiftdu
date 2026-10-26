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

  // A customer's first order does not create a platform remittance. The
  // customer still pays the quoted amount; the tasker receives the whole
  // applicable service fee instead of the normal 16.67% platform split.
  return {
    commission: effectiveFees.serviceFee,
    serviceFee: effectiveFees.serviceFee,
    taskerFee: firstOrder ? effectiveFees.taskerFee + effectiveFees.platformFee : effectiveFees.taskerFee,
    platformFee: firstOrder ? 0 : effectiveFees.platformFee,
    totalAmount: totalBeforeBonus,
    firstOrderBonusApplied: firstOrder,
    platformFeeBeforeFirstOrderBonus: firstOrder ? effectiveFees.platformFee : undefined,
    firstOrderBonusAmount: firstOrder ? effectiveFees.platformFee : undefined,
  }
}
