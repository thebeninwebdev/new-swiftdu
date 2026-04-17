export const WATER_TASK_TYPE = 'water'
export const WATER_BAG_FEE = 200

export const WATER_DESCRIPTION_PATTERN = /\bbag(?:s)?\s+of\s+water\b/i

export const TIERED_SERVICE_FEE_RULES = [
  {
    min: 0,
    max: 9999,
    fee: 450,
    label: 'N0 - N9,999',
  },
  {
    min: 10000,
    max: 19999,
    fee: 1000,
    label: 'N10,000 - N19,999',
  },
  {
    min: 20000,
    max: null,
    fee: 2000,
    label: 'N20,000 and above',
  },
] as const

export type PricingModel = 'tiered' | 'water'

export interface PricingResult {
  amount: number
  serviceFee: number
  totalAmount: number
  pricingModel: PricingModel
  waterBags?: number
  waterFee: number
}

function roundNaira(value: number) {
  return Math.round(value)
}

export function descriptionMentionsWater(description: string) {
  return WATER_DESCRIPTION_PATTERN.test(description)
}

export function getTieredServiceFee(amount: number) {
  const matchingRule = TIERED_SERVICE_FEE_RULES.find((rule) => {
    if (rule.max === null) {
      return amount >= rule.min
    }

    return amount >= rule.min && amount <= rule.max
  })

  return matchingRule?.fee || TIERED_SERVICE_FEE_RULES[0].fee
}

export function calculateOrderPricing(input: {
  amount: number
  taskType: string
  waterBags?: number
}) {
  const amount = roundNaira(input.amount)

  if (input.taskType === WATER_TASK_TYPE) {
    const waterBags = Number(input.waterBags || 0)
    const waterFee = roundNaira(waterBags * WATER_BAG_FEE)

    return {
      amount,
      serviceFee: waterFee,
      totalAmount: roundNaira(amount + waterFee),
      pricingModel: 'water' as const,
      waterBags,
      waterFee,
    } satisfies PricingResult
  }

  const serviceFee = getTieredServiceFee(amount)

  return {
    amount,
    serviceFee,
    totalAmount: roundNaira(amount + serviceFee),
    pricingModel: 'tiered' as const,
    waterFee: 0,
  } satisfies PricingResult
}
