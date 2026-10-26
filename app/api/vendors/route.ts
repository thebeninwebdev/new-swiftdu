import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { Vendor } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'
import CampusLocation from '@/models/campus-location'
import { isVendorServiceType } from '@/lib/vendors'

export async function GET(request: NextRequest) {
  await connectDB()
  const serviceType = request.nextUrl.searchParams.get('serviceType') || ''
  if (!isVendorServiceType(serviceType)) return NextResponse.json({ error: 'Valid serviceType is required.' }, { status: 400 })

  // Keep this customer-facing response to three fixed queries: vendors, active
  // rules, then all referenced locations. Do not add per-vendor lookups here.
  const vendors = await Vendor.find({ serviceType, active: true, pickupParentLocationId: { $ne: null } })
    .select('_id name serviceType pickupParentLocationId')
    .sort({ name: 1 })
    .lean()
  const vendorIds = vendors.map(vendor => vendor._id)
  if (!vendorIds.length) return NextResponse.json({ vendors: [] })

  const rules = await VendorDeliveryRule.find({ vendorId: { $in: vendorIds }, enabled: true })
    .select('vendorId dropoffParentLocationId serviceFee')
    .lean()
  const pickupIds = vendors.map(vendor => vendor.pickupParentLocationId).filter((id): id is Types.ObjectId => id instanceof Types.ObjectId)
  const dropoffIds = rules.map(rule => rule.dropoffParentLocationId)
  const locations = await CampusLocation.find({
    _id: { $in: [...pickupIds, ...dropoffIds] },
    parentLocationId: null,
    active: true,
  }).select('_id name type deliveryPolicy').lean()

  const locationsById = new Map(locations.map(location => [String(location._id), location]))
  const rulesByVendor = new Map<string, typeof rules>()
  for (const rule of rules) {
    const id = String(rule.vendorId)
    rulesByVendor.set(id, [...(rulesByVendor.get(id) || []), rule])
  }

  return NextResponse.json({
    vendors: vendors.flatMap(vendor => {
      if (!locationsById.has(String(vendor.pickupParentLocationId))) return []
      const destinations = (rulesByVendor.get(String(vendor._id)) || []).flatMap(rule => {
        const location = locationsById.get(String(rule.dropoffParentLocationId))
        if (!location) return []
        return [{
          parentLocationId: String(location._id),
          name: location.name,
          type: location.type,
          serviceFee: rule.serviceFee,
          requiresRoomNumber: location.deliveryPolicy?.requiresRoomNumber ?? location.type === 'hostel',
        }]
      })
      if (!destinations.length) return []
      return [{ id: String(vendor._id), name: vendor.name, serviceType: vendor.serviceType, destinations }]
    }),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
