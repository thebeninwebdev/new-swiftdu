import { type NextRequest } from 'next/server'

import { readSammyBody, withSammy } from '@/lib/sammy/server'
import { resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'
import { getSammyStaffFirstName } from '@/lib/sammy/staff-display-name'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity }>(request)
    const staff = await resolveSammyStaff(body.telegram || { id: '' })
    return {
      approved: true,
      staff: {
        id: String(staff._id),
        name: staff.name || staff.telegramFirstName || 'Staff',
        firstName: getSammyStaffFirstName(staff),
        role: staff.role,
      },
    }
  })
}
