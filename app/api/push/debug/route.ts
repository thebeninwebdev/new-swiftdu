import { NextRequest, NextResponse } from 'next/server'

import { connectDB } from '@/lib/db'
import { sendTestPushToUser } from '@/lib/push-notifications'
import { requireApprovedTasker } from '@/lib/tasker-push-subscriptions'
import { PushSubscription } from '@/models/push-subscription'

async function getTaskerPushDebug(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  await connectDB()

  const subscriptions = await PushSubscription.find({
    userId: taskerAuth.userId,
    role: 'tasker',
  })
    .select('endpoint createdAt updatedAt userAgent')
    .lean<
      Array<{
        endpoint: string
        createdAt?: Date
        updatedAt?: Date
        userAgent?: string
      }>
    >()

  return NextResponse.json({
    userId: taskerAuth.userId,
    taskerId: taskerAuth.taskerId,
    subscriptionCount: subscriptions.length,
    subscriptions: subscriptions.map((subscription) => ({
      endpointHost: new URL(subscription.endpoint).host,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      userAgent: subscription.userAgent,
    })),
  })
}

export async function GET(request: NextRequest) {
  return getTaskerPushDebug(request)
}

export async function POST(request: NextRequest) {
  const taskerAuth = await requireApprovedTasker(request)

  if ('error' in taskerAuth) {
    return NextResponse.json({ error: taskerAuth.error }, { status: taskerAuth.status })
  }

  const result = await sendTestPushToUser(taskerAuth.userId)
  return NextResponse.json(result)
}
