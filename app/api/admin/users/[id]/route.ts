import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { connectDB } from '@/lib/db'
import { auth } from '@/lib/auth'
import { User } from '@/models/user'

function getUserLookupConditions({
  id,
  email,
}: {
  id?: string | null
  email?: string | null
}) {
  const conditions: Record<string, unknown>[] = []

  if (id) {
    conditions.push({ id })

    if (Types.ObjectId.isValid(id)) {
      conditions.push({ _id: new Types.ObjectId(id) })
    }
  }

  if (email) {
    conditions.push({ email: email.trim().toLowerCase() })
  }

  return conditions
}

// ─── PATCH /api/admin/users/[id] ────────────────────────────────────────────
// Update user status (verify, suspend, activate).
// Restricted to admin role only.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Add admin auth check
    // const session = await authClient.getSession()
    // const user = session?.data?.user
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()

    const { id } = await params
    const { action, phone, discountOrderCount } = await req.json()

    if (!['verify', 'suspend', 'activate', 'update-phone', 'grant-discount', 'remove-discount'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    const existingUser = await User.findById(id).select('role')

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (existingUser.role?.toLowerCase() === 'admin') {
      return NextResponse.json(
        { error: 'Admin accounts cannot be modified' },
        { status: 403 }
      )
    }

    const updateData: {
      emailVerified?: boolean
      isSuspended?: boolean
      phone?: string
      serviceFeeDiscountEnabled?: boolean
      serviceFeeDiscountGrantedByUserId?: string
      serviceFeeDiscountGrantedByName?: string
      serviceFeeDiscountGrantedByPhone?: string
      serviceFeeDiscountGrantedAt?: Date
      serviceFeeDiscountRemainingOrders?: number
    } = {}

    if (action === 'verify') {
      updateData.emailVerified = true
    } else if (action === 'suspend') {
      updateData.isSuspended = true
    } else if (action === 'activate') {
      updateData.isSuspended = false
    } else if (action === 'update-phone') {
      const normalizedPhone = typeof phone === 'string' ? phone.trim() : ''

      if (!normalizedPhone) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        )
      }

      updateData.phone = normalizedPhone
    } else if (action === 'grant-discount') {
      const normalizedDiscountOrderCount = Number(discountOrderCount)

      if (
        !Number.isInteger(normalizedDiscountOrderCount) ||
        normalizedDiscountOrderCount < 1
      ) {
        return NextResponse.json(
          { error: 'Enter how many upcoming orders should receive the discount.' },
          { status: 400 }
        )
      }

      const session = await auth.api.getSession({ headers: req.headers })
      const grantorLookupConditions = getUserLookupConditions({
        id: session?.user?.id,
        email: session?.user?.email,
      })
      const grantor = grantorLookupConditions.length
        ? await User.findOne({ $or: grantorLookupConditions })
            .select('name phone email')
            .lean()
        : null
      const grantorPhone = typeof grantor?.phone === 'string' ? grantor.phone.trim() : ''

      if (!grantorPhone) {
        return NextResponse.json(
          { error: 'Add a phone number to your account before granting a discount.' },
          { status: 400 }
        )
      }

      updateData.serviceFeeDiscountEnabled = true
      updateData.serviceFeeDiscountGrantedByUserId = session?.user?.id
      updateData.serviceFeeDiscountGrantedByName =
        grantor?.name || session?.user?.name || session?.user?.email || 'SwiftDU team'
      updateData.serviceFeeDiscountGrantedByPhone = grantorPhone
      updateData.serviceFeeDiscountGrantedAt = new Date()
      updateData.serviceFeeDiscountRemainingOrders = normalizedDiscountOrderCount
    } else if (action === 'remove-discount') {
      const user = await User.findByIdAndUpdate(
        id,
        {
          $set: {
            serviceFeeDiscountEnabled: false,
            serviceFeeDiscountRemainingOrders: 0,
          },
          $unset: {
            serviceFeeDiscountGrantedByUserId: '',
            serviceFeeDiscountGrantedByName: '',
            serviceFeeDiscountGrantedByPhone: '',
            serviceFeeDiscountGrantedAt: '',
          },
        },
        { new: true }
      )

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(user)
    }

    const user = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)

  } catch (error) {
    console.error('[PATCH /api/admin/users/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
