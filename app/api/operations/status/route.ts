import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { areOperationsEnabled } from '@/lib/operations'
import { getIndomieBatchSettings } from '@/lib/indomie-batch-settings'
import { formatMinute, getIndomieServiceMode, getOperationsSettings, getOperationsStatus, OPERATIONS_TIMEZONE } from '@/lib/operations-settings'

export async function GET() {
  await connectDB()
  const now = new Date(), operations = await getOperationsSettings(), batching = await getIndomieBatchSettings(), status = getOperationsStatus(now, operations), enabled = areOperationsEnabled()
  return NextResponse.json({ enabled, open: enabled && status.open, timezone: OPERATIONS_TIMEZONE, openingTime: formatMinute(operations.openMinute), closingTime: formatMinute(operations.closeMinute), nextOpeningAt: status.nextOpeningAt, indomie: { mode: enabled ? getIndomieServiceMode({ now, operationsSettings: operations, batchingSettings: batching }) : 'closed', batchingStartsAt: formatMinute(batching.startMinute), batchingEndsAt: formatMinute(batching.endMinute) }, serverNow: now })
}
