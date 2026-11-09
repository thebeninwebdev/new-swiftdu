import { NextRequest, NextResponse } from 'next/server'

import { sendTestPushToUser } from '@/lib/push-notifications'
import { requireApprovedTasker } from '@/lib/tasker-push-subscriptions'

export async function GET(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  // Safe non-broadcasting test push to the calling tasker only
  const result = await sendTestPushToUser(taskerAuth.userId)

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  return GET(request)
}
