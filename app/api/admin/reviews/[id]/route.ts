import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import {Review} from '@/models/review'

// ─── PATCH /api/admin/reviews/[id] ──────────────────────────────────────────
// Update review visibility or delete review.
// Restricted to admin role only.

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB()

    const { action } = await req.json()

    // ✅ FIX: await params
    const { id } = await context.params

    if (!['hide', 'show', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

    if (action === 'delete') {
      const review = await Review.findByIdAndDelete(id)
      if (!review) {
        return NextResponse.json(
          { error: 'Review not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ message: 'Review deleted successfully' })
    }

    const updateData: any = {
      updatedAt: new Date(),
      isVisible: action === 'show'
    }

    const review = await Review.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(review)

  } catch (error) {
    console.error('[PATCH /api/admin/reviews/[id]]', error)
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    )
  }
}