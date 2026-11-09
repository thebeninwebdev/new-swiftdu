import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { syncTaskerSettlementStatus } from '@/lib/tasker-settlement'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const tasker = await Tasker.findOne({
      userId: session.user.id,
      isVerified: true,
      isRejected: { $ne: true },
    })
      .select('_id isSettlementSuspended orderAlertsEnabled whatsappAppPreference')
      .lean<{
        _id: unknown
        isSettlementSuspended?: boolean
        orderAlertsEnabled?: boolean
        whatsappAppPreference?: 'whatsapp' | 'whatsapp_business' | 'ask_every_time'
      }>()

    if (!tasker) {
      return NextResponse.json(
        { error: 'Approved tasker profile required.' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        orderAlertsEnabled: Boolean(tasker.orderAlertsEnabled),
        whatsappAppPreference: tasker.whatsappAppPreference || 'ask_every_time',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[GET /api/taskers/preferences]', error)
    return NextResponse.json(
      { error: 'Failed to load preferences.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const tasker = await Tasker.findOne({
      userId: session.user.id,
      isVerified: true,
      isRejected: { $ne: true },
    })

    if (!tasker) {
      return NextResponse.json(
        { error: 'Approved tasker profile required.' },
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => ({}))) as {
      orderAlertsEnabled?: unknown
      whatsappAppPreference?: unknown
    }

    const hasAlertsUpdate = typeof body.orderAlertsEnabled === 'boolean'
    const allowedPreferences = ['whatsapp', 'whatsapp_business', 'ask_every_time'] as const
    const hasPrefUpdate =
      typeof body.whatsappAppPreference === 'string' &&
      (allowedPreferences as readonly string[]).includes(body.whatsappAppPreference)

    if (!hasAlertsUpdate && !hasPrefUpdate) {
      return NextResponse.json(
        {
          error:
            'Provide at least orderAlertsEnabled (boolean) or whatsappAppPreference (whatsapp | whatsapp_business | ask_every_time).',
        },
        { status: 400 }
      )
    }

    // Check suspension if trying to enable order alerts
    if (hasAlertsUpdate && body.orderAlertsEnabled) {
      const settlement = await syncTaskerSettlementStatus(tasker._id.toString())
      if (settlement.isSettlementSuspended || tasker.isSettlementSuspended) {
        return NextResponse.json(
          {
            error:
              'Cannot enable order alerts while your tasker account is suspended for overdue settlements.',
          },
          { status: 403 }
        )
      }
    }

    if (hasAlertsUpdate) {
      tasker.orderAlertsEnabled = body.orderAlertsEnabled as boolean
    }

    if (hasPrefUpdate) {
      tasker.whatsappAppPreference = body.whatsappAppPreference as
        | 'whatsapp'
        | 'whatsapp_business'
        | 'ask_every_time'
    }

    await tasker.save()

    return NextResponse.json({
      ok: true,
      orderAlertsEnabled: tasker.orderAlertsEnabled,
      whatsappAppPreference: tasker.whatsappAppPreference || 'ask_every_time',
    })
  } catch (error) {
    console.error('[PATCH /api/taskers/preferences]', error)
    return NextResponse.json(
      { error: 'Failed to update preferences.' },
      { status: 500 }
    )
  }
}
