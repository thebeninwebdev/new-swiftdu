import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {User} from '@/models/user'
import { Order } from '@/models/order'

// ─── GET /api/admin/users ───────────────────────────────────────────────────
// Returns paginated list of users with optional filters.
// Restricted to admin role only.

export async function GET(req: NextRequest) {
  try {
    // TODO: Add admin auth check
    // const session = await authClient.getSession()
    // const user = session?.data?.user
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    // }

    await connectDB()

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const skip = (page - 1) * limit

    // Build filters
    const filters: Record<string, unknown> = {}

    const search = searchParams.get('search')
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }

    const role = searchParams.get('role')
    if (role && role !== 'all') {
      filters.role = role
    }

    const status = searchParams.get('status')
    if (status === 'verified') {
      filters.emailVerified = true
    } else if (status === 'unverified') {
      filters.emailVerified = false
    } else if (status === 'suspended') {
      filters.isSuspended = true
    }

    // Get users with order counts
    const users = await User.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    // Get order counts for each user
    const userIds = users.map(u => u._id.toString())
    const orderCounts = await Order.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ])

    const orderCountMap = Object.fromEntries(
      orderCounts.map((item: { _id: string; count: number }) => [item._id.toString(), item.count])
    )

    // Attach order counts
    const usersWithCounts = users.map(user => ({
      ...user,
      orderCount: orderCountMap[user._id.toString()] || 0
    }))

    const totalUsers = await User.countDocuments(filters)
    const totalPages = Math.ceil(totalUsers / limit)

    return NextResponse.json({
      users: usersWithCounts,
      currentPage: page,
      totalPages,
      totalUsers
    })

  } catch (error) {
    console.error('[GET /api/admin/users]', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

