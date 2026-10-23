import { connectDB } from '@/lib/db';
import { syncTaskerStats } from '@/lib/tasker-stats';
import {Review} from '@/models/review';
import { Order } from '@/models/order';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    await connectDB();

    return NextResponse.json(
      { error: 'Detailed tasker reviews are private.' },
      { status: 403 }
    );
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskerId, orderId, rating, comment } = await req.json();
    const reviewComment = typeof comment === 'string' ? comment.trim() : '';

    // Validate input
    if (!taskerId || !orderId || !rating) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const order = await Order.findOne({ _id: orderId, userId: session.user.id })
      .select('taskerId status isTestOrder')
      .lean()
    if (!order || order.status !== 'completed' || !order.taskerId || String(order.taskerId) !== String(taskerId)) {
      return NextResponse.json({ error: 'You can only review your own completed order.' }, { status: 403 })
    }

    // Check if review already exists for this order
    const existingReview = await Review.findOne({ orderId });
    if (existingReview) {
      return NextResponse.json(
        { error: 'Review already exists for this order' },
        { status: 400 }
      );
    }

    const review = new Review({
      taskerId,
      orderId,
      userId: session.user.id,
      rating,
      comment: reviewComment,
      isTestOrder: order.isTestOrder === true,
    });

    await review.save();
    // Training feedback is retained for the simulator but never changes public
    // tasker ratings or review counts.
    if (!order.isTestOrder) await syncTaskerStats(taskerId);

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
