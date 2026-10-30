import { Types } from 'mongoose'

import { validateOrderAgainstCommercePolicy } from '@/lib/commerce-policy'
import { firstOrderBonusEligibility } from '@/lib/first-order-bonus'
import { priceWithOrderDiscounts } from '@/lib/first-order-pricing'
import { canCreateOrder } from '@/lib/operations'
import { getOperationsSettings, getOperationsStatus } from '@/lib/operations-settings'
import { calculateOrderPricing, descriptionMentionsWater, normalizePrintingServiceType, RESTAURANT_MAX_PEOPLE } from '@/lib/pricing'
import { getConfiguredServiceFee } from '@/lib/pricing-config'
import { isProfileComplete } from '@/lib/profile-completion'
import { hasActiveServiceFeeDiscountReservation } from '@/lib/service-fee-discount'
import { shouldCreateTestOrder } from '@/lib/test-orders'
import { resolveVendorDeliveryPricing, VendorPricingError } from '@/lib/vendors'
import CampusLocation from '@/models/campus-location'
import { SAMMY_TASK_TYPES, type SammyOrderDraft } from './contracts'
import { SammyApiError } from './server'

type SammyQuoteUser = {
  _id: unknown
  name?: string | null
  gender?: string | null
  phone?: string | null
  location?: string | null
  defaultLocation?: string | null
  isExco?: boolean | null
  excoRole?: string | null
  testOrderMode?: boolean | null
  serviceFeeDiscountEnabled?: boolean
  serviceFeeDiscountRemainingOrders?: number
}

export async function quoteSammyDraft(user: SammyQuoteUser, draft: SammyOrderDraft) {
  if (!SAMMY_TASK_TYPES.includes(draft.taskType)) throw new SammyApiError(400, 'INVALID_TASK_TYPE', 'Choose a supported service.')
  if (!draft.location?.trim()) throw new SammyApiError(400, 'INVALID_DESTINATION', 'Choose a delivery destination.')
  if (!isProfileComplete(user)) throw new SammyApiError(403, 'PROFILE_INCOMPLETE', 'Complete your SwiftDU profile before placing an order.')
  const policy = validateOrderAgainstCommercePolicy({ taskType: draft.taskType, description: String(draft.description || ''), vendorName: draft.store })
  if (!policy.allowed) throw new SammyApiError(400, 'RESTRICTED_ITEM', policy.reason || 'This request is restricted.')
  const description = String(draft.description || '').trim()
  if (descriptionMentionsWater(description) && draft.taskType !== 'water') throw new SammyApiError(400, 'WRONG_SERVICE', 'Choose the bag of water task for water delivery.')
  const cafeInquiry = draft.taskType === 'restaurant' && draft.cafeInquiry === true
  const amount = cafeInquiry || draft.taskType === 'water' ? 0 : Number(draft.amount)
  if (draft.taskType === 'shopping' && description.length < 5) throw new SammyApiError(400, 'INVALID_DESCRIPTION', 'Describe the items you want.')
  if ((draft.taskType === 'shopping' || (draft.taskType === 'restaurant' && !cafeInquiry)) && (!Number.isFinite(amount) || amount < 0 || (draft.taskType === 'shopping' && amount <= 0))) throw new SammyApiError(400, 'INVALID_AMOUNT', 'Enter a valid task amount.')
  const people = cafeInquiry ? 1 : Number(draft.restaurantPeopleCount || 1)
  const takeaway = cafeInquiry ? 0 : Number(draft.restaurantTakeawayCount || 0)
  if (draft.taskType === 'restaurant' && (!Number.isInteger(people) || people < 1 || people > RESTAURANT_MAX_PEOPLE)) throw new SammyApiError(400, 'INVALID_PEOPLE_COUNT', `Restaurant orders can only be for 1 to ${RESTAURANT_MAX_PEOPLE} people.`)
  if (draft.taskType === 'restaurant' && (!Number.isInteger(takeaway) || takeaway < 0 || takeaway > people)) throw new SammyApiError(400, 'INVALID_TAKEAWAY_COUNT', 'Choose how many orders need takeaway packs.')
  if (cafeInquiry && (!draft.store?.trim() || !draft.location?.trim())) throw new SammyApiError(400, 'INVALID_CAFE_INQUIRY', 'Choose a cafe and delivery location.')
  if (draft.taskType === 'water' && (!Number.isInteger(Number(draft.waterBags)) || Number(draft.waterBags) <= 0)) throw new SammyApiError(400, 'INVALID_WATER_BAGS', 'Enter the number of water bags.')
  if (draft.taskType === 'printing' && (!normalizePrintingServiceType(draft.printingServiceType) || !Number.isInteger(Number(draft.numberOfPages)) || Number(draft.numberOfPages) < 1)) throw new SammyApiError(400, 'INVALID_PRINTING_ORDER', 'Choose printing or photocopying and enter the number of pages.')
  if (!draft.parentLocationId || !Types.ObjectId.isValid(draft.parentLocationId)) throw new SammyApiError(400, 'INVALID_DESTINATION', 'Choose a valid delivery destination.')
  const parent = await CampusLocation.findOne({ _id: draft.parentLocationId, parentLocationId: null, active: true }).select('_id name type deliveryPolicy').lean()
  if (!parent) throw new SammyApiError(400, 'INVALID_DESTINATION', 'Choose an active delivery destination.')
  let exact = null
  if (draft.exactLocationId) {
    if (!Types.ObjectId.isValid(draft.exactLocationId)) throw new SammyApiError(400, 'INVALID_EXACT_LOCATION', 'Choose a valid exact delivery location.')
    exact = await CampusLocation.findOne({ _id: draft.exactLocationId, parentLocationId: parent._id, active: true }).select('_id').lean()
    if (!exact) throw new SammyApiError(400, 'INVALID_EXACT_LOCATION', 'Choose a valid exact delivery location.')
  }
  if (parent.type === 'hostel' && !exact && await CampusLocation.exists({ parentLocationId: parent._id, active: true })) throw new SammyApiError(400, 'EXACT_LOCATION_REQUIRED', 'Choose a valid exact delivery location.')
  if ((parent.type === 'hostel' || parent.deliveryPolicy?.requiresRoomNumber) && !draft.roomNumber?.trim()) throw new SammyApiError(400, 'ROOM_NUMBER_REQUIRED', 'Enter your room number for this hostel.')

  const isAnywhere = draft.taskType === 'restaurant' && (draft.store === 'Choose from anywhere' || draft.store === 'Buy from anywhere')
  const selectedVendorId = draft.vendorId || ''
  const pricingVendorId = selectedVendorId || (isAnywhere ? draft.deliveryPricingVendorId || '' : '')
  let configuredServiceFee: number | null = null
  if (draft.taskType !== 'water') {
    if (!pricingVendorId) throw new SammyApiError(400, 'VENDOR_NOT_FOUND', 'Choose a vendor and delivery location.')
    try {
      const resolved = await resolveVendorDeliveryPricing({ vendorId: pricingVendorId, dropoffParentLocationId: String(parent._id), expectedServiceType: draft.taskType })
      if (isAnywhere && !selectedVendorId && !/\bakpan\b/i.test(resolved.vendor.name)) throw new SammyApiError(400, 'VENDOR_NOT_FOUND', 'Choose-from-anywhere delivery coverage is unavailable.')
      configuredServiceFee = resolved.serviceFee
    } catch (error) {
      if (error instanceof SammyApiError) throw error
      const vendorError = error as VendorPricingError
      throw new SammyApiError(400, vendorError.code || 'VENDOR_NOT_FOUND', vendorError.message)
    }
  } else configuredServiceFee = await getConfiguredServiceFee({ taskType: draft.taskType, parentLocationId: parent._id })

  const pricing = calculateOrderPricing({
    taskType: draft.taskType,
    amount,
    store: draft.store,
    restaurantPeopleCount: people,
    restaurantTakeawayCount: takeaway,
    cafeInquiry,
    waterBags: draft.waterBags,
    numberOfPages: draft.numberOfPages,
    printingServiceType: normalizePrintingServiceType(draft.printingServiceType),
    printingNeedsEditing: draft.printingNeedsEditing,
    serviceFee: configuredServiceFee ?? undefined,
  })
  if (!Number.isFinite(pricing.totalAmount) || pricing.totalAmount < 0) throw new SammyApiError(400, 'INVALID_AMOUNT', 'Enter valid order details.')
  const isTestOrder = shouldCreateTestOrder(user)
  if (!canCreateOrder(isTestOrder)) throw new SammyApiError(503, 'OPERATIONS_SUSPENDED', 'SwiftDU operations are currently suspended.')
  const operations = getOperationsStatus(new Date(), await getOperationsSettings())
  if (!isTestOrder && !operations.open) throw new SammyApiError(409, 'OUTSIDE_OPERATING_HOURS', 'SwiftDU is closed for today.')

  const serviceFeeDiscount = Boolean(user.serviceFeeDiscountEnabled && Number(user.serviceFeeDiscountRemainingOrders || 0) > 0 && !(await hasActiveServiceFeeDiscountReservation(String(user._id))) && pricing.serviceFee > 0)
  const firstOrder = isTestOrder ? false : (await firstOrderBonusEligibility(String(user._id))).eligible
  const adjusted = priceWithOrderDiscounts(pricing, { firstOrderBonus: firstOrder, serviceFeeDiscount, cafeInquiry })
  return {
    amount: pricing.amount,
    serviceFee: adjusted.serviceFee,
    totalAmount: adjusted.totalAmount,
    firstOrderBonusApplied: adjusted.firstOrderBonusApplied,
    firstOrderBonusAmount: adjusted.firstOrderBonusAmount || 0,
    serviceFeeDiscountApplied: serviceFeeDiscount,
    breakdown: [
      { id: 'items', label: cafeInquiry ? 'Cafe inquiry' : 'Order amount', amount: pricing.amount },
      { id: 'service_fee', label: 'Service fee', amount: adjusted.serviceFee },
    ],
  }
}
