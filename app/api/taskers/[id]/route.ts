import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { auth } from '@/lib/auth'

// ─── GET /api/taskers/[id] ────────────────────────────────────────────────────
// Retrieves basic tasker information including bank details by their Tasker document _id.
// Public endpoint - anyone can view tasker details.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { id } = await params

    const tasker:{_id: string; bankDetails:string} = await Tasker.findById(id).lean()

    if (!tasker) {
      return NextResponse.json(
        { error: 'Tasker not found.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        _id: tasker._id,
        bankDetails: tasker.bankDetails,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[GET /api/taskers/[id]]', error)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/taskers/[id] ──────────────────────────────────────────────────
// Approves or rejects a tasker by their Tasker document _id.
// Body: { action: 'approve' | 'reject' }
// Restricted to admin role only.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const session = await auth.api.getSession({
      headers: req.headers
    })

    const user = session?.user

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    await connectDB()

    const { id } = await params
    const body = await req.json()
    const { action, isPremium } = body

    if (
      action !== undefined &&
      !['approve', 'reject'].includes(action)
    ) {
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
      return NextResponse.json(
        { error: 'Tasker not found.' },
        { status: 404 }
      )
    }

    if (action === 'approve') {
      tasker.isVerified = true
      tasker.isRejected = false
    } else if (action === 'reject') {
      tasker.isVerified = false
      tasker.isRejected = true
    }

    if (typeof isPremium === 'boolean') {
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
              : `Tasker premium status updated to ${tasker.isPremium ? 'premium' : 'standard'}.`,
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
    console.error('[PATCH /api/taskers/[id]]', error)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
