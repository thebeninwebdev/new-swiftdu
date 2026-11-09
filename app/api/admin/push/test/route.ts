import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'

import { getAdminDashboardAccess } from '@/lib/admin-access'
import { connectDB } from '@/lib/db'
import { sendPushNotification } from '@/lib/push-notifications'
import { PushSubscription } from '@/models/push-subscription'
import Tasker from '@/models/tasker'
import { User } from '@/models/user'

export async function POST(request: NextRequest) {
  try {
    if (!(await getAdminDashboardAccess(request.headers))) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    await connectDB()

    const body = (await request.json().catch(() => ({}))) as {
      targetUserId?: string
      targetTaskerId?: string
      endpoint?: string
    }

    let resolvedUserId: string | null = null

    if (body.targetUserId?.trim()) {
      resolvedUserId = body.targetUserId.trim()
    } else if (body.targetTaskerId?.trim()) {
      const taskerId = body.targetTaskerId.trim()
      const query = Types.ObjectId.isValid(taskerId)
        ? { _id: taskerId }
        : null

      if (!query) {
        return NextResponse.json({ error: 'Invalid tasker ID.' }, { status: 400 })
      }

      const tasker = await Tasker.findOne(query).select('userId').lean<{ userId?: Types.ObjectId }>()
      if (!tasker?.userId) {
        return NextResponse.json(
          { error: 'Tasker not found or not linked to a user account.' },
          { status: 404 }
        )
      }
      resolvedUserId = tasker.userId.toString()
    }

    if (!resolvedUserId) {
      return NextResponse.json(
        { error: 'Provide targetUserId or targetTaskerId.' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await User.findById(resolvedUserId).select('_id name email role').lean()
    if (!user) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 })
    }

    // Check available push subscriptions for diagnostics
    const subscriptionQuery: Record<string, unknown> = { userId: resolvedUserId }
    if (body.endpoint?.trim()) {
      subscriptionQuery.endpoint = body.endpoint.trim()
    }

    const subscriptions = await PushSubscription.find(subscriptionQuery)
      .select('endpoint expirationTime updatedAt')
      .lean<Array<{ endpoint: string; expirationTime?: number; updatedAt?: Date }>>()

    if (subscriptions.length === 0) {
      return NextResponse.json({
        ok: false,
        reason: 'No push subscriptions found for this user.',
        targetUserId: resolvedUserId,
        subscriptionCount: 0,
      }, { status: 404 })
    }

    const result = await sendPushNotification({
      audience: { userIds: [resolvedUserId] },
      title: 'SwiftDU Admin Diagnostic Test',
      body: 'Diagnostic push notification from SwiftDU administration.',
      url: '/tasker-dashboard',
      tag: `admin-diagnostic-${Date.now()}`,
      category: 'admin_test',
    })

    return NextResponse.json({
      ok: result.deliveredCount > 0,
      targetUserId: resolvedUserId,
      targetUserEmail: user.email,
      targetRole: user.role,
      subscriptionCount: subscriptions.length,
      deliveredCount: result.deliveredCount,
      expiredCount: result.expiredCount || 0,
      reason: result.reason,
      endpoints: subscriptions.map(s => {
        try {
          return new URL(s.endpoint).host
        } catch {
          return 'invalid-endpoint'
        }
      }),
    })
  } catch (error) {
    console.error('[POST /api/admin/push/test]', error)
    return NextResponse.json(
      { error: 'Failed to execute push diagnostic test.' },
      { status: 500 }
    )
  }
}
