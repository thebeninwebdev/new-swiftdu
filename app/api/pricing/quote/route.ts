import { NextRequest, NextResponse } from 'next/server'
import { getConfiguredServiceFeeResolution } from '@/lib/pricing-config'
import { connectDB } from '@/lib/db'
import CampusLocation from '@/models/campus-location'
import { Types } from 'mongoose'

export async function GET(request: NextRequest) {
  await connectDB()
  const taskType = request.nextUrl.searchParams.get('taskType') || ''
  const requestedParentId = request.nextUrl.searchParams.get('parentLocationId')
  let location = request.nextUrl.searchParams.get('location')
  if (requestedParentId) {
    if (!Types.ObjectId.isValid(requestedParentId)) return NextResponse.json({ error: 'Invalid parent location.' }, { status: 400 })
    const parent = await CampusLocation.findOne({ _id: requestedParentId, parentLocationId: null, active: true }).select('name coordinates').lean()
    if (!parent) return NextResponse.json({ error: 'Parent location is unavailable.' }, { status: 400 })
    // The parent coordinate is deliberately resolved here; exact-location coordinates are never read for pricing.
    location = parent.name
  }
  const quote = await getConfiguredServiceFeeResolution({ taskType, location })
  return quote === null
    ? NextResponse.json({ error: 'No configured service fee for this task.' }, { status: 400 })
    : NextResponse.json(quote)
}
