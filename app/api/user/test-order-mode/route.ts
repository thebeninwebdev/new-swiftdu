import { NextResponse, type NextRequest } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { isExcoAccount } from '@/lib/test-orders'
import { User } from '@/models/user'

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const body = await request.json()
    const enabled = body?.testOrderMode === true
    const user = await User.findById(session.user.id).select('isExco excoRole testOrderMode')

    if (!user || !isExcoAccount(user)) {
      return NextResponse.json(
        { error: 'Only EXCO accounts can use test order mode.' },
        { status: 403 }
      )
    }

    user.testOrderMode = enabled
    await user.save()

    return NextResponse.json({
      testOrderMode: user.testOrderMode === true,
    })
  } catch (error) {
    console.error('[PATCH /api/user/test-order-mode]', error)
    return NextResponse.json(
      { error: 'Failed to update test order mode.' },
      { status: 500 }
    )
  }
}
