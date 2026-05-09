import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { PushSubscription } from '@/models/push-subscription'

interface PushSubscriptionBody {
  endpoint?: string
  expirationTime?: number | null
  keys?: {
    p256dh?: string
    auth?: string
  }
}

function getSessionRole(role?: unknown) {
  return role === 'admin' || role === 'tasker' ? role : 'user'
}

export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as PushSubscriptionBody

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription.' },
        { status: 400 }
      )
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: body.endpoint },
      {
        $set: {
          userId: session.user.id,
          role: getSessionRole(session.user.role),
          endpoint: body.endpoint,
          expirationTime: body.expirationTime ?? null,
          keys: {
            p256dh: body.keys.p256dh,
            auth: body.keys.auth,
          },
          userAgent: request.headers.get('user-agent') || undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Push Subscription POST Error]:', error)
    return NextResponse.json(
      { error: 'Failed to save push subscription.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as PushSubscriptionBody

    if (!body.endpoint) {
      return NextResponse.json(
        { error: 'Subscription endpoint is required.' },
        { status: 400 }
      )
    }

    await PushSubscription.deleteOne({
      endpoint: body.endpoint,
      userId: session.user.id,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Push Subscription DELETE Error]:', error)
    return NextResponse.json(
      { error: 'Failed to remove push subscription.' },
      { status: 500 }
    )
  }
}
