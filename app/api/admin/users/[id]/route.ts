import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/models/user'

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
    const { action } = await req.json()

    if (!['verify', 'suspend', 'activate'].includes(action)) {
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

    const updateData: { isVerified?: boolean; isSuspended?: boolean } = {}

    if (action === 'verify') {
      updateData.isVerified = true
    } else if (action === 'suspend') {
      updateData.isSuspended = true
    } else if (action === 'activate') {
      updateData.isSuspended = false
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
