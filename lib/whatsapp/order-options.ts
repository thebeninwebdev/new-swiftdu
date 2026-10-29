import 'server-only'

import { Types } from 'mongoose'

import CampusLocation from '@/models/campus-location'
import { Vendor } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'

export type WhatsAppVendorOption = {
  id: string
  name: string
  destinations: Array<{
    id: string
    name: string
    type: string
    requiresRoomNumber: boolean
  }>
}

export async function getWhatsAppVendorOptions(
  serviceType: 'restaurant' | 'shopping' | 'printing'
): Promise<WhatsAppVendorOption[]> {
  const vendors = await Vendor.find({ serviceType, active: true, pickupParentLocationId: { $ne: null } })
    .select('_id name pickupParentLocationId')
    .sort({ name: 1 })
    .lean()
  const vendorIds = vendors.map((vendor) => vendor._id)
  if (!vendorIds.length) return []
  const rules = await VendorDeliveryRule.find({ vendorId: { $in: vendorIds }, enabled: true })
    .select('vendorId dropoffParentLocationId')
    .lean()
  const locationIds = [
    ...vendors.map((vendor) => vendor.pickupParentLocationId).filter((id): id is Types.ObjectId => id instanceof Types.ObjectId),
    ...rules.map((rule) => rule.dropoffParentLocationId),
  ]
  const locations = await CampusLocation.find({ _id: { $in: locationIds }, active: true })
    .select('_id name type parentLocationId deliveryPolicy')
    .lean()
  const byId = new Map(locations.map((location) => [String(location._id), location]))

  return vendors.flatMap((vendor) => {
    if (!byId.has(String(vendor.pickupParentLocationId))) return []
    const destinations = rules
      .filter((rule) => String(rule.vendorId) === String(vendor._id))
      .flatMap((rule) => {
        const location = byId.get(String(rule.dropoffParentLocationId))
        if (!location || location.parentLocationId) return []
        return [{
          id: String(location._id),
          name: location.name,
          type: location.type,
          requiresRoomNumber: location.deliveryPolicy?.requiresRoomNumber ?? location.type === 'hostel',
        }]
      })
    return destinations.length ? [{ id: String(vendor._id), name: vendor.name, destinations }] : []
  })
}

export async function getExactLocationOptions(parentLocationId: string) {
  if (!Types.ObjectId.isValid(parentLocationId)) return []
  const rows = await CampusLocation.find({ parentLocationId, active: true })
    .select('_id name')
    .sort({ name: 1 })
    .lean()
  return rows.map((row) => ({ id: String(row._id), name: row.name }))
}

export async function getActiveParentLocationOptions() {
  const rows = await CampusLocation.find({ parentLocationId: null, active: true })
    .select('_id name type deliveryPolicy')
    .sort({ name: 1 })
    .lean()
  return rows.map((row) => ({
    id: String(row._id),
    name: row.name,
    type: row.type,
    requiresRoomNumber: row.deliveryPolicy?.requiresRoomNumber ?? row.type === 'hostel',
  }))
}
