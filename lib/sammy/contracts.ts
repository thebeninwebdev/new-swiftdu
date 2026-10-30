export const SAMMY_TASK_TYPES = ['restaurant', 'shopping', 'printing', 'water'] as const
export type SammyTaskType = (typeof SAMMY_TASK_TYPES)[number]

export type SammyPhoneRequest = { phone: string }

export type SammyOrderDraft = {
  taskType: SammyTaskType
  description?: string
  amount?: number
  store?: string
  vendorId?: string
  deliveryPricingVendorId?: string
  parentLocationId: string
  exactLocationId?: string
  location: string
  deliveryLocation?: string
  roomNumber?: string
  packaging?: string
  restaurantPeopleCount?: number
  restaurantTakeawayCount?: number
  cafeInquiry?: boolean
  waterBags?: number
  numberOfPages?: number
  printingServiceType?: string
  printingNeedsEditing?: boolean
}

export type SammyOrderRequest = SammyPhoneRequest & {
  idempotencyKey: string
  order: SammyOrderDraft
}

export type SammyErrorBody = { error: string; code: string; [key: string]: unknown }

export type SammyCompactOrder = {
  _id: string
  taskType: string
  status: string
  description: string
  location: string
  totalAmount: number
  paymentStatus?: string
  trackingUrl: string
}
