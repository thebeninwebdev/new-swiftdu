import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { classifyDeliveryLocation } from '@/lib/delivery-policy'
import { getAvailableIndomieCapacity } from '@/lib/indomie-capacity'
import { getNextAvailableIndomieRun, indomieArrivalWindow, isRunStillBookable } from '@/lib/indomie-runs'
import { shouldCreateTestOrder } from '@/lib/test-orders'
import { User } from '@/models/user'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'
import { getIndomieServiceMode, getNextOpeningTime, getOperationsSettings } from '@/lib/operations-settings'

/** Customer-safe capacity view. It exposes spots, never tasker counts or gender. */
export async function GET(request: NextRequest) {
  let now = new Date()
  const response = (body: Record<string, unknown>, status = 200) => NextResponse.json(
    { ...body, serverNow: now.toISOString() },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
  await connectDB()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return response({ error: 'Unauthorized' }, 401)
  const location = String(request.nextUrl.searchParams.get('location') || '').trim()
  if (!location || !classifyDeliveryLocation(location)) return response({ error: 'Choose a valid delivery destination.' }, 400)
  const [settings, operations, account] = await Promise.all([
    getIndomieBatchSettings(),
    getOperationsSettings(),
    User.findById(session.user.id).select('isExco testOrderMode').lean(),
  ])
  // Take the authoritative business-time sample immediately before scheduling.
  now = new Date()
  const mode = getIndomieServiceMode({ now, operationsSettings: operations, batchingSettings: settings })
  if (mode !== 'batching') return response({ active: false, mode, nextAvailableAt: mode === 'closed' ? getNextOpeningTime(now, operations) : undefined, batch: null, availableSlots: 0 })
  const run = getNextAvailableIndomieRun(now, settings)
  if (!run || !isRunStillBookable(run, now, settings)) return response({ active: false, mode: 'closed', nextAvailableAt: getNextOpeningTime(now, operations), batch: null, availableSlots: 0 })
  const availableSlots = await getAvailableIndomieCapacity({ location, isTestOrder: shouldCreateTestOrder(account || undefined) })
  const arrival = indomieArrivalWindow(run)
  return response({ active: true, mode, scheduledFor: run, bookingClosesAt: new Date(run.getTime() - settings.bookingCutoffMinutes * 60_000), estimatedArrivalStart: arrival.start, estimatedArrivalEnd: arrival.end, availableSlots, status: availableSlots > 0 ? 'available' : 'full', batch: { scheduledFor: run, bookingOpen: availableSlots > 0, status: availableSlots > 0 ? 'available' : 'full' } })
}
