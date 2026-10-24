export const WATER_TASK_TYPE = 'water'
export const WATER_BAG_PRICE = 750
export const WATER_BAG_FEE = 450
import { PLATFORM_SETTLEMENT_SHARE } from './order-finance'

export const WATER_PLATFORM_FEE_RATE = PLATFORM_SETTLEMENT_SHARE
export const CAFE_INQUIRY_EXTRA_FEE = 50
export const RESTAURANT_MAX_PEOPLE = 3
// Packaging is sold as a priced option, not an automatic surcharge.
export const RESTAURANT_TAKEAWAY_PACK_PRICE = 200
export const RESTAURANT_TAKEAWAY_FEE = 0
export const PRINTING_TASK_TYPE = 'printing'
export const PRINTING_PRICE_PER_PAGE = 100
export const PHOTOCOPY_PRICE_PER_PAGE = 50
export const COPY_NOTES_TASK_TYPE = 'copy_notes'
export const DRY_CLEANING_TASK_TYPE = 'dry_cleaning'
export const INDOMIE_TASK_TYPE = 'indomie'
export const COPY_NOTES_SMALL_PRICE_PER_TWO_PAGES = 250
export const COPY_NOTES_BIG_PRICE_PER_TWO_PAGES = 450

export const WATER_DESCRIPTION_PATTERN = /\bbag(?:s)?\s+of\s+water\b/i


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
  indomiePacks?: number
  eggCount?: number
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
  indomiePacks?: number
  eggCount?: number
  /** Authoritative fee resolved by the server or public quote endpoint. */
  serviceFee?: number
}) {
  const amount = roundNaira(input.amount)
  const configuredServiceFee = Number.isFinite(input.serviceFee)
    ? roundNaira(Math.max(0, Number(input.serviceFee)))
    : 0

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
    return {
      amount: printingAmount,
      serviceFee: configuredServiceFee,
      totalAmount: roundNaira(printingAmount + configuredServiceFee),
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
    const restaurantPackagingFee = 0

    const serviceFee = configuredServiceFee + (input.cafeInquiry ? CAFE_INQUIRY_EXTRA_FEE : 0)

    return {
      amount,
      serviceFee,
      totalAmount: roundNaira(amount + serviceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
      restaurantPeopleCount,
      restaurantTakeawayCount,
      restaurantPackagingFee,
    } satisfies PricingResult
  }

  if (input.taskType === 'shopping') {
    return {
      amount,
      serviceFee: configuredServiceFee,
      totalAmount: roundNaira(amount + configuredServiceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
    } satisfies PricingResult
  }

  if (input.taskType === INDOMIE_TASK_TYPE) {
    const indomiePacks = Number(input.indomiePacks || 0)
    const eggCount = Number(input.eggCount || 0)

    return {
      amount,
      serviceFee: configuredServiceFee,
      totalAmount: roundNaira(amount + configuredServiceFee),
      pricingModel: 'tiered' as const,
      waterFee: 0,
      indomiePacks: Number.isFinite(indomiePacks) ? indomiePacks : 0,
      eggCount: Number.isFinite(eggCount) ? eggCount : 0,
    } satisfies PricingResult
  }

  return {
    amount,
    serviceFee: configuredServiceFee,
    totalAmount: roundNaira(amount + configuredServiceFee),
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
  normalizeRestaurantTakeawayCount(takeawayCount, peopleCount)
  return 0
}
