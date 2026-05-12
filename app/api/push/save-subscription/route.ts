import { NextRequest, NextResponse } from 'next/server'

import {
  isBrowserPushSubscription,
  requireApprovedTasker,
  saveTaskerPushSubscription,
} from '@/lib/tasker-push-subscriptions'

export async function POST(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  const payload: unknown = await request.json()

  if (!isBrowserPushSubscription(payload)) {
    return NextResponse.json(
      { error: 'Invalid push subscription payload.' },
      { status: 400 }
    )
  }

  await saveTaskerPushSubscription({
    userId: taskerAuth.userId,
    subscription: payload,
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}
