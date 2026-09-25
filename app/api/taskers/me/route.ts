import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'
import { getTaskerMode } from '@/lib/test-orders'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to access your tasker dashboard.' }, { status: 401 })
    }

    await connectDB()
    const user = await User.findById(session.user.id).select('role taskerId').lean()
    if (!user || user.role !== 'tasker') {
      return NextResponse.json({ error: 'Complete your approved tasker onboarding before accessing this dashboard.' }, { status: 403 })
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
      return NextResponse.json({ error: 'No tasker profile is linked to this account. Complete your onboarding using your approval email, or contact support if you have already done so.' }, { status: 404 })
    }

    return NextResponse.json({ tasker: { ...tasker, taskerMode: getTaskerMode(tasker) } }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[GET /api/taskers/me]', error)
    return NextResponse.json({ error: 'Unable to load your tasker profile. Please try again.' }, { status: 500 })
  }
}
