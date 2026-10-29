export const CUSTOMER_ORDER_CARD_FIELDS = [
  '_id', 'taskType', 'description', 'status', 'amount', 'totalAmount', 'location',
  'store', 'cafeInquiry', 'firstOrderBonusApplied', 'firstOrderBonusAmount',
  'platformFeeBeforeFirstOrderBonus', 'pricingModel', 'createdAt', 'updatedAt',
].join(' ')

export const TASKER_AVAILABLE_ORDER_FIELDS = [
  '_id', 'userId', 'taskType', 'description', 'status', 'amount', 'totalAmount',
  'commission', 'taskerFee', 'location', 'deliveryLocation', 'roomNumber', 'store',
  'taskerGenderRestriction', 'cafeInquiry', 'isTestOrder', 'createdAt', 'updatedAt',
].join(' ')

export const DEFAULT_ORDER_PAGE_LIMIT = 20
export const MAX_ORDER_PAGE_LIMIT = 50

export function parseOrderPagination(pageValue: string | null, limitValue: string | null) {
  const rawPage = Number(pageValue || 1)
  const rawLimit = Number(limitValue || DEFAULT_ORDER_PAGE_LIMIT)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const limit = Number.isInteger(rawLimit)
    ? Math.min(MAX_ORDER_PAGE_LIMIT, Math.max(1, rawLimit))
    : DEFAULT_ORDER_PAGE_LIMIT
  return { page, limit, skip: (page - 1) * limit }
}
