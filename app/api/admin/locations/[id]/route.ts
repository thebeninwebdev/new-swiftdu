import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import { connectDB } from '@/lib/db'
import CampusLocation from '@/models/campus-location'
import { validateCampusLocationInput, validateTaskerGenderRestriction } from '@/lib/campus-location'

async function authorized(headers: Headers) {
  return getAdminDashboardAccess(headers)
}

function coordinatesAreUnchanged(value: unknown, saved: { latitude: number; longitude: number; accuracy?: number; capturedAt: Date }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const submitted = value as { latitude?: unknown; longitude?: unknown; accuracy?: unknown; capturedAt?: unknown }
  return submitted.latitude === saved.latitude && submitted.longitude === saved.longitude && submitted.accuracy === saved.accuracy && new Date(String(submitted.capturedAt)).getTime() === new Date(saved.capturedAt).getTime()
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await authorized(request.headers)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    const { id } = await params
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid location.' }, { status: 400 })
    await connectDB()
    const current = await CampusLocation.findById(id)
    if (!current) return NextResponse.json({ error: 'Location not found.' }, { status: 404 })
    const body = await request.json()
    if (typeof body.active === 'boolean' && Object.keys(body).length === 1) {
      current.active = body.active
      await current.save()
      return NextResponse.json({ location: current })
    }
    const input = validateCampusLocationInput(body, new Date(), coordinatesAreUnchanged(body.coordinates, current.coordinates))
    const parentId = body.parentLocationId || null
    const isCurrentParent = !current.parentLocationId
    if (isCurrentParent && parentId) return NextResponse.json({ error: 'A parent location cannot become an exact location.' }, { status: 400 })
    if (!isCurrentParent && !parentId) return NextResponse.json({ error: 'An exact location cannot become a parent location.' }, { status: 400 })
    if (parentId) {
      if (!Types.ObjectId.isValid(parentId)) return NextResponse.json({ error: 'Parent location was not found.' }, { status: 400 })
      const parent = await CampusLocation.findOne({ _id: parentId, parentLocationId: null, active: true }).lean()
      if (!parent) return NextResponse.json({ error: 'Exact locations must belong to an active parent location.' }, { status: 400 })
    }
    Object.assign(current, input, {
      parentLocationId: parentId,
      ...(isCurrentParent ? { deliveryPolicy: { ...current.deliveryPolicy, taskerGenderRestriction: validateTaskerGenderRestriction(body.taskerGenderRestriction) } } : {}),
    })
    await current.save()
    return NextResponse.json({ location: current })
  } catch (error) {
    if (error instanceof Error) {
      if ((error as Error & { code?: number }).code === 11000) return NextResponse.json({ error: 'A location with this name already exists under that parent.' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update location.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return PATCH(new NextRequest(request.url, { method: 'PATCH', headers: request.headers, body: JSON.stringify({ active: false }) }), context)
}
