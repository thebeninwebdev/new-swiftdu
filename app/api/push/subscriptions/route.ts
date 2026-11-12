import { NextRequest, NextResponse } from 'next/server'

import {
  isBrowserPushSubscription,
  requireApprovedTasker,
  saveTaskerPushSubscription,
} from '@/lib/tasker-push-subscriptions'
import { PushSubscription } from '@/models/push-subscription'
import { connectDB } from '@/lib/db'

export async function GET(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  await connectDB()
  const subscriptions = await PushSubscription.find({
    userId: taskerAuth.userId,
    role: 'tasker',
  })
    .select('endpoint expirationTime createdAt updatedAt')
    .lean<Array<{ endpoint: string; expirationTime?: number; createdAt?: Date; updatedAt?: Date }>>()

  const currentEndpoint = request.headers.get('x-swiftdu-push-endpoint')
  return NextResponse.json({
    count: subscriptions.length,
    hasSubscription: subscriptions.length > 0,
    hasCurrentSubscription: Boolean(currentEndpoint && subscriptions.some(subscription => subscription.endpoint === currentEndpoint)),
    subscriptions: subscriptions.map(s => {
      let host = ''
      try {
        host = new URL(s.endpoint).host
      } catch {
        host = 'unknown'
      }
      return {
        endpointHost: host,
        expirationTime: s.expirationTime,
        updatedAt: s.updatedAt,
      }
    }),
  })
}

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

export async function DELETE(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  await connectDB()
  let endpoint: string | undefined
  try {
    const body = await request.json()
    if (typeof body?.endpoint === 'string') {
      endpoint = body.endpoint
    }
  } catch {
    // Body is optional
  }

  if (endpoint) {
    await PushSubscription.deleteOne({
      userId: taskerAuth.userId,
      role: 'tasker',
      endpoint,
    })
  } else {
    await PushSubscription.deleteMany({
      userId: taskerAuth.userId,
      role: 'tasker',
    })
  }

  return NextResponse.json({ ok: true })
}
