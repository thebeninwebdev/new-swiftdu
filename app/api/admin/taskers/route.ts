import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import {User} from '@/models/user'
// import { authClient } from '@/lib/auth-client'

// ─── GET /api/admin/taskers?status=pending|verified|rejected ─────────────────
// Returns all tasker profiles joined with user name + email.
// Restricted to admin role only.

export async function GET(req: NextRequest) {
  try {
    // ── Auth guard ─────────────────────────────────────────────────────────
    // const session = await authClient.getSession()
    // const user = session?.data?.user

    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') // 'pending' | 'verified' | 'rejected'

    // Build filter
    type TaskerFilter = { isVerified?: boolean; isRejected?: boolean }
    let filter: TaskerFilter = {}

    if (status === 'pending') {
      filter = { isVerified: false, isRejected: false }
    } else if (status === 'verified') {
      filter = { isVerified: true }
    } else if (status === 'rejected') {
      filter = { isRejected: true }
    }

    const taskers = await Tasker.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    // Attach user name + email to each tasker
    const userIds = taskers.map((t) => t.userId)
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email')
      .lean()

    const userMap = Object.fromEntries(
      users.map((u) => [u._id.toString(), u])
    )

    const enriched = taskers.map((t) => ({
      ...t,
      user: userMap[t.userId.toString()] ?? null,
    }))

    return NextResponse.json({ taskers: enriched }, { status: 200 })
  } catch (error) {
    console.error('[GET /api/admin/taskers]', error)
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    )
  }
}