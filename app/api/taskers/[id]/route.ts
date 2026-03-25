import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { authClient } from '@/lib/auth-client'

// ─── PATCH /api/taskers/[id] ──────────────────────────────────────────────────
// Approves or rejects a tasker by their Tasker document _id.
// Body: { action: 'approve' | 'reject' }
// Restricted to admin role only.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    const session = await authClient.getSession()
    const user = session?.data?.user

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    await connectDB()

    const { id } = params
    const body = await req.json()
    const { action } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject".' },
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
    } else {
      tasker.isVerified = false
      tasker.isRejected = true
    }

    await tasker.save()

    return NextResponse.json(
      {
        message: `Tasker ${action === 'approve' ? 'approved' : 'rejected'} successfully.`,
        tasker: {
          id: tasker._id,
          isVerified: tasker.isVerified,
          isRejected: tasker.isRejected,
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