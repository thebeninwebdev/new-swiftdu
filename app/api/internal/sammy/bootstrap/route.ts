import { type NextRequest } from 'next/server'

import { areOperationsEnabled } from '@/lib/operations'
import { formatMinute, getOperationsSettings, getOperationsStatus } from '@/lib/operations-settings'
import { shouldCreateTestOrder } from '@/lib/test-orders'
import { compactSammyOrder, findCurrentCustomerOrder } from '@/lib/sammy/orders'
import { readSammyBody, resolveSammyCustomer, withSammy } from '@/lib/sammy/server'

const SERVICES = [
  { id: 'restaurant', label: 'Restaurant Food' },
  { id: 'shopping', label: 'Store Shopping' },
  { id: 'printing', label: 'Printing Services' },
  { id: 'water', label: 'Bag of Water' },
] as const

export async function POST(request: NextRequest) {
  return withSammy(request, async () => {
    const body = await readSammyBody<{ phone?: string }>(request)
    const { registration, user } = await resolveSammyCustomer(body.phone)
    const now = new Date()
    const settings = await getOperationsSettings()
    const status = getOperationsStatus(now, settings)
    const enabled = areOperationsEnabled()
    const testMode = shouldCreateTestOrder(user)
    const currentOrder = await findCurrentCustomerOrder(user)
    return {
      linked: true,
      consent: { transactional: Boolean(registration.whatsappConsentAt), proactiveNotifications: registration.whatsappNotificationsEnabled !== false },
      user: { id: String(user._id), name: user.name || '' },
      operations: { enabled, open: enabled && status.open, openingTime: formatMinute(settings.openMinute), closingTime: formatMinute(settings.closeMinute), nextOpeningAt: status.nextOpeningAt, serverNow: now },
      services: SERVICES.map(service => ({ ...service, available: testMode || (enabled && status.open) })),
      currentOrder: currentOrder ? compactSammyOrder(currentOrder) : null,
    }
  })
}
