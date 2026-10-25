import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredServiceFeeResolution } from '@/lib/pricing-config'
import { connectDB } from '@/lib/db'
import CampusLocation from '@/models/campus-location'
import { Types } from 'mongoose'
import { Vendor } from '@/models/vendor'
import { VendorDeliveryRule } from '@/models/vendor-delivery-rule'

export async function GET(request: NextRequest) {
  await connectDB()
  const vendorId = request.nextUrl.searchParams.get('vendorId')
  const dropoffParentLocationId = request.nextUrl.searchParams.get('dropoffParentLocationId')
  if (vendorId || dropoffParentLocationId) {
    if (!vendorId || !dropoffParentLocationId || !Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(dropoffParentLocationId)) return NextResponse.json({ error: 'Valid vendor and drop-off parent are required.' }, { status: 400 })
    const vendor = await Vendor.findOne({ _id: vendorId, active: true, pickupParentLocationId: { $ne: null } }).lean()
    if (!vendor) return NextResponse.json({ error: 'Vendor unavailable.' }, { status: 400 })
    const [pickup, dropoff] = await Promise.all([CampusLocation.findOne({ _id: vendor.pickupParentLocationId, parentLocationId: null, active: true }).select('_id name').lean(), CampusLocation.findOne({ _id: dropoffParentLocationId, parentLocationId: null, active: true }).select('_id name').lean()])
    if (!pickup || !dropoff) return NextResponse.json({ error: 'Vendor pickup or drop-off location is unavailable.' }, { status: 400 })
    const rule = await VendorDeliveryRule.findOne({ vendorId: vendor._id, dropoffParentLocationId: dropoff._id, enabled: true }).lean()
    if (!rule) return NextResponse.json({ error: 'VENDOR_DOES_NOT_SERVE_LOCATION' }, { status: 400 })
    return NextResponse.json({ vendorId: String(vendor._id), vendorName: vendor.name, serviceType: vendor.serviceType, pickup: { parentLocationId: String(pickup._id), name: pickup.name }, dropoff: { parentLocationId: String(dropoff._id), name: dropoff.name }, serviceFee: rule.serviceFee })
  }
  const taskType = request.nextUrl.searchParams.get('taskType') || ''
  const requestedParentId = request.nextUrl.searchParams.get('parentLocationId')
  let parentLocationId: string | null = null
  if (requestedParentId) {
    if (!Types.ObjectId.isValid(requestedParentId)) return NextResponse.json({ error: 'Invalid parent location.' }, { status: 400 })
    const parent = await CampusLocation.findOne({ _id: requestedParentId, parentLocationId: null, active: true }).select('_id').lean()
    if (!parent) return NextResponse.json({ error: 'Parent location is unavailable.' }, { status: 400 })
    parentLocationId = String(parent._id)
  }
  const quote = await getConfiguredServiceFeeResolution({ taskType, parentLocationId })
  return quote === null
    ? NextResponse.json({ error: 'No configured service fee for this task.' }, { status: 400 })
    : NextResponse.json(quote)
}
