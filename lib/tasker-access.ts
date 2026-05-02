export const PREMIUM_TASKER_MIN_BUDGET = 7_000

export const DECLINED_TRANSFER_MESSAGE =
  'The transaction was not found and we will be in contact within 24 hours.'

export function requiresPremiumTasker(amount: number | null | undefined) {
  const normalizedAmount = Number(amount ?? 0)

  return Number.isFinite(normalizedAmount) && normalizedAmount >= PREMIUM_TASKER_MIN_BUDGET
}
