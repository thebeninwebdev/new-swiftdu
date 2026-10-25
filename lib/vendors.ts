import { Types } from 'mongoose'
import CampusLocation from '@/models/campus-location'
import { Vendor, type IVendor, type VendorServiceType, VENDOR_SERVICE_TYPES } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'

export const normalizeVendorName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()
export const isVendorServiceType = (value: string): value is VendorServiceType => VENDOR_SERVICE_TYPES.includes(value as VendorServiceType)
export class VendorPricingError extends Error { constructor(public code: string, message: string) { super(message) } }
export async function resolveVendorDeliveryPricing(input: { vendorId: string; dropoffParentLocationId: string; expectedServiceType: string }) {
  if (!Types.ObjectId.isValid(input.vendorId)) throw new VendorPricingError('VENDOR_NOT_FOUND', 'Vendor not found.')
  if (!Types.ObjectId.isValid(input.dropoffParentLocationId)) throw new VendorPricingError('DROPOFF_LOCATION_UNAVAILABLE', 'Drop-off location is unavailable.')
  const vendor = await Vendor.findById(input.vendorId).lean()
  if (!vendor) throw new VendorPricingError('VENDOR_NOT_FOUND', 'Vendor not found.')
  if (!vendor.active) throw new VendorPricingError('VENDOR_INACTIVE', 'Vendor is unavailable.')
  if (vendor.serviceType !== input.expectedServiceType) throw new VendorPricingError('VENDOR_WRONG_SERVICE_TYPE', 'Vendor does not provide this service.')
  if (!vendor.pickupParentLocationId) throw new VendorPricingError('VENDOR_PICKUP_UNAVAILABLE', 'Vendor pickup is unavailable.')
  const [pickup, dropoff] = await Promise.all([CampusLocation.findOne({ _id: vendor.pickupParentLocationId, parentLocationId: null, active: true }).select('_id name').lean(), CampusLocation.findOne({ _id: input.dropoffParentLocationId, parentLocationId: null, active: true }).select('_id name').lean()])
  if (!pickup) throw new VendorPricingError('VENDOR_PICKUP_UNAVAILABLE', 'Vendor pickup is unavailable.')
  if (!dropoff) throw new VendorPricingError('DROPOFF_LOCATION_UNAVAILABLE', 'Drop-off location is unavailable.')
  let exact: { _id: Types.ObjectId; name: string } | null = null
  if (vendor.pickupExactLocationId) { exact = await CampusLocation.findOne({ _id: vendor.pickupExactLocationId, parentLocationId: pickup._id, active: true }).select('_id name').lean(); if (!exact) throw new VendorPricingError('VENDOR_PICKUP_UNAVAILABLE', 'Vendor pickup is unavailable.') }
  const rule = await VendorDeliveryRule.findOne({ vendorId: vendor._id, dropoffParentLocationId: dropoff._id, enabled: true }).lean()
  if (!rule) throw new VendorPricingError('VENDOR_DOES_NOT_SERVE_LOCATION', 'This vendor does not currently deliver to this location.')
  return { vendor: { id: String(vendor._id), name: vendor.name, serviceType: vendor.serviceType }, pickup: { parentLocationId: String(pickup._id), parentLocationName: pickup.name, exactLocationId: exact ? String(exact._id) : undefined, exactLocationName: exact?.name }, dropoff: { parentLocationId: String(dropoff._id), parentLocationName: dropoff.name }, serviceFee: rule.serviceFee }
}
export async function isVendorReadyForOrders(vendor: Pick<IVendor, 'active' | 'pickupParentLocationId'>) {
  if (!vendor.active || !vendor.pickupParentLocationId) return false
  const [pickup, coverage] = await Promise.all([
    CampusLocation.exists({ _id: vendor.pickupParentLocationId, parentLocationId: null, active: true }),
    VendorDeliveryRule.exists({ vendorId: (vendor as IVendor & { _id: Types.ObjectId })._id, enabled: true }),
  ])
  return Boolean(pickup && coverage)
}
export async function validateVendorLocations(pickupParentLocationId?: string | null, pickupExactLocationId?: string | null) {
  if (!pickupParentLocationId) return { parent: null, exact: null }
  if (!Types.ObjectId.isValid(pickupParentLocationId)) throw new Error('Pickup parent location is invalid.')
  const parent = await CampusLocation.findOne({ _id: pickupParentLocationId, parentLocationId: null, active: true }).select('_id name').lean()
  if (!parent) throw new Error('Pickup must be an active parent location.')
  if (!pickupExactLocationId) return { parent, exact: null }
  if (!Types.ObjectId.isValid(pickupExactLocationId)) throw new Error('Pickup exact location is invalid.')
  const exact = await CampusLocation.findOne({ _id: pickupExactLocationId, parentLocationId: parent._id, active: true }).select('_id name').lean()
  if (!exact) throw new Error('Pickup exact location must belong to the pickup parent.')
  return { parent, exact }
}
