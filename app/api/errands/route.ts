import { connectDB } from '@/lib/db'
import { Order } from '@/models/order'
import Tasker from "@/models/tasker"
import { NextRequest, NextResponse } from 'next/server'

// GET - Fetch all pending errands for taskers
export async function GET(request: NextRequest) {
  try {
    await connectDB()

    const taskType = request.nextUrl.searchParams.get('taskType')
    const location = request.nextUrl.searchParams.get('location')
    const sortBy = request.nextUrl.searchParams.get('sortBy') || 'createdAt'


    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { status: 'pending' }

    if (taskType && taskType !== 'all') {
      filter.taskType = taskType
    }

    if (location && location !== 'all') {
      filter.location = { $regex: location, $options: 'i' } // Case-insensitive search
    }

    // Fetch pending orders with sorting
    const orders = await Order.find(filter)
      .sort({ [sortBy]: -1 })
      .lean()

    return NextResponse.json(orders)
  } catch (error) {
    console.error('GET /api/errands error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch errands' },
      { status: 500 }
    )
  }
}

// POST - Accept an errand (for taskers)
export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const body = await request.json()
    const { orderId, taskerId } = body

    if (!orderId || !taskerId) {
      return NextResponse.json(
        { error: 'orderId and taskerId are required' },
        { status: 400 }
      )
    }

    // Verify tasker exists and is verified
    const tasker = await Tasker.findOne({ userId: taskerId })

    if (!tasker) {
      return NextResponse.json(
        { error: 'Tasker profile not found' },
        { status: 404 }
      )
    }

    if (!tasker.isVerified) {
      return NextResponse.json(
        { error: 'You must be verified to accept errands' },
        { status: 403 }
      )
    }

    if (tasker.isRejected) {
      return NextResponse.json(
        { error: 'Your tasker account has been rejected' },
        { status: 403 }
      )
    }

    // Find and update the order
    const order = await Order.findById(orderId)

    if (!order) {
      return NextResponse.json(
        { error: 'Errand not found' },
        { status: 404 }
      )
    }

    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: 'This errand has already been accepted or completed' },
        { status: 409 }
      )
    }

    // Update order with tasker info
    order.acceptedBy = taskerId
    order.acceptedAt = new Date()
    order.status = 'accepted'

    const updatedOrder = await order.save()

    return NextResponse.json(updatedOrder, { status: 200 })
  } catch (error) {
    console.error('POST /api/errands error:', error)
    return NextResponse.json(
      { error: 'Failed to accept errand' },
      { status: 500 }
    )
  }
}
