import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Support from '@/models/support'
import {User} from '@/models/user'

// ─── GET /api/admin/support ─────────────────────────────────────────────────
// Returns paginated list of support tickets with user details.
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
    const filters: any = {}

    const search = searchParams.get('search')
    if (search) {
      filters.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ]
    }

    const status = searchParams.get('status')
    if (status && status !== 'all') {
      filters.status = status
    }

    const priority = searchParams.get('priority')
    if (priority && priority !== 'all') {
      filters.priority = priority
    }

    // Get support tickets with user details
    const tickets = await Support.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    // Get user details
    const userIds = [...new Set(tickets.map(t => t.userId))]
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email')
      .lean()

    const userMap = Object.fromEntries(
      users.map(u => [u._id.toString(), u])
    )

    // Attach user details
    const ticketsWithDetails = tickets.map(ticket => ({
      ...ticket,
      userName: userMap[ticket.userId.toString()]?.name || 'Unknown User',
      userEmail: userMap[ticket.userId.toString()]?.email || ''
    }))

    const totalTickets = await Support.countDocuments(filters)
    const totalPages = Math.ceil(totalTickets / limit)

    return NextResponse.json({
      tickets: ticketsWithDetails,
      currentPage: page,
      totalPages,
      totalTickets
    })

  } catch (error) {
    console.error('[GET /api/admin/support]', error)
    return NextResponse.json(
      { error: 'Failed to fetch support tickets' },
      { status: 500 }
    )
  }
}