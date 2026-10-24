import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'
import { getTaskerMode } from '@/lib/test-orders'
import { reconcileTaskerIdentityForUser } from '@/lib/tasker-onboarding'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to access your tasker dashboard.' }, { status: 401 })
    }

    await connectDB()
    let user = await User.findById(session.user.id).select('role taskerId email').lean()
    if (!user) return NextResponse.json({ error: 'Complete your approved tasker onboarding before accessing this dashboard.', code: 'TASKER_REAPPLICATION_REQUIRED' }, { status: 403 })

    try {
      await reconcileTaskerIdentityForUser(session.user.id)
      user = await User.findById(session.user.id).select('role taskerId email').lean()
    } catch (error) {
      return NextResponse.json({ error: 'Your tasker account link needs review.', code: error instanceof Error ? error.message : 'TASKER_ACCOUNT_MISMATCH' }, { status: 409 })
    }

    if (!user || user.role !== 'tasker') {
      return NextResponse.json({ error: 'Complete your approved tasker onboarding before accessing this dashboard.', code: 'TASKER_ACCOUNT_NOT_LINKED' }, { status: 403 })
    }

    // Read the persisted links rather than depending on cached session metadata.
    let tasker = await Tasker.findOne({ userId: user._id }).lean()
    if (!tasker && user.taskerId && Types.ObjectId.isValid(String(user.taskerId))) {
      tasker = await Tasker.findOne({
        _id: user.taskerId,
        $or: [{ userId: user._id }, { userId: null }],
      }).lean()
    }

    if (!tasker) {
      return NextResponse.json({ error: 'Submit a new Tasker application for the current intake.', code: 'TASKER_REAPPLICATION_REQUIRED' }, { status: 404 })
    }

    if (tasker.isRejected) return NextResponse.json({ error: 'Your previous Tasker application was not accepted. You can apply again.', code: 'TASKER_REAPPLICATION_REQUIRED' }, { status: 403 })

    return NextResponse.json({ tasker: { ...tasker, taskerMode: getTaskerMode(tasker) } }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[GET /api/taskers/me]', error)
    return NextResponse.json({ error: 'Unable to load your tasker profile. Please try again.' }, { status: 500 })
  }
}
