import type { PushSubscription as WebPushSubscription } from 'web-push'

import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { PushSubscription } from '@/models/push-subscription'
import Tasker from '@/models/tasker'
import type { NextRequest } from 'next/server'

export interface BrowserPushSubscription {
  endpoint: string
  expirationTime?: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

export function isBrowserPushSubscription(
  value: unknown
): value is BrowserPushSubscription {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<BrowserPushSubscription>

  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.length > 0 &&
    typeof candidate.keys?.p256dh === 'string' &&
    candidate.keys.p256dh.length > 0 &&
    typeof candidate.keys?.auth === 'string' &&
    candidate.keys.auth.length > 0
  )
}

export function toWebPushSubscription(
  subscription: BrowserPushSubscription
): WebPushSubscription {
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  }
}

export async function requireApprovedTasker(request: NextRequest) {
  await connectDB()

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session?.user?.id) {
    return { error: 'Unauthorized', status: 401 as const }
  }

  const tasker = await Tasker.findOne({
    userId: session.user.id,
    isVerified: true,
    isRejected: { $ne: true },
  })
    .select('_id')
    .lean()

  if (!tasker) {
    return { error: 'Approved tasker profile required.', status: 403 as const }
  }

  return { userId: session.user.id, taskerId: tasker._id.toString() }
}

export async function saveTaskerPushSubscription(input: {
  userId: string
  subscription: BrowserPushSubscription
  userAgent?: string | null
}) {
  await PushSubscription.findOneAndUpdate(
    { endpoint: input.subscription.endpoint },
    {
      $set: {
        userId: input.userId,
        role: 'tasker',
        endpoint: input.subscription.endpoint,
        expirationTime: input.subscription.expirationTime ?? null,
        keys: {
          p256dh: input.subscription.keys.p256dh,
          auth: input.subscription.keys.auth,
        },
        userAgent: input.userAgent || undefined,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  )
}
