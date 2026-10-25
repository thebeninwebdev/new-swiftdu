import { Types } from 'mongoose'
import CampusLocation from '@/models/campus-location'
import { Vendor, type IVendor, type VendorServiceType, VENDOR_SERVICE_TYPES } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'

export const normalizeVendorName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()
export const isVendorServiceType = (value: string): value is VendorServiceType => VENDOR_SERVICE_TYPES.includes(value as VendorServiceType)
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
