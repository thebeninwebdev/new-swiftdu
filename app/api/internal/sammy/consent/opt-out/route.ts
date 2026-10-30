import { type NextRequest } from 'next/server'

import { readSammyBody, resolveSammyCustomer, withSammy } from '@/lib/sammy/server'

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string }>(request)
    const { registration } = await resolveSammyCustomer(body.phone)
    registration.whatsappNotificationsEnabled = false
    registration.whatsappConsentRevokedAt = new Date()
    await registration.save()
    return { optedOut: true, proactiveNotifications: false }
  })
}
