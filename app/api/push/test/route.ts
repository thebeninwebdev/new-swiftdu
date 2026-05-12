import { NextRequest, NextResponse } from 'next/server'

import { sendTaskerTestPush } from '@/lib/push-notifications'
import { requireApprovedTasker } from '@/lib/tasker-push-subscriptions'

export async function GET(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  const result = await sendTaskerTestPush()

  return NextResponse.json(result)
}
