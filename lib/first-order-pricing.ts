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
  // Sponsored orders already waive the service fee. Only the platform share of
  // the retained cafe charge can still be discounted; never discount it twice.
  const remainingPlatformFee = broaderDiscount
    ? Math.min(normal.platformFee, splitServiceFee(retainedInquiryFee).platformFee)
    : normal.platformFee
  const saving = options.firstOrderBonus ? Math.min(totalBeforeBonus, remainingPlatformFee) : 0
  const platformReduction = options.firstOrderBonus ? normal.platformFee : 0
  return {
    commission: normal.serviceFee - platformReduction,
    serviceFee: normal.serviceFee - platformReduction,
    taskerFee: normal.taskerFee,
    platformFee: options.firstOrderBonus ? 0 : normal.platformFee,
    totalAmount: totalBeforeBonus - saving,
    firstOrderBonusApplied: Boolean(options.firstOrderBonus),
    platformFeeBeforeFirstOrderBonus: options.firstOrderBonus ? normal.platformFee : undefined,
    firstOrderBonusAmount: options.firstOrderBonus ? saving : undefined,
  }
}
