import { NextRequest, NextResponse } from 'next/server'

import { GET as getVendors } from '@/app/api/vendors/route'
import { readSammyBody, resolveSammyCustomer, SammyApiError, withSammy } from '@/lib/sammy/server'
import { SAMMY_TASK_TYPES, type SammyTaskType } from '@/lib/sammy/contracts'
import CampusLocation from '@/models/campus-location'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string; taskType?: SammyTaskType }>(request)
    await resolveSammyCustomer(body.phone)
    if (!body.taskType || !SAMMY_TASK_TYPES.includes(body.taskType)) throw new SammyApiError(400, 'INVALID_TASK_TYPE', 'Choose a supported service.')
    if (body.taskType === 'water') {
      const locations = await CampusLocation.find({ parentLocationId: null, active: true, 'deliveryPolicy.enabled': { $ne: false } })
        .select('_id name type deliveryPolicy')
        .sort({ name: 1 }).lean()
      return { vendors: [], destinations: locations.map(location => ({ parentLocationId: String(location._id), name: location.name, type: location.type, requiresRoomNumber: location.deliveryPolicy?.requiresRoomNumber ?? location.type === 'hostel' })), supportsChooseFromAnywhere: false }
    }
    const internalRequest = new NextRequest(new URL(`/api/vendors?serviceType=${body.taskType}`, request.url))
    const response = await getVendors(internalRequest)
    const payload = await response.json()
    if (!response.ok) return NextResponse.json(payload, { status: response.status })
    const vendors = (payload.vendors || []).map((vendor: Record<string, unknown>) => ({
      id: vendor.id, name: vendor.name, serviceType: vendor.serviceType,
      destinations: Array.isArray(vendor.destinations) ? vendor.destinations.map((destination: Record<string, unknown>) => ({ parentLocationId: destination.parentLocationId, name: destination.name, type: destination.type, requiresRoomNumber: destination.requiresRoomNumber })) : [],
    }))
    return { vendors, supportsChooseFromAnywhere: body.taskType === 'restaurant' }
  })
}
