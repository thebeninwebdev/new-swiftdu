import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { classifyDeliveryLocation } from '@/lib/delivery-policy'
import { getAvailableIndomieCapacity } from '@/lib/indomie-capacity'
import { getNextAvailableIndomieRun, indomieArrivalWindow, isRunStillBookable } from '@/lib/indomie-runs'
import { shouldCreateTestOrder } from '@/lib/test-orders'
import { User } from '@/models/user'

/** Customer-safe capacity view. It exposes spots, never tasker counts or gender. */
export async function GET(request: NextRequest) {
  await connectDB()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const location = String(request.nextUrl.searchParams.get('location') || '').trim()
  if (!location || !classifyDeliveryLocation(location)) return NextResponse.json({ error: 'Choose a valid delivery destination.' }, { status: 400 })
  const [, account] = await Promise.all([
    Promise.resolve(),
    User.findById(session.user.id).select('isExco testOrderMode').lean(),
  ])
  const now = new Date()
  const run = getNextAvailableIndomieRun(now)
  if (!run || !isRunStillBookable(run, now)) return NextResponse.json({ active: false, batch: null, availableSlots: 0 })
  const availableSlots = await getAvailableIndomieCapacity({ location, isTestOrder: shouldCreateTestOrder(account || undefined) })
  const arrival = indomieArrivalWindow(run)
  return NextResponse.json({ active: true, scheduledFor: run, bookingClosesAt: new Date(run.getTime() - 10 * 60_000), estimatedArrivalStart: arrival.start, estimatedArrivalEnd: arrival.end, availableSlots, status: availableSlots > 0 ? 'available' : 'full', batch: { scheduledFor: run, bookingOpen: availableSlots > 0, status: availableSlots > 0 ? 'available' : 'full' } }, { headers: { 'Cache-Control': 'no-store' } })
}
