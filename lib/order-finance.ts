export const PLATFORM_SETTLEMENT_SHARE = 0.2
export const TASKER_SETTLEMENT_SHARE = 0.8
export const SETTLEMENT_WINDOW_HOURS = 24

function roundNaira(value: number) {
  return Math.round(value)
}

export function splitServiceFee(serviceFee: number) {
  const normalizedServiceFee = roundNaira(serviceFee)
  const platformFee = roundNaira(normalizedServiceFee * PLATFORM_SETTLEMENT_SHARE)
  const taskerFee = roundNaira(normalizedServiceFee - platformFee)

  return {
    platformFee,
    taskerFee,
    serviceFee: normalizedServiceFee,
  }
}

export function getSettlementDueAt(fromDate: Date = new Date()) {
  return new Date(fromDate.getTime() + SETTLEMENT_WINDOW_HOURS * 60 * 60 * 1000)
}
