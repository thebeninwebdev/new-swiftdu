// The API's amount includes food and packaging, but never the service fee.
// The user enters one estimate, including any takeaway cost.
export function parseRestaurantCost(value: string) {
  const normalized = value.replace(/[₦,\s]/g, '')
  if (!normalized) return 0
  if (!/^\d+$/.test(normalized)) return NaN
  const amount = Number(normalized)
  return Number.isSafeInteger(amount) ? amount : NaN
}

export function formatRestaurantCost(value: string) {
  if (!value.trim()) return ''
  const amount = parseRestaurantCost(value)
  // Keep invalid input visible so validation can explain it, rather than
  // silently turning a negative or decimal amount into a different price.
  return Number.isFinite(amount) ? amount.toLocaleString('en-NG') : value
}

export function getRestaurantEstimate(food: string, inquiry = false) {
  if (inquiry) return { amount: 0, valid: true }
  const amount = parseRestaurantCost(food)
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    valid: Number.isFinite(amount) && amount > 0,
  }
}
