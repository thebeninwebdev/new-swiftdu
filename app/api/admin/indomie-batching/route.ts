import { NextRequest, NextResponse } from 'next/server'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import { connectDB } from '@/lib/db'
import { IndomieBatchSettings } from '@/models/indomie-batch-settings'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'
import { getOperationsSettings } from '@/lib/operations-settings'

async function admin(request: NextRequest) { return getAdminDashboardAccess(request.headers) }
export async function GET(request: NextRequest) { if (!await admin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); await connectDB(); return NextResponse.json({ ...await getIndomieBatchSettings(), timezone: 'Africa/Lagos' }) }
export async function PATCH(request: NextRequest) {
  const access = await admin(request); if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB()
  const body = await request.json()
  const startMinute = Number(body.startMinute), endMinute = Number(body.endMinute), runIntervalMinutes = Number(body.runIntervalMinutes), bookingCutoffMinutes = Number(body.bookingCutoffMinutes)
  if (![startMinute, endMinute, runIntervalMinutes, bookingCutoffMinutes].every(Number.isInteger) || startMinute < 0 || endMinute > 1440 || startMinute >= endMinute || runIntervalMinutes < 5 || runIntervalMinutes > 120 || bookingCutoffMinutes < 1 || bookingCutoffMinutes >= runIntervalMinutes) return NextResponse.json({ error: 'Choose valid batching hours, run interval, and a cutoff shorter than the run interval.' }, { status: 400 })
  const operations = await getOperationsSettings()
  if (!(operations.openMinute < startMinute && startMinute < endMinute && endMinute <= operations.closeMinute)) return NextResponse.json({ error: 'Indomie batching must start after SwiftDU opens and end no later than SwiftDU closes.' }, { status: 400 })
  const settings = await IndomieBatchSettings.findOneAndUpdate({ key: 'default' }, { $set: { startMinute, endMinute, runIntervalMinutes, bookingCutoffMinutes, updatedBy: access.userId }, $unset: { windowMinutes: 1 } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  return NextResponse.json({ startMinute: settings.startMinute, endMinute: settings.endMinute, runIntervalMinutes: settings.runIntervalMinutes, bookingCutoffMinutes: settings.bookingCutoffMinutes, timezone: 'Africa/Lagos' })
}
