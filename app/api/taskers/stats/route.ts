import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/models/order';
import { Review } from '@/models/review';

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const taskerId = req.nextUrl.searchParams.get('taskerId');
    if (!taskerId) {
      return NextResponse.json({ error: 'taskerId is required' }, { status: 400 });
    }
    // Count completed orders
    const completedTasks = await Order.countDocuments({ taskerId, status: 'completed' });
    // Calculate average rating
    const reviews = await Review.find({ taskerId });
    let avgRating = 0;
    if (reviews.length > 0) {
      avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    }
    return NextResponse.json({ completedTasks, rating: avgRating });
  } catch (error) {
    console.error('Error fetching tasker stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
