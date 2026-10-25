import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredServiceFeeResolution } from '@/lib/pricing-config'
import { connectDB } from '@/lib/db'
import CampusLocation from '@/models/campus-location'
import { Types } from 'mongoose'
import { resolveVendorDeliveryPricing, VendorPricingError } from '@/lib/vendors'

export async function GET(request: NextRequest) {
  await connectDB()
  const vendorId = request.nextUrl.searchParams.get('vendorId')
  const dropoffParentLocationId = request.nextUrl.searchParams.get('dropoffParentLocationId')
  if (vendorId || dropoffParentLocationId) {
    if (!vendorId || !dropoffParentLocationId || !Types.ObjectId.isValid(vendorId) || !Types.ObjectId.isValid(dropoffParentLocationId)) return NextResponse.json({ error: 'Valid vendor and drop-off parent are required.' }, { status: 400 })
    try { return NextResponse.json(await resolveVendorDeliveryPricing({ vendorId, dropoffParentLocationId, expectedServiceType: request.nextUrl.searchParams.get('taskType') || '' })) } catch (error) { const e = error as VendorPricingError; return NextResponse.json({ error: e.message, code: e.code }, { status: 400 }) }
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
