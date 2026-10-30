import { type NextRequest } from 'next/server'
import { Types } from 'mongoose'

import { readSammyBody, resolveSammyCustomer, SammyApiError, withSammy } from '@/lib/sammy/server'
import CampusLocation from '@/models/campus-location'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string; parentLocationId?: string }>(request)
    await resolveSammyCustomer(body.phone)
    if (!body.parentLocationId || !Types.ObjectId.isValid(body.parentLocationId)) throw new SammyApiError(400, 'INVALID_PARENT_LOCATION', 'Choose a valid parent location.')
    const parent = await CampusLocation.findOne({ _id: body.parentLocationId, parentLocationId: null, active: true }).select('_id').lean()
    if (!parent) throw new SammyApiError(400, 'INVALID_PARENT_LOCATION', 'Choose an active parent location.')
    const locations = await CampusLocation.find({ parentLocationId: parent._id, active: true }).select('_id name type parentLocationId').sort({ name: 1 }).lean()
    return { locations: locations.map(location => ({ id: String(location._id), name: location.name, type: location.type, parentLocationId: String(location.parentLocationId) })) }
  })
}
