import { NextRequest, NextResponse } from 'next/server'
import { getAdminDashboardAccess } from '@/lib/admin-access'
import { connectDB } from '@/lib/db'
import { OperationsSettings } from '@/models/operations-settings'
import { getOperationsSettings } from '@/lib/operations-settings'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'

async function admin(request: NextRequest) { return getAdminDashboardAccess(request.headers) }
export async function GET(request: NextRequest) { if (!await admin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); await connectDB(); return NextResponse.json({ ...await getOperationsSettings(), timezone: 'Africa/Lagos' }) }
export async function PATCH(request: NextRequest) {
  const access = await admin(request); if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await connectDB(); const body = await request.json(); const openMinute = Number(body.openMinute), closeMinute = Number(body.closeMinute)
  if (![openMinute, closeMinute].every(Number.isInteger) || openMinute < 0 || closeMinute > 1440 || openMinute >= closeMinute) return NextResponse.json({ error: 'Choose valid opening and closing times.' }, { status: 400 })
  const batching = await getIndomieBatchSettings()
  if (!(openMinute < batching.startMinute && batching.startMinute < batching.endMinute && batching.endMinute <= closeMinute)) return NextResponse.json({ error: 'SwiftDU must open before Indomie batching starts and close no earlier than batching ends.' }, { status: 400 })
  const settings = await OperationsSettings.findOneAndUpdate({ key: 'default' }, { $set: { openMinute, closeMinute, updatedBy: access.userId } }, { upsert: true, new: true, setDefaultsOnInsert: true })
  return NextResponse.json({ openMinute: settings.openMinute, closeMinute: settings.closeMinute, timezone: 'Africa/Lagos' })
}
