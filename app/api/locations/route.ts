import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import CampusLocation from '@/models/campus-location'

/** Customer-safe map data: parents first, then active exact locations for that parent. */
export async function GET(request: NextRequest) {
  await connectDB()
  const parentLocationId = request.nextUrl.searchParams.get('parentLocationId')
  const filter: Record<string, unknown> = { active: true }
  if (parentLocationId) {
    if (!Types.ObjectId.isValid(parentLocationId)) return NextResponse.json({ error: 'Invalid parent location.' }, { status: 400 })
    filter.parentLocationId = parentLocationId
  } else filter.parentLocationId = null
  const locations = await CampusLocation.find(filter).sort({ name: 1 }).select('name type parentLocationId coordinates').lean()
  return NextResponse.json({ locations })
}
