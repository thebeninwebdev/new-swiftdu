export const WATER_TASK_TYPE = 'water'
export const WATER_BAG_PRICE = 750
export const WATER_BAG_FEE = 450
export const WATER_PLATFORM_FEE_RATE = 0.24
export const RESTAURANT_PERSON_FEE = 450
export const CAFE_INQUIRY_EXTRA_FEE = 100
export const CAFE_INQUIRY_SERVICE_FEE = RESTAURANT_PERSON_FEE + CAFE_INQUIRY_EXTRA_FEE
export const RESTAURANT_MAX_PEOPLE = 3
export const RESTAURANT_TAKEAWAY_FEE = 200
export const SHOPPING_RITA_STORE = 'rita'
export const SHOPPING_NON_RITA_SERVICE_FEE = 700
export const PRINTING_TASK_TYPE = 'printing'
export const PRINTING_SERVICE_FEE = 500
export const PRINTING_PRICE_PER_PAGE = 100
export const PHOTOCOPY_PRICE_PER_PAGE = 50
export const COPY_NOTES_TASK_TYPE = 'copy_notes'
export const COPY_NOTES_SMALL_PRICE_PER_TWO_PAGES = 250
export const COPY_NOTES_BIG_PRICE_PER_TWO_PAGES = 450

export const WATER_DESCRIPTION_PATTERN = /\bbag(?:s)?\s+of\s+water\b/i

export const TIERED_SERVICE_FEE_RULES = [
  {
    min: 0,
    max: 4999,
    fee: 450,
    label: 'N0 - N4,999',
  },
  {
    min: 5000,
    max: 6999,
    fee: 660,
    label: 'N5,000 - N6,999',
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

export const RESTAURANT_SINGLE_ORDER_SERVICE_FEE_RULES = [
  {
    min: 0,
    max: 4999,
    fee: RESTAURANT_PERSON_FEE,
  },
  {
    min: 5000,
    max: 6999,
    fee: 700,
  },
  {
    min: 7000,
    max: 9999,
    fee: 1000,
  },
  {
    min: 10000,
    max: null,
    fee: 2000,
  },
] as const

export const RESTAURANT_SERVICE_FEE_BY_PEOPLE_COUNT: Record<number, number> = {
  1: 450,
  2: 700,
  3: 1050,
}

export type NoteSize = 'small' | 'big'
export type CopyNotesType = NoteSize
export type PrintingServiceType = 'printing' | 'photocopying'
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
  noteSize?: NoteSize
  numberOfPages?: number
  copyNotesType?: CopyNotesType
  copyNotesPages?: number
  printingServiceType?: PrintingServiceType
  printingNeedsEditing?: boolean
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  restaurantPackagingFee?: number
}

export interface CopyNotesPricingInput {
  noteSize: string
  numberOfPages: number
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

export function normalizeNoteSize(value?: string): NoteSize | undefined {
  if (value === 'small') return 'small'
  if (value === 'big' || value === 'hardback') return 'big'
  return undefined
}

export function normalizePrintingServiceType(value?: string): PrintingServiceType | undefined {
  if (value === 'printing') return 'printing'
  if (value === 'photocopying' || value === 'photocopy') return 'photocopying'
  return undefined
}

export function calculatePrintingPrice(input: {
  printingServiceType?: string
  numberOfPages: number
}) {
  const printingServiceType = normalizePrintingServiceType(input.printingServiceType)
  const numberOfPages = Number(input.numberOfPages || 0)

  if (!printingServiceType) {
    throw new Error('Invalid printing service type')
  }

  if (!Number.isInteger(numberOfPages) || numberOfPages < 1) {
    throw new Error('Invalid number of pages')
  }

  const pricePerPage =
    printingServiceType === 'printing'
      ? PRINTING_PRICE_PER_PAGE
      : PHOTOCOPY_PRICE_PER_PAGE

  return roundNaira(numberOfPages * pricePerPage)
}

export function calculateCopyNotesPrice(input: CopyNotesPricingInput) {
  const noteSize = normalizeNoteSize(input.noteSize)
  const numberOfPages = Number(input.numberOfPages || 0)

  if (!noteSize) {
    throw new Error('Invalid note size')
  }

  if (!Number.isInteger(numberOfPages) || numberOfPages < 1) {
    throw new Error('Invalid number of pages')
  }

  const baseRate =
    noteSize === 'small'
      ? COPY_NOTES_SMALL_PRICE_PER_TWO_PAGES
      : COPY_NOTES_BIG_PRICE_PER_TWO_PAGES

  return roundNaira(Math.ceil(numberOfPages / 2) * baseRate)
}

export function calculateOrderPricing(input: {
  amount: number
  taskType: string
  store?: string
  waterBags?: number
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  noteSize?: string
  numberOfPages?: number
  drawingPages?: number
  copyNotesType?: string
  copyNotesPages?: number
  printingServiceType?: string
  printingNeedsEditing?: boolean
  cafeInquiry?: boolean
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
    const printingServiceType = normalizePrintingServiceType(input.printingServiceType)
    const numberOfPages = Number(input.numberOfPages || 0)
    const printingAmount =
      printingServiceType && Number.isInteger(numberOfPages) && numberOfPages > 0
        ? calculatePrintingPrice({
            printingServiceType,
            numberOfPages,
          })
        : 0
    const serviceFee =
      printingAmount >= 5000 ? getTieredServiceFee(printingAmount) : PRINTING_SERVICE_FEE

    return {
      amount: printingAmount,
      serviceFee,
      totalAmount: roundNaira(printingAmount + serviceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
      numberOfPages: Number.isFinite(numberOfPages) ? numberOfPages : 0,
      printingServiceType,
      printingNeedsEditing: Boolean(input.printingNeedsEditing),
    } satisfies PricingResult
  }

  if (input.taskType === COPY_NOTES_TASK_TYPE) {
    const noteSize = normalizeNoteSize(input.noteSize || input.copyNotesType)
    const numberOfPages = Number(input.numberOfPages ?? input.copyNotesPages ?? 0)
    if (
      !noteSize ||
      !Number.isInteger(numberOfPages) ||
      numberOfPages < 1
    ) {
      return {
        amount: 0,
        serviceFee: 0,
        totalAmount: 0,
        pricingModel: 'copy_notes' as const,
        waterFee: 0,
        taskerFee: 0,
        platformFee: 0,
        noteSize,
        numberOfPages: Number.isFinite(numberOfPages) ? numberOfPages : 0,
        copyNotesType: noteSize,
        copyNotesPages: Number.isFinite(numberOfPages) ? numberOfPages : 0,
      } satisfies PricingResult
    }
    const totalAmount = calculateCopyNotesPrice({
      noteSize: noteSize || '',
      numberOfPages,
    })

    return {
      amount: totalAmount,
      serviceFee: 0,
      totalAmount,
      pricingModel: 'copy_notes' as const,
      waterFee: 0,
      taskerFee: totalAmount,
      platformFee: 0,
      noteSize,
      numberOfPages,
      copyNotesType: noteSize,
      copyNotesPages: numberOfPages,
    } satisfies PricingResult
  }

  if (input.taskType === 'restaurant') {
    const restaurantPeopleCount = normalizeRestaurantPeopleCount(input.restaurantPeopleCount)
    const restaurantTakeawayCount = normalizeRestaurantTakeawayCount(
      input.restaurantTakeawayCount,
      restaurantPeopleCount
    )
    const restaurantPackagingFee = calculateRestaurantPackagingFee(
      restaurantTakeawayCount,
      restaurantPeopleCount
    )

    if (input.cafeInquiry) {
      return {
        amount: restaurantPackagingFee,
        serviceFee: CAFE_INQUIRY_SERVICE_FEE,
        totalAmount: roundNaira(CAFE_INQUIRY_SERVICE_FEE + restaurantPackagingFee),
        pricingModel: 'tiered' as const,
        waterFee: 0,
        restaurantPeopleCount,
        restaurantTakeawayCount,
        restaurantPackagingFee,
      } satisfies PricingResult
    }

    const serviceFee = calculateRestaurantServiceFee(restaurantPeopleCount)

    return {
      amount: roundNaira(amount + restaurantPackagingFee),
      serviceFee,
      totalAmount: roundNaira(amount + restaurantPackagingFee + serviceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
      restaurantPeopleCount,
      restaurantTakeawayCount,
      restaurantPackagingFee,
    } satisfies PricingResult
  }

  if (input.taskType === 'shopping') {
    const normalizedStore = String(input.store || '').trim().toLowerCase()
    const serviceFee =
      normalizedStore && normalizedStore !== SHOPPING_RITA_STORE
        ? SHOPPING_NON_RITA_SERVICE_FEE
        : getTieredServiceFee(amount)

    return {
      amount,
      serviceFee,
      totalAmount: roundNaira(amount + serviceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
    } satisfies PricingResult
  }

  const serviceFee =
    input.taskType === 'restaurant'
      ? calculateRestaurantServiceFee(input.restaurantPeopleCount)
      : getTieredServiceFee(amount)

  return {
    amount,
    serviceFee,
    totalAmount: roundNaira(amount + serviceFee),
    pricingModel: 'tiered' as const,
    waterFee: 0,
    restaurantPeopleCount:
      input.taskType === 'restaurant'
        ? normalizeRestaurantPeopleCount(input.restaurantPeopleCount)
        : undefined,
  } satisfies PricingResult
}

export function normalizeRestaurantPeopleCount(value?: number) {
  const count = Number(value || 1)

  if (!Number.isInteger(count) || count < 1) {
    return 1
  }

  return Math.min(count, RESTAURANT_MAX_PEOPLE)
}

export function normalizeRestaurantTakeawayCount(value?: number, peopleCount?: number) {
  const normalizedPeopleCount = normalizeRestaurantPeopleCount(peopleCount)
  const count = Number(value || 0)

  if (!Number.isInteger(count) || count < 0) {
    return 0
  }

  return Math.min(count, normalizedPeopleCount)
}

export function calculateRestaurantPackagingFee(takeawayCount?: number, peopleCount?: number) {
  return roundNaira(
    normalizeRestaurantTakeawayCount(takeawayCount, peopleCount) * RESTAURANT_TAKEAWAY_FEE
  )
}

export function calculateRestaurantServiceFee(peopleCount?: number) {
  const normalizedPeopleCount = normalizeRestaurantPeopleCount(peopleCount)

  return RESTAURANT_SERVICE_FEE_BY_PEOPLE_COUNT[normalizedPeopleCount] || RESTAURANT_PERSON_FEE
}
