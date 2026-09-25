import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { normalizeEmail } from '@/lib/email-normalization'
import { User } from '@/models/user'
import Tasker from '@/models/tasker'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()
    const user = await User.findById(session.user.id).select('role taskerId email').lean()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Applications are linked to an account only after approval and onboarding.
    const email = normalizeEmail(user.email)
    const registered = user.role !== 'user' || Boolean(user.taskerId) || Boolean(
      await Tasker.exists({
        $or: [{ userId: user._id }, ...(email ? [{ email }] : [])],
      })
    )

    return NextResponse.json({ canApply: !registered }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Unable to check tasker registration' }, { status: 500 })
  }
}
