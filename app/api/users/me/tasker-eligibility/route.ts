import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { normalizeEmail } from '@/lib/email-normalization'
import { reconcileTaskerIdentityForUser } from '@/lib/tasker-onboarding'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    try {
      await reconcileTaskerIdentityForUser(session.user.id)
    } catch {
      // A conflicting or ambiguous identity is never treated as dashboard access.
    }

    const user = await User.findById(session.user.id).select('role taskerId email').lean()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const email = normalizeEmail(user.email)
    const linkedTasker = await Tasker.findOne({ userId: user._id })
      .select('_id isVerified isRejected')
      .lean<{ _id: unknown; isVerified?: boolean; isRejected?: boolean }>()
    const hasTaskerAccess = Boolean(
      user.role === 'tasker' && linkedTasker?.isVerified && !linkedTasker.isRejected
    )
    const registered = user.role !== 'user' || Boolean(user.taskerId) || Boolean(linkedTasker) || Boolean(
      !linkedTasker && email
        ? await Tasker.exists({ email })
        : false
    )

    return NextResponse.json(
      { canApply: !registered, hasTaskerAccess },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Unable to check tasker registration' }, { status: 500 })
  }
}
