import { NextRequest, NextResponse } from 'next/server'
import { processDueOrderEscalations } from '@/lib/orders/order-escalation'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDueOrderEscalations()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[CRON /api/cron/order-escalation]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Escalation processing failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
