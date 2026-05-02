export const WATER_TASK_TYPE = 'water'
export const WATER_BAG_PRICE = 750
export const WATER_BAG_FEE = 450
export const WATER_PLATFORM_FEE_RATE = 0.24
export const PRINTING_TASK_TYPE = 'printing'
export const PRINTING_SERVICE_FEE = 500
export const COPY_NOTES_TASK_TYPE = 'copy_notes'
export const COPY_NOTES_HARDBACK_PRICE_PER_PAGE = 450
export const COPY_NOTES_HARDBACK_TASKER_FEE_PER_PAGE = 400
export const COPY_NOTES_HARDBACK_PLATFORM_FEE_PER_PAGE = 50
export const COPY_NOTES_SMALL_PRICE_PER_PAGE = 250
export const COPY_NOTES_SMALL_TASKER_FEE_PER_PAGE = 250
export const COPY_NOTES_SMALL_PLATFORM_FEE_PER_PAGE = 0

export const WATER_DESCRIPTION_PATTERN = /\bbag(?:s)?\s+of\s+water\b/i

export const TIERED_SERVICE_FEE_RULES = [
  {
    min: 0,
    max: 6999,
    fee: 450,
    label: 'N0 - N6,999',
  },
  {
    min: 7000,
    max: 19999,
    fee: 1000,
    label: 'N7,000 - N19,999',
  },
  {
    min: 20000,
    max: null,
    fee: 2000,
    label: 'N20,000 and above',
  },
] as const

export type CopyNotesType = 'hardback' | 'small'
export type PricingModel = 'tiered' | 'water' | 'copy_notes'

export interface PricingResult {
  amount: number
  serviceFee: number
  totalAmount: number
  pricingModel: PricingModel
  waterBags?: number
  waterFee: number
  taskerFee?: number
  platformFee?: number
  copyNotesType?: CopyNotesType
  copyNotesPages?: number
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
  copyNotesType?: string
  copyNotesPages?: number
}) {
  const amount = roundNaira(input.amount)

  if (input.taskType === WATER_TASK_TYPE) {
    const waterBags = Number(input.waterBags || 0)
    const waterBudget = roundNaira(waterBags * WATER_BAG_PRICE)
    const waterFee = roundNaira(waterBags * WATER_BAG_FEE)
    const platformFee = roundNaira(waterFee * WATER_PLATFORM_FEE_RATE)
    const taskerFee = roundNaira(waterFee - platformFee)

    return {
      amount: roundNaira(waterBudget + taskerFee),
      serviceFee: platformFee,
      totalAmount: roundNaira(waterBudget + waterFee),
      pricingModel: 'water' as const,
      waterBags,
      waterFee,
      taskerFee,
      platformFee,
    } satisfies PricingResult
  }

  if (input.taskType === PRINTING_TASK_TYPE) {
    const serviceFee = PRINTING_SERVICE_FEE

    return {
      amount,
      serviceFee,
      totalAmount: roundNaira(amount + serviceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
    } satisfies PricingResult
  }

  if (input.taskType === COPY_NOTES_TASK_TYPE) {
    const copyNotesPages = Number(input.copyNotesPages || 0)
    const copyNotesType: CopyNotesType =
      input.copyNotesType === 'small' ? 'small' : 'hardback'
    const pagePrice =
      copyNotesType === 'hardback'
        ? COPY_NOTES_HARDBACK_PRICE_PER_PAGE
        : COPY_NOTES_SMALL_PRICE_PER_PAGE
    const taskerFeePerPage =
      copyNotesType === 'hardback'
        ? COPY_NOTES_HARDBACK_TASKER_FEE_PER_PAGE
        : COPY_NOTES_SMALL_TASKER_FEE_PER_PAGE
    const platformFeePerPage =
      copyNotesType === 'hardback'
        ? COPY_NOTES_HARDBACK_PLATFORM_FEE_PER_PAGE
        : COPY_NOTES_SMALL_PLATFORM_FEE_PER_PAGE
    const totalAmount = roundNaira(copyNotesPages * pagePrice)
    const taskerFee = roundNaira(copyNotesPages * taskerFeePerPage)
    const platformFee = roundNaira(copyNotesPages * platformFeePerPage)

    return {
      amount: taskerFee,
      serviceFee: platformFee,
      totalAmount,
      pricingModel: 'copy_notes' as const,
      waterFee: 0,
      taskerFee,
      platformFee,
      copyNotesType,
      copyNotesPages,
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
