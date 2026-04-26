export const PLATFORM_SETTLEMENT_SHARE = 0.24
export const SETTLEMENT_WINDOW_HOURS = 24

function normalizeCurrency(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0
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
