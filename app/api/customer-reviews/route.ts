import { NextRequest, NextResponse } from 'next/server'
import { Types } from 'mongoose'
import { auth } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tasker from '@/models/tasker'
import { Order } from '@/models/order'
import { CustomerReview } from '@/models/customer-review'

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    const { orderId, rating, comment } = await request.json()
    if (!Types.ObjectId.isValid(orderId)) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 })
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: 'Choose a rating from 1 to 5.' }, { status: 400 })
    const reviewComment = typeof comment === 'string' ? comment.trim() : ''
    if (reviewComment.length > 500) return NextResponse.json({ error: 'Review must be at most 500 characters.' }, { status: 400 })
    await connectDB()
    const tasker = await Tasker.findOne({ userId: session.user.id }).select('_id').lean()
    if (!tasker) return NextResponse.json({ error: 'Only taskers can review customers.' }, { status: 403 })
    const order = await Order.findOne({ _id: orderId, taskerId: tasker._id, status: 'completed' }).select('userId isTestOrder').lean()
    if (!order) return NextResponse.json({ error: 'You can only review a customer after completing their order.' }, { status: 403 })
    const existing = await CustomerReview.findOne({ orderId }).lean()
    if (existing) return NextResponse.json({ error: 'You have already reviewed this customer for this order.' }, { status: 409 })
    const review = await CustomerReview.create({ taskerId: tasker._id, customerId: String(order.userId), orderId, rating, comment: reviewComment, isTestOrder: order.isTestOrder === true })
    return NextResponse.json({ review }, { status: 201 })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return NextResponse.json({ error: 'You have already reviewed this customer for this order.' }, { status: 409 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to submit review.' }, { status: 500 })
  }
}
