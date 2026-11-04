import { type NextRequest } from 'next/server'
import { Types } from 'mongoose'

import { readSammyBody, SammyApiError, withSammy } from '@/lib/sammy/server'
import { listStaffRegistrationHostels, resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'
import CampusLocation from '@/models/campus-location'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity; parentLocationId?: string }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })
    if (!body.parentLocationId) {
      return { locations: await listStaffRegistrationHostels() }
    }
    if (!body.parentLocationId || !Types.ObjectId.isValid(body.parentLocationId)) {
      throw new SammyApiError(400, 'INVALID_PARENT_LOCATION', 'Choose a valid parent location.')
    }
    const parent = await CampusLocation.findOne({
      _id: body.parentLocationId,
      parentLocationId: null,
      active: true,
    }).select('_id name type deliveryPolicy').lean()
    if (!parent) throw new SammyApiError(400, 'INVALID_PARENT_LOCATION', 'Choose an active parent location.')
    const locations = await CampusLocation.find({ parentLocationId: parent._id, active: true })
      .select('_id name type parentLocationId')
      .sort({ name: 1 })
      .lean()
    return {
      parent: {
        id: String(parent._id),
        name: parent.name,
        type: parent.type,
        requiresRoomNumber: parent.deliveryPolicy?.requiresRoomNumber ?? parent.type === 'hostel',
      },
      locations: locations.map(location => ({
        id: String(location._id),
        name: location.name,
        type: location.type,
        parentLocationId: String(location.parentLocationId),
      })),
    }
  })
}
