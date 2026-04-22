import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: req.headers,
    })

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    await connectDB()

    const { id } = await params
    const { action, isPremium } = await req.json()

    if (action !== undefined && !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject".' },
        { status: 400 }
      )
    }

    if (action === undefined && typeof isPremium !== 'boolean') {
      return NextResponse.json(
        { error: 'Provide either an approval action or an isPremium boolean.' },
        { status: 400 }
      )
    }

    const tasker = await Tasker.findById(id)

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found.' }, { status: 404 })
    }

    if (action === 'approve') {
      tasker.isVerified = true
      tasker.isRejected = false
    } else if (action === 'reject') {
      tasker.isVerified = false
      tasker.isRejected = true
      tasker.isPremium = false
    }

    if (typeof isPremium === 'boolean' && action !== 'reject') {
      tasker.isPremium = isPremium
    }

    await tasker.save()

    return NextResponse.json(
      {
        message:
          action === 'approve'
            ? 'Tasker approved successfully.'
            : action === 'reject'
              ? 'Tasker rejected successfully.'
              : `Premium access ${tasker.isPremium ? 'enabled' : 'disabled'} for this tasker.`,
        tasker: {
          id: tasker._id,
          isVerified: tasker.isVerified,
          isRejected: tasker.isRejected,
          isPremium: tasker.isPremium,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[PATCH /api/admin/taskers/[id]]', error)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
