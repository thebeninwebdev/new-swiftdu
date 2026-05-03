export const PLATFORM_SETTLEMENT_SHARE = 0.24
export const SETTLEMENT_WINDOW_HOURS = 24
export const PAYSTACK_SETTLEMENT_FEE_RATE = 0.015
export const CANCELLED_ORDER_STATUS = 'cancelled'

function normalizeCurrency(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

export function splitServiceFee(serviceFee: number) {
  const normalizedServiceFee = normalizeCurrency(serviceFee)
  const platformFee = Math.floor(normalizedServiceFee * PLATFORM_SETTLEMENT_SHARE)
  const taskerFee = normalizedServiceFee - platformFee

  return {
    platformFee,
    taskerFee,
    serviceFee: normalizedServiceFee,
  }
}

export function getSettlementDueAt(fromDate: Date = new Date()) {
  return new Date(fromDate.getTime() + SETTLEMENT_WINDOW_HOURS * 60 * 60 * 1000)
}

export function calculatePaystackSettlementFee(platformFee: number) {
  return roundCurrency(normalizeCurrency(platformFee) * PAYSTACK_SETTLEMENT_FEE_RATE)
}

export function calculateNetPlatformProfit(platformFee: number) {
  const normalizedPlatformFee = normalizeCurrency(platformFee)

  return roundCurrency(normalizedPlatformFee - calculatePaystackSettlementFee(normalizedPlatformFee))
}

export function excludeCancelledOrders(match: Record<string, unknown> = {}) {
  const { $and, ...rest } = match
  const existingAnd = Array.isArray($and) ? $and : $and ? [$and] : []

  return {
    ...rest,
    $and: [
      ...existingAnd,
      { status: { $ne: CANCELLED_ORDER_STATUS } },
    ],
  }
}
