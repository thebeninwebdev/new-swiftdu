import { NextResponse, type NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { normalizeExcoRole } from '@/lib/exco-constants'
import Tasker from '@/models/tasker'

type TaskerMode = 'training' | 'live'

function isTaskerMode(value: unknown): value is TaskerMode {
  return value === 'training' || value === 'live'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    const excoRole = normalizeExcoRole(
      (session?.user as { excoRole?: string | null } | undefined)?.excoRole
    )

    if (!session?.user || (session.user.role !== 'admin' && !excoRole)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const body = await request.json()
    const mode = body?.taskerMode

    if (!isTaskerMode(mode)) {
      return NextResponse.json(
        { error: 'taskerMode must be "training" or "live".' },
        { status: 400 }
      )
    }

    await connectDB()

    const { id } = await params
    const tasker = await Tasker.findByIdAndUpdate(
      id,
      { taskerMode: mode },
      { new: true }
    )

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found.' }, { status: 404 })
    }

    return NextResponse.json({
      message: mode === 'live' ? 'Tasker moved to Live Mode.' : 'Tasker moved to Training Mode.',
      tasker: {
        id: tasker._id,
        taskerMode: tasker.taskerMode,
      },
    })
  } catch (error) {
    console.error('[PATCH /api/admin/taskers/[id]/mode]', error)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}
