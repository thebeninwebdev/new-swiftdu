import { type NextRequest } from 'next/server'

import { readSammyBody, withSammy } from '@/lib/sammy/server'
import { resolveSammyStaff, searchStaffCustomers, type TelegramIdentity } from '@/lib/sammy/staff'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ telegram?: TelegramIdentity; query?: unknown }>(request)
    await resolveSammyStaff(body.telegram || { id: '' })
    return { customers: await searchStaffCustomers(body.query) }
  })
}
