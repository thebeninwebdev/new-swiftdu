import { type NextRequest } from 'next/server'

import { createStaffCustomer, resolveSammyStaff, type TelegramIdentity } from '@/lib/sammy/staff'
import { readSammyBody, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{
      telegram?: TelegramIdentity
      customer?: { name?: unknown; phone?: unknown; whatsapp?: unknown; email?: unknown }
    }>(request)
    const staff = await resolveSammyStaff(body.telegram || { id: '' })
    return createStaffCustomer(body.customer || {}, staff)
  })
}
