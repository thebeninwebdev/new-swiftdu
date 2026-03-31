import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {Review} from '@/models/review'
import {User} from '@/models/user'
import Tasker from '@/models/tasker'

// ─── GET /api/admin/reviews ─────────────────────────────────────────────────
// Returns paginated list of reviews with user and tasker details.
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
        { comment: { $regex: search, $options: 'i' } }
      ]
    }

    const rating = searchParams.get('rating')
    if (rating && rating !== 'all') {
      filters.rating = parseInt(rating)
    }

    const visibility = searchParams.get('visibility')
    if (visibility === 'visible') {
      filters.isVisible = true
    } else if (visibility === 'hidden') {
      filters.isVisible = false
    }

    // Get reviews with user and tasker details
    const reviews = await Review.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    // Get user details
    const userIds = [...new Set(reviews.map(r => r.userId))]
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email')
      .lean()

    const userMap = Object.fromEntries(
      users.map(u => [u._id.toString(), u])
    )

    // Get tasker details
    const taskerIds = [...new Set(reviews.map(r => r.taskerId))]
    const taskers = await Tasker.find({ _id: { $in: taskerIds } })
      .select('_id userId')
      .populate('userId', 'name')
      .lean()

    const taskerMap = Object.fromEntries(
      taskers.map(t => [t._id.toString(), (t as any).userId?.name || 'Unknown Tasker'])
    )

    // Attach user and tasker details
    const reviewsWithDetails = reviews.map(review => ({
      ...review,
      userName: userMap[review.userId.toString()]?.name || 'Unknown User',
      userEmail: userMap[review.userId.toString()]?.email || '',
      taskerName: taskerMap[review.taskerId.toString()] || 'Unknown Tasker'
    }))

    const totalReviews = await Review.countDocuments(filters)
    const totalPages = Math.ceil(totalReviews / limit)

    return NextResponse.json({
      reviews: reviewsWithDetails,
      currentPage: page,
      totalPages,
      totalReviews
    })

  } catch (error) {
    console.error('[GET /api/admin/reviews]', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

