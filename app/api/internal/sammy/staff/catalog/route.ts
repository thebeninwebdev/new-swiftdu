import { NextRequest, NextResponse } from 'next/server'

import { GET as getVendors } from '@/app/api/vendors/route'
import { SAMMY_TASK_TYPES, type SammyTaskType } from '@/lib/sammy/contracts'
import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'
import CampusLocation from '@/models/campus-location'
import { Vendor } from '@/models/vendor'
import { RESTAURANT_MAX_PEOPLE } from '@/lib/pricing'

const LABELS: Record<SammyTaskType, string> = {
  restaurant: 'Restaurant',
  shopping: 'Store Shopping',
  printing: 'Printing',
  water: 'Water',
  indomie: 'Indomie',
}

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity; taskType?: SammyTaskType }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })

    if (!body.taskType) {
      const activeVendorTypes = new Set(await Vendor.distinct('serviceType', { active: true }))
      return {
        services: SAMMY_TASK_TYPES
          .filter(taskType => taskType === 'water' || taskType === 'indomie' || activeVendorTypes.has(taskType))
          .map(id => ({
            id,
            label: LABELS[id],
            ...(id === 'restaurant' ? { configuration: { maxPeople: RESTAURANT_MAX_PEOPLE } } : {}),
          })),
      }
    }
    if (!SAMMY_TASK_TYPES.includes(body.taskType)) {
      throw new SammyApiError(400, 'INVALID_TASK_TYPE', 'Choose a supported service.')
    }
    if (body.taskType === 'water' || body.taskType === 'indomie') {
      const locations = await CampusLocation.find({
        parentLocationId: null,
        active: true,
        'deliveryPolicy.enabled': { $ne: false },
      }).select('_id name type deliveryPolicy').sort({ name: 1 }).lean()
      return {
        vendors: [],
        destinations: locations.map(location => ({
          parentLocationId: String(location._id),
          name: location.name,
          type: location.type,
          requiresRoomNumber: location.deliveryPolicy?.requiresRoomNumber ?? location.type === 'hostel',
        })),
      }
    }

    const internalRequest = new NextRequest(new URL('/api/vendors?serviceType=' + body.taskType, request.url))
    const response = await getVendors(internalRequest)
    const payload = await response.json()
    if (!response.ok) return NextResponse.json(payload, { status: response.status })
    return {
      vendors: (payload.vendors || []).map((vendor: Record<string, unknown>) => ({
        id: vendor.id,
        name: vendor.name,
        serviceType: vendor.serviceType,
        destinations: Array.isArray(vendor.destinations)
          ? vendor.destinations.map((destination: Record<string, unknown>) => ({
              parentLocationId: destination.parentLocationId,
              name: destination.name,
              type: destination.type,
              requiresRoomNumber: destination.requiresRoomNumber,
            }))
          : [],
      })),
      supportsChooseFromAnywhere: body.taskType === 'restaurant',
    }
  })
}
