import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import {
  getUserLookupConditions,
  hasActiveServiceFeeDiscountReservation,
} from '@/lib/service-fee-discount'
import { User } from '@/models/user'

export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const lookupConditions = getUserLookupConditions({
      id: session.user.id,
      email: session.user.email,
    })
    const user = lookupConditions.length
      ? await User.findOne({ $or: lookupConditions })
          .select('serviceFeeDiscountEnabled serviceFeeDiscountRemainingOrders')
          .lean()
      : null
    const remainingOrders = Number(user?.serviceFeeDiscountRemainingOrders || 0)
    const hasCurrentDiscount = Boolean(
      user?.serviceFeeDiscountEnabled && remainingOrders > 0
    )
    const hasActiveReservation = hasCurrentDiscount
      ? await hasActiveServiceFeeDiscountReservation(session.user.id)
      : false

    return NextResponse.json({
      hasCurrentDiscount,
      hasAvailableDiscount: hasCurrentDiscount && !hasActiveReservation,
      hasActiveReservation,
      remainingOrders,
    })
  } catch (error) {
    console.error('[GET /api/users/me/service-fee-discount]', error)
    return NextResponse.json(
      { error: 'Failed to check service fee discount.' },
      { status: 500 }
    )
  }
}
